import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'vk-scheduler-secret-key-2024-very-secure';
const COOKIE_NAME = 'vk-scheduler-session';

export { COOKIE_NAME };

// Password hashing using Node.js crypto (scrypt) — no external deps needed
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex') === key);
    });
  });
}

export function createSessionToken(user: { id: string; email: string; role?: string }): string {
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role || 'user',
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SESSION_SECRET, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

export function verifySessionToken(token: string): { id: string; email: string; role: string } | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.scryptSync(SESSION_SECRET, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const payload = JSON.parse(decrypted);

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    return { id: payload.id, email: payload.email, role: payload.role || 'user' };
  } catch {
    return null;
  }
}
