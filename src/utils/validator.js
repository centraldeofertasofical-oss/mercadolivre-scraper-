import { slugify, cleanUrl } from './normalize.js';

export function isValidProduct(product) {
  if (!product) return false;
  if (!product.PRODUTO) return false;
  if (!product.LINK_ORIGINAL) return false;
  if (!product.GROUP_ID) return false;
  if (product.PRECO_POR === null || product.PRECO_POR === undefined) return false;
  if (product.PRECO_POR <= 0) return false;
  return true;
}

function scoreProduct(product) {
  let score = 0;

  // prioridade para catálogo
  if (product.CATALOG_ID) score += 100;

  // depois anúncio MLB
  if (product.ID && /^MLB\d+$/i.test(product.ID)) score += 25;

  // menor preço ganha dentro do mesmo grupo
  if (product.PRECO_POR && product.PRECO_POR > 0) {
    score += 50 / product.PRECO_POR;
  }

  // páginas menores tendem a aparecer antes
  if (product.PAGINA) {
    score += Math.max(0, 20 - Number(product.PAGINA));
  }

  return score;
}

export function dedupeProducts(products = []) {
  const grouped = new Map();

  for (const product of products) {
    const key =
      product.GROUP_ID ||
      product.CATALOG_ID ||
      product.ID ||
      `${slugify(product.PRODUTO)}::${cleanUrl(product.LINK_IMAGEM)}`;

    if (!key) continue;

    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, product);
      continue;
    }

    if (scoreProduct(product) > scoreProduct(current)) {
      grouped.set(key, product);
    }
  }

  return Array.from(grouped.values());
}
