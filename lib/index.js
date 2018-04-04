import { log } from './log.js';
import { pbkdf2, hmac } from './crypto.js';
import * as bufferUtil from './bufferUtil.js';

const HARDENED_KEY_INDEX = 0x80000000; // (2^31)
const BITCOIN_SEED = bufferUtil.fromString('Bitcoin seed');

export const seedToKey = seed => {
  const hmacResult = hmac({ key: BITCOIN_SEED, data: seed, hash: 'SHA-512' });
  return hmacResult;
};

export const mnemonicToSeed = mnemonic => {
  const passphrase = bufferUtil.fromString(mnemonic.normalize('NFKD'));
  const salt = bufferUtil.fromString('mnemonic');
  return pbkdf2({ passphrase, salt, iterations: 2048, keyLength: 512, hash: 'SHA-512' });
};

const derive = ({ privateKey, chainCode }, index) => {
  const hardened = index >= HARDENED_KEY_INDEX;

  let data;
  let childKey;
  let childChainCode;
  if (hardened) {
    data = new Uint8Array(37);
    data[0] = 0x00; // First byte is 0x00
    data.set(privateKey, 1); // Next 32 bytes are the old key
    new DataView(data.buffer).setUint32(33, index, false); // Last four bytes are big-endian encoded index

    let hash = hmac({ key: chainCode, data, hash: 'SHA-512' });

    // TODO: Remove this return and make below code work
    return hash;

    childKey = bufferUtil.mod(bufferUtil.sum(hash.slice(0, 32), privateKey), secp256k1.n);
    childChainCode = hash.slice(32, 64);
  } else {
    // TODO: Figure out this part

    // data = new UInt8Array(36);
    // const publicKey = secp256k1.G.multiply(privateKey);
    // data.set(privateKey, 0); // First 32 bytes are the old key
    // new DataView(data.buffer).setUint32(32, index, false); // Last four bytes are big-endian encoded index

    return 'NO';

    let hash = hmac({ key: chainCode, data, hash: 'SHA-512' });
    childKey = bufferUtil.mod(bufferUtil.sum(hash.slice(0, 32), privateKey), secp256k1.n);
    childChainCode = hash.slice(32, 64);
  }
  // TODO: this thing
  // if(childKey === 0 || childKey >= secp256k1.n) {
  //   return derive(.., index+1)
  // }

  return { childKey, chainCode: childChainCode };
};

// Keychain privkey derivation test
mnemonicToSeed('idea three clap strategy wink clerk output behave dizzy company truth sentence west clarify body')
  .then(seedToKey)
  .then(extendedKey => {
    const privateKey = new Uint8Array(extendedKey.slice(0, 32));
    const chainCode = new Uint8Array(extendedKey.slice(32));
    console.log('PRIVKEY', privateKey);
    console.log('CHAINCODE', chainCode);
    return derive({ privateKey, chainCode }, 44 + 2 ** 31);
  })
  .then(extendedKey => {
    const privateKey = new Uint8Array(extendedKey.slice(0, 32));
    const chainCode = new Uint8Array(extendedKey.slice(32));
    console.log('DERIVED_PRIVKEY', privateKey);
    console.log('DERIVED_CHAINCODE', chainCode);
    return derive({ privateKey, chainCode }, 60 + 2 ** 31);
  })
  .then(extendedKey => {
    const privateKey = new Uint8Array(extendedKey.slice(0, 32));
    const chainCode = new Uint8Array(extendedKey.slice(32));
    console.log('DERIVED_PRIVKEY2', privateKey);
    console.log('DERIVED_CHAINCODE2', chainCode);
  });
