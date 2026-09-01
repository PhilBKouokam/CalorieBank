import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function decodeKey(value: string) {
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32) throw new Error('Provider token encryption key must decode to 32 bytes.');
  return decoded;
}

export function validateProviderTokenEncryptionKey(value: string) {
  decodeKey(value);
}

export function encryptProviderSecret(value: string, encodedKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', decodeKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptProviderSecret(value: string, encodedKey: string) {
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('Encrypted provider value is malformed.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    decodeKey(encodedKey),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
