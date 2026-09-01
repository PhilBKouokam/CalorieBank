import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key(value: string) {
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32) throw new Error('Google Health token encryption key must decode to 32 bytes.');
  return decoded;
}

export function validateGoogleHealthEncryptionKey(encodedKey: string) {
  key(encodedKey);
}

export function encryptGoogleHealthSecret(value: string, encodedKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptGoogleHealthSecret(value: string, encodedKey: string) {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('Encrypted Google Health value is malformed.');
  const decipher = createDecipheriv('aes-256-gcm', key(encodedKey), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
