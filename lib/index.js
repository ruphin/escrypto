import { stringToBuffer, bufferToHex } from './util.js';
import { log } from './log.js';

export const mnemonicToSeed = mnemonic => {
  const mBuffer = stringToBuffer(mnemonic.normalize('NFKD'));
  const saltBuffer = stringToBuffer('mnemonic');
  return pbkdf2(mBuffer, saltBuffer, 2048, 64, 'SHA-512');
};

/*
  password: ArrayBuffer
  salt: ArrayBuffer
  iterations: integer
  keylength: integer - keylength in bytes
  hash: "SHA-1" || " SHA-256" || "SHA-384" || "SHA-512"
*/
const pbkdf2 = (password, salt, iterations, keylength, hash) => {
  return window.crypto.subtle.importKey('raw', password, { name: 'PBKDF2' }, false, ['deriveBits']).then(function(key) {
    return window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash }, key, keylength * 8);
  });
};

mnemonicToSeed('seminar chapter neglect dress swear uniform gesture robot wood join someone harsh ring hub old').then(a => log(bufferToHex(a)));
