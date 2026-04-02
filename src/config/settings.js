export const settings = {
  requestTimeout: Number(process.env.REQUEST_TIMEOUT || 20000),
  maxProductsPerPage: Number(process.env.MAX_PRODUCTS_PER_PAGE || 50),
  defaultUserAgent:
    process.env.DEFAULT_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
};
