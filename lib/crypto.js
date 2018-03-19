const subtle = window.crypto.subtle;

/*
  passphrase: ArrayBuffer
  salt: ArrayBuffer
  iterations: integer
  keylength: integer - keylength in bits
  hash: "SHA-1" || " SHA-256" || "SHA-384" || "SHA-512"
*/
export const pbkdf2 = ({ passphrase, salt, iterations, keyLength, hash }) =>
  subtle
    .importKey('raw', passphrase, { name: 'PBKDF2' }, false, ['deriveBits'])
    .then(key => subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash }, key, keyLength));

export const hmac = ({ key, data, hash }) =>
  subtle.importKey('raw', key, { name: 'HMAC', hash }, true, ['sign']).then(key => subtle.sign({ name: 'HMAC' }, key, data));
