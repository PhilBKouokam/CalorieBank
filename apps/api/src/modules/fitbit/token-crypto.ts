import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) throw new Error('FITBIT_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.');
  return key;
}

export function encryptFitbitSecret(value: string, encodedKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptFitbitSecret(value: string, encodedKey: string) {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('Encrypted Fitbit value is malformed.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(encodedKey), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
