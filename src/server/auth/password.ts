import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// Параметры хранятся в самой строке хеша, поэтому их можно поднимать, не ломая старые пароли
const PARAMS = { N: 2 ** 15, r: 8, p: 3 };
// Без явного maxmem N=2^15 при r=8 даёт ошибку превышения памяти
const MAXMEM = 128 * 1024 * 1024;
const KEY_LENGTH = 64;

// Формат: scrypt$N$r$p$соль$хеш (соль и хеш в base64)
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAXMEM });
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

// Битая или чужая строка хеша — просто false, без исключения
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  if (expected.length === 0) return false;
  let actual: Buffer;
  try {
    actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });
  } catch {
    // Параметры вне допустимого диапазона
    return false;
  }
  // timingSafeEqual бросает RangeError при разной длине, поэтому длины сверяются заранее
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Хеш с теми же параметрами для неизвестного логина: проверка пароля занимает столько же
// времени, и по ответу нельзя отличить «нет такого логина» от «неверный пароль»
export const DUMMY_HASH =
  'scrypt$32768$8$3$iNHeFLXQAT5D10Lm9S/85g==$TnAJsbL2YpF2VpxJ78SUaTlJUbozpHWAKp/WwPU1m1mbKu+OpDPFbfdEZugfpy3tnQvu4V3lIrfRy5kRwFqMbg==';
