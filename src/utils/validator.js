export function isValidProduct(product) {
  if (!product) return false;
  if (!product.PRODUTO) return false;
  if (!product.LINK_ORIGINAL) return false;
  if (product.PRECO_POR === null || product.PRECO_POR === undefined) return false;
  return true;
}

export function dedupeProducts(products = []) {
  const seen = new Set();

  return products.filter((product) => {
    const key = product.ID || product.LINK_ORIGINAL;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
