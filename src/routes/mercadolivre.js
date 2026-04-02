import express from 'express';
import { scrapeMercadoLivre } from '../scrapers/mercadolivre.js';
import { logError, logInfo } from '../utils/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { query, page, url } = req.query;

    logInfo('Nova requisição Mercado Livre', { query, page, url });

    const result = await scrapeMercadoLivre({
      query,
      page: page ? Number(page) : 1,
      url
    });

    return res.status(200).json(result);
  } catch (error) {
    logError('Erro no scraping do Mercado Livre', error?.message || error);

    return res.status(500).json({
      ok: false,
      error: error?.message || 'Erro interno no scraping'
    });
  }
});

export default router;
