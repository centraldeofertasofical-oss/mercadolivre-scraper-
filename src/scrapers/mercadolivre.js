import axios from 'axios';
import * as cheerio from 'cheerio';
import { buildHeaders } from '../utils/headers.js';
import { cleanText, toNumberBR, extractMLB } from '../utils/normalize.js';
import { isValidProduct, dedupeProducts } from '../utils/validator.js';
import { settings } from '../config/settings.js';

function buildSearchUrl(query, page = 1) {
  const term = String(query || '')
    .trim()
    .replace(/\s+/g, '-');

  if (!term) return null;

  if (page <= 1) {
    return `https://lista.mercadolivre.com.br/${term}`;
  }

  const from = ((page - 1) * 48) + 1;
  return `https://lista.mercadolivre.com.br/${term}_Desde_${from}`;
}

function parseProducts(html, sourceUrl) {
  const $ = cheerio.load(html);
  const products = [];

  $('li.ui-search-layout__item').each((_, el) => {
    const title =
      cleanText($(el).find('h3, .poly-component__title').first().text()) || null;

    const link =
      $(el).find('a.poly-component__title, a[href*="MLB"]').first().attr('href') || null;

    const image =
      $(el).find('img').first().attr('src') ||
      $(el).find('img').first().attr('data-src') ||
      null;

    const priceFraction =
      cleanText($(el).find('.andes-money-amount__fraction').first().text()) || null;

    const priceCents =
      cleanText($(el).find('.andes-money-amount__cents').first().text()) || null;

    const oldPrice =
      cleanText($(el).find('.andes-money-amount--previous .andes-money-amount__fraction').first().text()) || null;

    const discount =
      cleanText($(el).find('.andes-money-amount__discount, .ui-search-price__discount').first().text()) || null;

    let currentPrice = null;
    if (priceFraction) {
      currentPrice = toNumberBR(priceCents ? `${priceFraction},${priceCents}` : priceFraction);
    }

    const previousPrice = oldPrice ? toNumberBR(oldPrice) : null;

    const product = {
      ID: extractMLB(link),
      PLATAFORMA: 'Mercado Livre',
      PRODUTO: title,
      LINK_ORIGINAL: link,
      LINK_AFILIADO: null,
      LINK_IMAGEM: image,
      PRECO_DE: previousPrice,
      PRECO_POR: currentPrice,
      DESCONTO_PCT: discount || null,
      URL_COLETA: sourceUrl,
      DATA_COLETA: new Date().toISOString()
    };

    if (isValidProduct(product)) {
      products.push(product);
    }
  });

  return dedupeProducts(products);
}

export async function scrapeMercadoLivre({ query, page = 1, url }) {
  const finalUrl = url || buildSearchUrl(query, Number(page));

  if (!finalUrl) {
    throw new Error('Informe query ou url para scraping');
  }

  const response = await axios.get(finalUrl, {
    headers: buildHeaders(),
    timeout: settings.requestTimeout
  });

  const products = parseProducts(response.data, finalUrl);

  return {
    ok: true,
    url: finalUrl,
    page: Number(page),
    total: products.length,
    products
  };
}
