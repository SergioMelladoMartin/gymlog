// AES-256-GCM helpers built on Web Crypto only (no crypto dependency).
// Used to encrypt the Google refresh token before it goes into the
// `gymlog_rt` cookie. The key is derived from AUTH_COOKIE_SECRET via
// SHA-256 so the env var can be any random base64 string of sufficient
// entropy (see README "Sesión y backend").

const IV_BYTES = 12; // 96-bit IV, the size AES-GCM is designed for.

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Encrypts `plaintext` with AES-256-GCM. Returns `<iv>.<ciphertext+tag>`,
 *  both base64url, safe to store in a cookie value. */
export async function encryptString(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipherBuf))}`;
}

/** Inverse of encryptString. Throws if the token is malformed or the tag
 *  doesn't verify (tampered / wrong key). */
export async function decryptString(token: string, secret: string): Promise<string> {
  const [ivPart, cipherPart] = token.split('.');
  if (!ivPart || !cipherPart) throw new Error('malformed encrypted token');
  const key = await deriveKey(secret);
  const iv = fromBase64Url(ivPart);
  const cipherBytes = fromBase64Url(cipherPart);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

/** Cryptographically random URL-safe string, for the OAuth `state` param
 *  and similar one-off nonces. */
export function randomToken(bytes = 24): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Constant-time string comparison — avoids leaking `state` validity via
 *  timing when checking the callback's query param against the cookie. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
