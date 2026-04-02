import express from 'express';
import {
  scrapeMercadoLivreOffers,
  scrapeMercadoLivreOffersRange
} from '../scrapers/mercadolivre.js';
import { logError, logInfo } from '../utils/logger.js';

const router = express.Router();

router.get('/ofertas', async (req, res) => {
  try {
    const { page, start, end } = req.query;

    if (start || end) {
      const startPage = Number(start || 1);
      const endPage = Number(end || startPage);

      logInfo('Nova requisição Mercado Livre Ofertas Range', {
        start: startPage,
        end: endPage
      });

      const result = await scrapeMercadoLivreOffersRange({
        start: startPage,
        end: endPage
      });

      return res.status(200).json(result);
    }

    const currentPage = Number(page || 1);

    logInfo('Nova requisição Mercado Livre Ofertas', {
      page: currentPage
    });

    const result = await scrapeMercadoLivreOffers({
      page: currentPage
    });

    return res.status(200).json(result);
  } catch (error) {
    logError('Erro no scraping de ofertas do Mercado Livre', error?.message || error);

    return res.status(500).json({
      ok: false,
      error: error?.message || 'Erro interno no scraping'
    });
  }
});

export default router;
