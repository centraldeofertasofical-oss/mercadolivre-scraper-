export function logInfo(message, extra = null) {
  if (extra) {
    console.log(`[INFO] ${message}`, extra);
    return;
  }
  console.log(`[INFO] ${message}`);
}

export function logError(message, error = null) {
  if (error) {
    console.error(`[ERROR] ${message}`, error);
    return;
  }
  console.error(`[ERROR] ${message}`);
}
