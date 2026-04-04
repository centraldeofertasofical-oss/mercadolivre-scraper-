import { slugify, cleanUrl } from './normalize.js';

export function isValidProduct(product) {
  if (!product) return false;
  if (!product.PRODUTO) return false;
  if (!product.LINK_ORIGINAL) return false;
  if (!product.GROUP_ID) return false;
  if (!product.PRECO_POR || product.PRECO_POR <= 0) return false;
  return true;
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

    const score = (p) =>
      (p.CATALOG_ID ? 100 : 0) +
      (p.ID?.startsWith('MLB') ? 20 : 0) +
      (p.PAGINA ? Math.max(0, 20 - p.PAGINA) : 0);

    if (score(product) > score(current)) {
      grouped.set(key, product);
    }
  }

  return Array.from(grouped.values());
}
