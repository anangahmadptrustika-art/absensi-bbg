import crypto from 'crypto';

/**
 * Hash password/PIN dengan scrypt + salt acak.
 * Format tersimpan: scrypt:<salt-hex>:<hash-hex>
 */
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(secret, salt, 32);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function scryptAsync(secret: string, salt: Buffer, len: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(secret, salt, len, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/**
 * Verifikasi memakai scrypt versi async agar banjir percobaan login
 * tidak memblokir event loop server.
 */
export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  try {
    const [scheme, saltHex, hashHex] = stored.split(':');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scryptAsync(secret, salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Hash tiruan untuk menyamakan waktu respons saat akun tidak ditemukan,
 * supaya penyerang tidak bisa menebak NIK/username yang valid dari timing.
 */
export const DUMMY_HASH = hashSecret('dummy-timing-equalizer');

export function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Password acak yang mudah disalin (tanpa karakter membingungkan seperti 0/O, 1/l). */
export function randomPassword(length = 12): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
