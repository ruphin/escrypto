class DivisionByZeroError extends Error {}
class FormatError extends Error {}
class OverflowError extends Error {}

export class BigInt {
  constructor(arrayBuffer) {
    this.buffer = arrayBuffer;
  }

  // Serialize instances of this class as '[object BigInt]'
  get [Symbol.toStringTag]() {
    return 'BigInt';
  }

  static fromString(string) {
    return new BigInt(fromString(string));
  }

  static fromHex(hex) {
    return new BigInt(fromHex(hex));
  }

  get hex() {
    return toHex(this.buffer);
  }

  get string() {
    return toString(this.buffer);
  }
}

export const fromHex = hex => {
  // To be a valid hex string that encodes to bytes it must:
  //   Begin with '0x'
  //   Contain an even number of characters (two characters encode one byte)
  //   Contain only characters [0-9a-fA-F]
  const byteChars = hex.slice(2);
  if (hex.slice(0, 2) !== '0x' || hex.length % 2 !== 0 || byteChars.match(/[^0-9a-fA-F]/)) {
    throw new FormatError(`${hex} is not a valid hex string`);
  }
  return Uint8Array.from(byteChars.match(/.{2}/g), charPair => Number.parseInt(charPair, 16)).buffer;
};

export const toHex = buffer => {
  return `0x${Array.from(new Uint8Array(buffer), num => `0${num.toString(16)}`.slice(-2)).join('')}`;
};

// Uses UTF-8 encoding
export const fromString = string => {
  // Encode JavaScript String as UTF-8 code points (http://ecmanaut.blogspot.nl/2006/07/encoding-decoding-utf8-in-javascript.html)
  const utf8CodePoints = unescape(encodeURIComponent(string));
  // Create a buffer from UTF-8 code points
  return new Uint8Array(Array.from(utf8CodePoints, char => char.charCodeAt(0))).buffer;
};

// Throws a FormatError if the underlying buffer is not a valid UTF-8 encoding
export const toString = buffer => {
  // Read the UTF-8 code points from the buffer
  const utf8CodePoints = Array.from(new Uint8Array(buffer), num => String.fromCharCode(num)).join('');
  try {
    // Decode UTF-8 code points to JavaScript String
    return decodeURIComponent(escape(utf8CodePoints));
  } catch (e) {
    throw new FormatError(`${toHex(buffer)} is not a valid UTF-8 encoding`);
  }
};

// Pad `buffer` to a multiple of `n` bytes
const padToNBytes = (buffer, n) => {
  let underLength = (n - buffer.byteLength % n) % n;
  if (underLength !== 0) {
    const tmp = new Uint8Array(buffer.byteLength + underLength);
    tmp.set(new Uint8Array(buffer), underLength);
    buffer = tmp.buffer;
  }
  return buffer;
};

// Returns the order of magnitude of `buffer`, which is the magnitude of the highest bit that is set.
export const binaryMagnitude = buffer => {
  let length = 0;
  // Walk over all the bytes to find the first bit that is set
  new Uint8Array(buffer).some((byte, index) => {
    // If a byte is not zero, a bit must be set
    if (byte !== 0) {
      // The order of the set bit within the byte is floor(log2(byte)) + 1
      // The additional number of bits to the right is 8 * (length of the buffer - index of the byte - 1)
      length = 8 * (buffer.byteLength - index - 1) + Math.floor(Math.log2(byte)) + 1;
      return true;
    }
  });
  return length;
};

const trim = buffer => {
  // Number of leading zero bytes
  const zeroBytes = buffer.byteLength - Math.ceil(binaryMagnitude(buffer) / 8);
  return buffer.slice(zeroBytes);
};

// Left-shift the buffer by 1
const leftShift = buffer => {
  const sourceArray = new Uint8Array(buffer);

  // If the highest bit is set, we need a new array that is 1 byte longer for the carry bit
  let bytePadding = 0;
  if (sourceArray[0] >= 0x80) {
    bytePadding = 1;
  }
  const shiftedArray = new Uint8Array(buffer.byteLength + bytePadding);

  // Loop over the source array from the right, passing on the carry, storing the results in the shiftedArray
  sourceArray.reduceRight((carry, current, index) => {
    // Left-shift the current value and add the previous carry
    const shifted = (current << 1) + carry;
    // Because shiftedArray is an Uint8Array, the new carry bit is discarded in this store
    shiftedArray[index + bytePadding] = shifted;
    // Pass on the new carry bit
    return shifted >>> 8;
  }, 0);
  // If we added a byte for the carry bit, it only holds the carry bit.
  if (bytePadding === 1) {
    shiftedArray[0] = 1;
  }
  return shiftedArray.buffer;
};

export const mult = (bufferA, bufferB) => {
  // Output buffer is at least the length of both inputs combined
  let output = new ArrayBuffer(bufferA.byteLength + bufferB.byteLength);

  // Pad each buffer size to a multiple of 2 bytes for easy processing
  output = padToNBytes(output, 2);
  bufferA = padToNBytes(bufferA, 2);
  bufferB = padToNBytes(bufferB, 2);

  // Create views for each buffer
  const outputView = new DataView(output);
  const aView = new DataView(bufferA);
  const bView = new DataView(bufferB);

  // Storage for overflow carry bits
  let carry = 0;

  /*
    The 'outputIndex' refers to a 16-bit portion of the output buffer, from right-to-left, starting with 2.
    The given 16-bit value can be accessed with array.getUint16(array.byteLength - outputIndex)

    Ex. given this 8-byte array:
    -------------------------------------------------
    |  0  |  1  |  2  |  3  |  4  |  5  |  6  |  7  |
    -------------------------------------------------
    the outputIndexes are:
    -------------------------------------------------
    |  8        |  6        |  4        |  2        |
    -------------------------------------------------
    
    This loop calculates the values of each outputIndex
  */
  for (let outputIndex = 2; outputIndex <= output.byteLength; outputIndex += 2) {
    if (carry >= Number.MAX_SAFE_INTEGER) {
      // This can happen if (min(bufferA.byteLength, bufferB.byteLength) > 2**37)
      // Which is extremely unlikely since that would take over 300GB of memory
      // But we have to check to guarantee correctness
      throw new OverflowError('carry >= Number.MAX_SAFE_INTEGER');
    }

    // Storage for the value of this index. Start with the carry from the previous index
    // Invariant: sum may never exceed 0xFFFF (16 bits)
    // Sum is the lowest 16 bits of the carry
    let sum = carry % 0x10000;

    // The new carry is the remaining higher bits of the previous carry
    carry = Math.floor(carry / 0x10000);

    // For each pair of 16-bit values that multiplies into the index
    for (let pairIndex = Math.min(bufferA.byteLength, outputIndex); pairIndex >= 2 && outputIndex + 2 - pairIndex <= bufferB.byteLength; pairIndex -= 2) {
      // Multiply the 16-bit values and add the current sum into tmp
      // Invariant: tmp may never exceed 0xFFFFFFFF (32 bits)
      // Proof: (0xFFFF * 0xFFFF) + 0xFFFF = 0xFFFF0000
      const tmp = aView.getUint16(bufferA.byteLength - pairIndex, false) * bView.getUint16(bufferB.byteLength - (outputIndex + 2 - pairIndex), false) + sum;

      // The lower 16 bits of tmp are the new sum
      sum = tmp & 0xffff;

      // The upper 16 bits of tmp are added to the carry
      carry += tmp >>> 16;
    }
    // Write the resulting sum to the outputIndex in the output array
    outputView.setUint16(output.byteLength - outputIndex, sum, false);
  }
  return output;
};

export const add = (bufferA, bufferB) => {
  const output = new ArrayBuffer(Math.max(bufferA.byteLength, bufferB.byteLength));

  const outputView = new DataView(output);
  const aView = new DataView(bufferA);
  const bView = new DataView(bufferB);

  let carry = 0;

  for (let index = 1; index <= Math.min(bufferA.byteLength, bufferB.byteLength); index++) {
    const tmp = aView.getUint8(aView.byteLength - index) + bView.getUint8(bView.byteLength - index) + carry;

    outputView.setUint8(outputView.byteLength - index, tmp);
    carry = tmp >> 8;
  }

  if (bufferA.byteLength > bufferB.byteLength) {
    for (let index = bufferB.byteLength + 1; index <= output.byteLength; index++) {
      const tmp = aView.getUint8(aView.byteLength - index) + carry;

      outputView.setUint8(outputView.byteLength - index, tmp);
      carry = tmp >> 8;
    }
  } else {
    for (let index = bufferA.byteLength + 1; index <= output.byteLength; index++) {
      const tmp = bView.getUint8(bView.byteLength - index) + carry;

      outputView.setUint8(outputView.byteLength - index, tmp);
      carry = tmp >> 8;
    }
  }
  return { result: output, carry };
};

export const divmod = (numerator, denominator) => {
  if (denominator.byteLength === 0 || new Uint8Array(denominator).every(uint => uint === 0)) {
    throw new DivisionByZeroError();
  }
  if (denominator.byteLength > numerator.byteLength) {
    return { div: 0, mod: 0 }; // TODO: Return byte arrays
  }

  const num = new Uint32Array(padToNBytes(numerator, 4));
  const den = new Uint32Array(padToNBytes(denominator, 4));
  const div = new ArrayBuffer(numerator.byteLength - denominator.byteLength + 1);
  // mod is length of (denominator + 1) padded to a multiple of 4 bytes
  let mod = new ArrayBuffer(4 - (denominator.byteLength + 1) % 4 + (denominator.byteLength + 1));

  // TODO: Real code here
  for (let index = binaryMagnitude(numerator); index >= 0; index--) {
    mod = leftShift(mod);
    mod[-1] = numerator[index];
    if (gte(mod, denominator)) {
      mod = sub(mod, denominator);
      div[index] = 1;
    }
  }

  return { div, mod: mod.slice(1, -1) };
};

// Simple bufferUtil tests
const a = new Uint8Array([0x00, 0x00, 0x01, 0x01, 0xff, 0xff]).buffer;
const b = new Uint8Array([0xff, 0x0f, 0xff]).buffer;
console.log(toHex(a));
console.log(toHex(b));

const c = mult(a, b);
console.log(eval(`${toHex(a)} * ${toHex(b)}`));
console.log(eval(`${toHex(c)}`));

const d = add(a, b).result;
console.log(eval(`${toHex(a)} + ${toHex(b)}`));
console.log(eval(`${toHex(d)}`));

console.log(binaryMagnitude(a));
console.log(binaryMagnitude(b));
console.log(binaryMagnitude(new Uint8Array(1).buffer) === 0); // Test empty buffer
console.log(binaryMagnitude(new Uint8Array(0).buffer) === 0); // Test zero-length buffer

console.log(`${toHex(trim(a))}`);
console.log(`${toHex(trim(b))}`);

const utf8String = '한글';
console.log(utf8String);
console.log(BigInt.fromString(utf8String).string);

console.log(BigInt.fromString('\x00TEST').hex);

console.log(BigInt.fromHex('0x123ff8').hex);

console.log(toHex(leftShift(b)));

const e = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]).buffer;

const f = mult(e, e);
console.log(toHex(f));
console.log(eval(`${toHex(e)} * ${toHex(e)}`));
console.log(eval(`${toHex(f)}`));

// console.log(divmod(a, b));
