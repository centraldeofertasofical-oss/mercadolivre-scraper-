export function cleanText(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

export function toNumberBR(value) {
  if (value === null || value === undefined || value === '') return null;

  const cleaned = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const number = Number(cleaned);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

export function cleanUrl(url = '') {
  return String(url || '').split('?')[0].trim();
}

export function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

export function extractIdsFromUrl(url = '') {
  const clean = cleanUrl(url);

  const catalogMatch = clean.match(/\/p\/(MLB\d+)/i);
  const listingMatch = clean.match(/MLB-?(\d{6,})/i);
  const upMatch = clean.match(/(MLBU\d+)/i);

  return {
    catalogId: catalogMatch ? catalogMatch[1].toUpperCase() : null,
    listingId: listingMatch ? `MLB${listingMatch[1]}` : null,
    upId: upMatch ? upMatch[1].toUpperCase() : null,
  };
}

export function normalizeMercadoLivreLink(url = '', title = '', image = '') {
  const clean = cleanUrl(url);
  const { catalogId, listingId, upId } = extractIdsFromUrl(clean);

  let canonicalId = null;
  let canonicalLink = clean;

  // prioridade máxima: catálogo /p/MLB...
  if (catalogId) {
    canonicalId = catalogId;
    canonicalLink = `https://www.mercadolivre.com.br/p/${catalogId}`;
  } else if (listingId) {
    canonicalId = listingId;
    canonicalLink = `https://produto.mercadolivre.com.br/${listingId.replace('MLB', 'MLB-')}`;
  } else {
    // MLBU nunca será o ID principal
    canonicalId = null;
    canonicalLink = clean;
  }

  let groupId = catalogId || listingId || null;

  // fallback estável quando só existe MLBU ou nenhum MLB confiável
  if (!groupId) {
    const titleKey = slugify(title).slice(0, 60) || 'sem-titulo';
    const imageKey =
      cleanUrl(image).split('/').pop()?.replace(/\.[a-z]+$/i, '') || 'sem-imagem';

    groupId = `MLGROUP-${titleKey}-${imageKey}`;
  }

  return {
    canonicalId,
    canonicalLink,
    groupId,
    variationId: upId || listingId || null,
    catalogId: catalogId || null,
    rawIds: { catalogId, listingId, upId },
  };
}

export function extractMLB(link = '') {
  const normalized = normalizeMercadoLivreLink(link);
  return normalized.canonicalId || null;
}
