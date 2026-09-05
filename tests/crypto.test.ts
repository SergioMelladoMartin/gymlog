import { describe, expect, it } from 'vitest';
import { decryptString, encryptString, randomToken, timingSafeEqual } from '../src/lib/server/crypto';

describe('AES-256-GCM round trip', () => {
  it('encrypts and decrypts back to the original plaintext', async () => {
    const secret = 'a-very-secret-value-used-only-in-tests';
    const plaintext = '1//0gAbCdEfGhIjKlMnOpQrStUvWxYz-refresh-token';
    const encrypted = await encryptString(plaintext, secret);
    expect(encrypted).not.toEqual(plaintext);
    expect(encrypted).toContain('.');

    const decrypted = await decryptString(encrypted, secret);
    expect(decrypted).toEqual(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', async () => {
    const secret = 'another-secret-for-tests-0123456789';
    const a = await encryptString('same-plaintext', secret);
    const b = await encryptString('same-plaintext', secret);
    expect(a).not.toEqual(b);
  });

  it('fails to decrypt with the wrong secret', async () => {
    const encrypted = await encryptString('hello world', 'secret-one-123456789012345678901234');
    await expect(decryptString(encrypted, 'secret-two-123456789012345678901234')).rejects.toThrow();
  });

  it('fails to decrypt a tampered token', async () => {
    const secret = 'tamper-test-secret-0123456789012345';
    const encrypted = await encryptString('hello world', secret);
    const [iv, cipher] = encrypted.split('.');
    // Flip a character in the ciphertext half to invalidate the GCM tag.
    const tamperedChar = cipher[0] === 'A' ? 'B' : 'A';
    const tampered = `${iv}.${tamperedChar}${cipher.slice(1)}`;
    await expect(decryptString(tampered, secret)).rejects.toThrow();
  });

  it('rejects a malformed token', async () => {
    await expect(decryptString('not-a-valid-token', 'secret-0123456789012345678901234567')).rejects.toThrow();
  });
});

describe('randomToken', () => {
  it('produces url-safe strings of varying value', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('timingSafeEqual', () => {
  it('returns true only for equal strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});
