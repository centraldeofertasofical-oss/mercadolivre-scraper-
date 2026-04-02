import express from 'express';
import dotenv from 'dotenv';
import mercadolivreRoute from './src/routes/mercadolivre.js';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'mercadolivre-scraper',
    timestamp: new Date().toISOString()
  });
});

app.use('/scrape/mercadolivre', mercadolivreRoute);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Rota não encontrada'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
