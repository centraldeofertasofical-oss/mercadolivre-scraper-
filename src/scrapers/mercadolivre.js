import axios from 'axios';
import * as cheerio from 'cheerio';
import { buildHeaders } from '../utils/headers.js';
import {
  cleanText,
  toNumberBR,
  normalizeMercadoLivreLink,
} from '../utils/normalize.js';
import { isValidProduct, dedupeProducts } from '../utils/validator.js';
import { settings } from '../config/settings.js';
import { logInfo, logError } from '../utils/logger.js';

function buildOffersUrl(page = 1) {
  const pageNumber = Number(page);
  if (!pageNumber || pageNumber <= 1) {
    return 'https://www.mercadolivre.com.br/ofertas';
  }
  return `https://www.mercadolivre.com.br/ofertas?page=${pageNumber}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDiscountNumber(discountText = '') {
  const match = String(discountText).match(/(\d{1,3})\s*%/);
  return match ? Number(match[1]) : null;
}

function normalizeImage(url = '') {
  if (!url) return null;
  return String(url)
    .split('?')[0]
    .trim();
}

function normalizeLink(url = '') {
  if (!url) return null;
  return String(url).split('?')[0].trim();
}

function textFromFirst(card, selectors = []) {
  for (const selector of selectors) {
    const text = cleanText(card.find(selector).first().text());
    if (text) return text;
  }
  return null;
}

function attrFromFirst(card, selectors = [], attr = 'href') {
  for (const selector of selectors) {
    const value = cleanText(card.find(selector).first().attr(attr) || '');
    if (value) return value;
  }
  return null;
}

function parseMoneyNode(node) {
  if (!node || !node.length) return null;

  const fraction = cleanText(node.find('.andes-money-amount__fraction').first().text());
  const cents = cleanText(node.find('.andes-money-amount__cents').first().text());

  if (!fraction) {
    const raw = cleanText(node.text());
    return raw ? toNumberBR(raw) : null;
  }

  return toNumberBR(cents ? `${fraction},${cents}` : fraction);
}

function pickBestCurrentPrice(card) {
  const candidateSelectors = [
    '.poly-price__current .andes-money-amount',
    '.poly-price__current',
    '.ui-search-price__second-line .andes-money-amount',
    '.ui-search-price__part .andes-money-amount',
    '.ui-search-price__part',
  ];

  for (const selector of candidateSelectors) {
    const value = parseMoneyNode(card.find(selector).first());
    if (value && value > 0) return value;
  }

  const candidates = [];
  card.find('.andes-money-amount').each((_, el) => {
    const block = card.find(el);
    const context = cleanText(block.parent().text()).toLowerCase();

    if (
      context.includes('sem juros') ||
      context.includes('linha de crédito') ||
      context.includes('parcel') ||
      context.includes('mensal') ||
      context.includes('no pix')
    ) {
      return;
    }

    const value = parseMoneyNode(block);
    if (value && value > 0) candidates.push(value);
  });

  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function pickBestOldPrice(card, currentPrice = null) {
  const candidateSelectors = [
    '.poly-price__previous .andes-money-amount',
    '.poly-price__previous',
    '.andes-money-amount--previous',
    '.ui-search-price__original-value .andes-money-amount',
    '.ui-search-price__original-value',
  ];

  for (const selector of candidateSelectors) {
    const value = parseMoneyNode(card.find(selector).first());
    if (value && value > 0) return value;
  }

  const candidates = [];
  card.find('.andes-money-amount').each((_, el) => {
    const value = parseMoneyNode(card.find(el));
    if (!value || value <= 0) return;
    if (currentPrice && value <= currentPrice) return;
    candidates.push(value);
  });

  if (!candidates.length) return null;
  return Math.max(...candidates);
}

function parsePriceBlock(card) {
  let currentPrice = pickBestCurrentPrice(card);
  let oldPrice = pickBestOldPrice(card, currentPrice);

  if (currentPrice && oldPrice && currentPrice > oldPrice) {
    const min = Math.min(currentPrice, oldPrice);
    const max = Math.max(currentPrice, oldPrice);
    currentPrice = min;
    oldPrice = max;
  }

  return { currentPrice, oldPrice };
}

function inferCategory(title = '', link = '') {
  const source = `${title} ${link}`.toLowerCase();

  if (/(galaxy|smartphone|iphone|motorola|xiaomi|celular)/.test(source)) return 'celular';
  if (/(whey|creatina|protein|hipercalorico|mass|omega)/.test(source)) return 'suplementos';
  if (/(tenis|tênis|camiseta|cueca|meia|chinelo|mochila|camisa|polo)/.test(source)) return 'moda';
  if (/(air fryer|fritadeira|cooktop|forno|panela|taças|tacas|espelho|ventilador|cuba|liquidificador)/.test(source)) return 'casa';
  if (/(furadeira|parafusadeira|cabo flexivel|cabo flexível|solda|lava jato)/.test(source)) return 'ferramentas';
  if (/(escova|aparador|máscara capilar|mascara capilar|barbeador)/.test(source)) return 'beleza';
  if (/(smartwatch|power bank|carregador|usb-c|magsafe)/.test(source)) return 'acessorios_celular';
  if (/(smart tv|tv\b)/.test(source)) return 'tv';
  if (/(monitor|suporte articulado)/.test(source)) return 'monitor';
  if (/(caixa de som|boombox|soundbar|home theater)/.test(source)) return 'audio_video';
  if (/(notebook|teclado|mouse|roteador|wifi|wi-fi|mesh|impressora|inalador)/.test(source)) return 'informatica';
  if (/(lavadora lava jato|automotivo|carro|moto)/.test(source)) return 'automotivo';

  return 'outros';
}

function parseOffers(html, sourceUrl, page) {
  const $ = cheerio.load(html);
  const products = [];

  const selectors = [
    'li.ui-search-layout__item',
    'div.poly-card',
  ];

  const cards = $(selectors.join(','));

  cards.each((_, el) => {
    const card = $(el);

    const title =
      textFromFirst(card, [
        '.poly-component__title',
        '.ui-search-item__title',
        'h3',
      ]) || null;

    const rawLink = normalizeLink(
      attrFromFirst(card, [
        'a.poly-component__title',
        'a[href*="/p/"]',
        'a[href*="MLB"]',
        'a[href*="MLBU"]',
      ], 'href')
    );

    const image = normalizeImage(
      attrFromFirst(card, [
        'img[data-src]',
        'img[data-srcset]',
        'img[src]',
      ], 'src') ||
      attrFromFirst(card, ['img[data-src]'], 'data-src') ||
      attrFromFirst(card, ['img[data-srcset]'], 'data-srcset')
    );

    const normalized = normalizeMercadoLivreLink(rawLink, title, image);
    const { currentPrice, oldPrice } = parsePriceBlock(card);

    const discountText =
      textFromFirst(card, [
        '.andes-money-amount__discount',
        '.ui-search-price__discount',
        '.poly-price__discount',
      ]) || null;

    let descontoPct = extractDiscountNumber(discountText);
    let precoPor = currentPrice;
    let precoDe = oldPrice;

    if ((!precoDe || precoDe <= precoPor) && descontoPct && precoPor) {
      const calculated = precoPor / (1 - descontoPct / 100);
      if (Number.isFinite(calculated) && calculated > precoPor) {
        precoDe = Number(calculated.toFixed(2));
      }
    }

    if ((!descontoPct || descontoPct <= 0) && precoDe && precoPor && precoDe > precoPor) {
      descontoPct = Math.round(((precoDe - precoPor) / precoDe) * 100);
    }

    if (precoDe && precoPor) {
      const ratio = precoDe / precoPor;

      if (ratio > 5) {
        precoDe = null;
      }

      if (precoDe && precoDe <= precoPor) {
        precoDe = null;
      }
    }

    if (descontoPct && (descontoPct <= 0 || descontoPct > 90)) {
      descontoPct = null;
    }

    const product = {
      ID: normalized.canonicalId || normalized.groupId,
      GROUP_ID: normalized.groupId,
      VARIATION_ID: normalized.variationId,
      CATALOG_ID: normalized.catalogId,

      PLATAFORMA: 'Mercado Livre',
      ORIGEM: 'OFERTAS',
      PAGINA: Number(page),

      PRODUTO: title,
      LINK_ORIGINAL: normalized.canonicalLink,
      LINK_COLETADO: rawLink,

      LINK_AFILIADO: null,
      LINK_IMAGEM: image,

      PRECO_DE: precoDe,
      PRECO_POR: precoPor,
      DESCONTO_PCT: descontoPct,

      URL_COLETA: sourceUrl,
      DATA_COLETA: new Date().toISOString(),

      CATEGORIA: inferCategory(title, rawLink),
    };

    if (isValidProduct(product)) {
      products.push(product);
    }
  });

  return dedupeProducts(products);
}

export async function scrapeMercadoLivreOffers({ page = 1 }) {
  const finalUrl = buildOffersUrl(page);

  logInfo('Coletando página de ofertas', {
    page: Number(page),
    url: finalUrl,
  });

  const response = await axios.get(finalUrl, {
    headers: buildHeaders(),
    timeout: settings.requestTimeout,
  });

  const products = parseOffers(response.data, finalUrl, page);

  return {
    ok: true,
    type: 'ofertas',
    url: finalUrl,
    page: Number(page),
    total: products.length,
    products,
  };
}

export async function scrapeMercadoLivreOffersRange({ start = 1, end = 20 }) {
  const startPage = Math.max(1, Number(start || 1));
  const endPage = Math.min(20, Number(end || startPage));

  if (startPage > endPage) {
    throw new Error('Parâmetros inválidos: start não pode ser maior que end');
  }

  const allProducts = [];
  const pages = [];

  for (let page = startPage; page <= endPage; page++) {
    try {
      const result = await scrapeMercadoLivreOffers({ page });
      allProducts.push(...result.products);
      pages.push({ page, total: result.total, ok: true });

      logInfo('Página processada com sucesso', {
        page,
        total: result.total,
      });
    } catch (error) {
      pages.push({
        page,
        total: 0,
        ok: false,
        error: error?.message || 'Erro desconhecido',
      });

      logError(`Erro ao processar página ${page}`, error?.message || error);
    }

    if (page < endPage) {
      await sleep(700);
    }
  }

  const deduped = dedupeProducts(allProducts);

  return {
    ok: true,
    type: 'ofertas_range',
    start: startPage,
    end: endPage,
    pages_processed: pages.length,
    total: deduped.length,
    pages,
    products: deduped,
  };
}
