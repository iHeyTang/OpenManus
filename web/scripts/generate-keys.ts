import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KEYS_DIR = path.join(process.cwd(), 'keys');

if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR);
}

function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
}

const { publicKey, privateKey } = generateKeyPair();

fs.writeFileSync(path.join(KEYS_DIR, 'public.pem'), publicKey);
fs.writeFileSync(path.join(KEYS_DIR, 'private.pem'), privateKey);

console.log('RSA key pair generated successfully!');
console.log('Public key saved to: keys/public.pem');
console.log('Private key saved to: keys/private.pem');
