# MercadoLivre Scraper

Scraper do Mercado Livre em Node.js para integração com Railway e n8n.

## Rotas

### Healthcheck
GET `/health`

### Ofertas por página
GET `/scrape/mercadolivre/ofertas?page=1`

### Ofertas em lote
GET `/scrape/mercadolivre/ofertas?start=1&end=20`

## Estrutura
- `server.js`: sobe a API
- `src/routes`: rotas HTTP
- `src/scrapers`: scraping e parsing
- `src/utils`: funções auxiliares
- `src/config`: configurações
