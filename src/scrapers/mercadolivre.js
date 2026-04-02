import axios from 'axios';
import * as cheerio from 'cheerio';
import { buildHeaders } from '../utils/headers.js';
import { cleanText, toNumberBR, extractMLB } from '../utils/normalize.js';
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
  return String(url).split('?')[0].trim();
}

function parsePriceBlock(card) {
  const fractions = card.find('.andes-money-amount__fraction');
  const centsList = card.find('.andes-money-amount__cents');

  let currentPrice = null;
  let oldPrice = null;

  if (fractions.length >= 1) {
    const currentFraction = cleanText(card.find('.andes-money-amount__fraction').first().text());
    const currentCents = cleanText(card.find('.andes-money-amount__cents').first().text());

    if (currentFraction) {
      currentPrice = toNumberBR(
        currentCents ? `${currentFraction},${currentCents}` : currentFraction
      );
    }
  }

  if (fractions.length >= 2) {
    const oldFraction = cleanText(fractions.eq(1).text());
    const oldCents = cleanText(centsList.eq(1).text());

    if (oldFraction) {
      oldPrice = toNumberBR(oldCents ? `${oldFraction},${oldCents}` : oldFraction);
    }
  }

  const previousWrapperText = cleanText(
    card.find('.andes-money-amount--previous').first().text()
  );

  if (!oldPrice && previousWrapperText) {
    oldPrice = toNumberBR(previousWrapperText);
  }

  return {
    currentPrice,
    oldPrice
  };
}

function parseOffers(html, sourceUrl, page) {
  const $ = cheerio.load(html);
  const products = [];

  const selectors = [
    'li.ui-search-layout__item',
    'div.andes-card',
    'div.poly-card'
  ];

  const cards = $(selectors.join(','));

  cards.each((_, el) => {
    const card = $(el);

    const title =
      cleanText(
        card.find('h3, .poly-component__title, .ui-search-item__title').first().text()
      ) || null;

    const link =
      card.find('a[href*="MLB"], a[href*="/p/"]').first().attr('href') || null;

    const image =
      card.find('img').first().attr('src') ||
      card.find('img').first().attr('data-src') ||
      card.find('img').first().attr('data-srcset') ||
      null;

    const { currentPrice, oldPrice } = parsePriceBlock(card);

    const discountText =
      cleanText(
        card.find('.andes-money-amount__discount, .ui-search-price__discount').first().text()
      ) || null;

    let descontoPct = extractDiscountNumber(discountText);
    let precoDe = oldPrice;
    const precoPor = currentPrice;

    if ((!descontoPct || descontoPct <= 0) && precoDe && precoPor && precoDe > precoPor) {
      descontoPct = Math.round(((precoDe - precoPor) / precoDe) * 100);
    }

    if ((!precoDe || precoDe <= precoPor) && descontoPct && precoPor) {
      precoDe = Number((precoPor / (1 - descontoPct / 100)).toFixed(2));
    }

    const product = {
      ID: extractMLB(link),
      PLATAFORMA: 'Mercado Livre',
      ORIGEM: 'OFERTAS',
      PAGINA: Number(page),
      PRODUTO: title,
      LINK_ORIGINAL: link,
      LINK_AFILIADO: null,
      LINK_IMAGEM: normalizeImage(image),
      PRECO_DE: precoDe,
      PRECO_POR: precoPor,
      DESCONTO_PCT: descontoPct,
      URL_COLETA: sourceUrl,
      DATA_COLETA: new Date().toISOString()
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
    url: finalUrl
  });

  const response = await axios.get(finalUrl, {
    headers: buildHeaders(),
    timeout: settings.requestTimeout
  });

  const products = parseOffers(response.data, finalUrl, page);

  return {
    ok: true,
    type: 'ofertas',
    url: finalUrl,
    page: Number(page),
    total: products.length,
    products
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
      pages.push({
        page,
        total: result.total,
        ok: true
      });

      logInfo('Página processada com sucesso', {
        page,
        total: result.total
      });
    } catch (error) {
      pages.push({
        page,
        total: 0,
        ok: false,
        error: error?.message || 'Erro desconhecido'
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
    products: deduped
  };
}
