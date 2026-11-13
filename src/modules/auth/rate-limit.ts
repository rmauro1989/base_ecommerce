/**
 * Límite simple en memoria contra fuerza bruta en el login
 * (suficiente para un solo servicio en Railway).
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function tooManyAttempts(key: string, max = 8, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
