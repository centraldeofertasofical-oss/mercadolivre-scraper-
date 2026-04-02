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

export function extractMLB(link = '') {
  const match = String(link).match(/MLB-?(\d+)/i);
  return match ? `MLB${match[1]}` : null;
}
