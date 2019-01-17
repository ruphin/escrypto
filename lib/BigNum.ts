class DivisionByZeroError extends Error {}
class FormatError extends Error {}
class OverflowError extends Error {}
const BIG_ENDIAN = false;

type Endianness = 'le' | 'be';
type Sign = 'pos' | 'neg';

export class BigNum {
  sign: Sign;
  buffer: ArrayBuffer;
  endian: Endianness;

  constructor(number: number | string | ArrayBuffer, base: number = 16, endian: Endianness = 'le') {
    if (number instanceof ArrayBuffer) {
      this.buffer = number;
    } else if (typeof number === 'number') {
      [this.buffer, this.sign] = BigNum.fromNumber(number);
    } else if (typeof number === 'string') {
      [this.buffer, this.sign] = BigNum.fromString(number, base);
    } else {
      throw `invalid constructor argument: ${number}`;
    }
    this.endian = endian;
  }

  // Serialize instances of this class as '[object Uint]'
  get [Symbol.toStringTag]() {
    return 'BigNum';
  }

  static fromUTF(string) {
    return new Uint(fromUTF(string));
  }

  static fromString = (numberString: string, base: number = 10, endian: Endianness = 'le'): BigNum => {
    let sign: Sign = 'pos';
    if (base !== 16) {
      throw 'Only base 16 strings supported for now';
    }
    if (numberString[0] === '-') {
      sign = 'neg';
    }
    // To be a valid hex string that encodes to bytes it must:
    //   Contain only characters [0-9a-fA-F]
    if (numberString.match(/[^0-9a-fA-F]/)) {
      throw new FormatError(`${numberString} is not a valid number string`);
    }
    // If the hex string is uneven length, pad it with a 0
    if (numberString.length & 1) {
      numberString = '0' + numberString;
    }
    // Split the hex string into character pairs. Each character pair represents one byte.
    const buffer = Uint8Array.from(numberString.match(/../g).map(charPair => Number.parseInt(charPair, 16))).buffer;

    return new BigNum(buffer);
    return [buffer, sign];
  };

  static fromNumber = (number: number) => {
    if (number < Number.MIN_SAFE_INTEGER || number > Number.MAX_SAFE_INTEGER) {
      throw 'Number outside safe integer bounds';
    }
    return BigNum.fromString(number.toString(16), 16);
  };

  add(other) {
    return new Uint(add(this.buffer, other.buffer));
  }

  iadd(other) {
    this.buffer = add(this.buffer, other.buffer);
    return this;
  }

  mul(other) {
    return new Uint(mul(this.buffer, other.buffer));
  }

  imul(other) {
    this.buffer = mul(this.buffer, other.buffer);
    return this;
  }

  eq(other) {
    return eq(this.buffer, other.buffer);
  }

  get hex() {
    return toHex(this.buffer);
  }

  get utf() {
    return toUTF(this.buffer);
  }

  bitLength(): number;
  zeroBits(): number;
  byteLength(): number;
  isNeg(): boolean;
  isEven(): boolean;
  isOdd(): boolean;
  isZero(): boolean;
  cmp(b: any): number;
  lt(b: any): boolean;
  lte(b: any): boolean;
  gt(b: any): boolean;
  gte(b: any): boolean;
  eq(b: any): boolean;
}

export const toHex = buffer => {
  return Array.from(new Uint8Array(buffer), num => `0${num.toString(16)}`.slice(-2)).join('') || '0';
};

export const toBinary = buffer => {
  return Array.from(new Uint8Array(buffer), num => `0000000${num.toString(2)}`.slice(-8)).join('') || '00000000';
};

// Uses UTF-8 encoding
export const fromUTF = string => {
  // Encode JavaScript String as UTF-8 code points (http://ecmanaut.blogspot.nl/2006/07/encoding-decoding-utf8-in-javascript.html)
  const utf8CodePoints = unescape(encodeURIComponent(string));
  // Create a buffer from UTF-8 code points
  return new Uint8Array(Array.from(utf8CodePoints, char => char.charCodeAt(0))).buffer;
};

// Throws a FormatError if the underlying buffer is not a valid UTF-8 encoding
export const toUTF = buffer => {
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
  let underLength = (n - (buffer.byteLength % n)) % n;
  if (underLength !== 0) {
    const tmp = new Uint8Array(buffer.byteLength + underLength);
    tmp.set(new Uint8Array(buffer), underLength);
    buffer = tmp.buffer;
  }
  return buffer;
};

// Returns the order of the highest bit that is set
export const bitLength = buffer => {
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

// Trim all leading zero bytes from the buffer
const trim = buffer => {
  const zeroBytes = buffer.byteLength - Math.ceil(bitLength(buffer) / 8);
  return buffer.slice(zeroBytes);
};

// Left-shift the buffer by 1 (default 1)
// Requires that n <= 24 to avoid integer overflow
const leftShift = (buffer, n = 1) => {
  // Clone the buffer
  let bufferClone = new Uint8Array(new Uint8Array(buffer)).buffer;
  // Left shift the cloned buffer in place
  let carry = leftShiftI(bufferClone, n);

  if (carry) {
    const overflowBytes = ((Math.log2(carry) / 8) | 0) + 1;
    const tmp = new Uint8Array(buffer.byteLength + overflowBytes);
    // Prepend the overflow
    tmp.set(new Uint8Array(bufferClone), overflowBytes);
    for (let i = overflowBytes - 1; i >= 0; i--) {
      tmp[i] = carry & 0xff;
      carry >>>= 8;
    }
    bufferClone = tmp.buffer;
  }

  return bufferClone;
};

// Left-shift the buffer by n (default 1), in place
// Requires that n <= 24 to avoid integer overflow
const leftShiftI = (buffer, n = 1) => {
  if (n > 24) {
    throw Error('Cannot left-shift by more than 24 places');
  }
  const array = new Uint8Array(buffer);
  let carry = 0;

  // Loop over the buffer from right to left
  for (let i = buffer.byteLength; i >= 0; i--) {
    // Left-shift the value and add to the carry
    carry += array[i] << n;
    // Store the lower 8 bits of the value back
    array[i] = carry & 0xff;
    // The remaining bits are the new carry
    carry >>>= 8;
  }

  return carry;
};

// TODO: Multiplication under modulo
const modMul = (bufferA, bufferB, bufferMod) => {
  let result = new ArrayBuffer(bufferMod.byteLength);
};

export const mul = (bufferA, bufferB) => {
  // Result buffer is at least the length of both inputs combined
  let result = new ArrayBuffer(bufferA.byteLength + bufferB.byteLength);

  // Pad each buffer size to a multiple of 2 bytes for easy processing
  result = padToNBytes(result, 2);
  bufferA = padToNBytes(bufferA, 2);
  bufferB = padToNBytes(bufferB, 2);

  // Create views for each buffer
  const resultView = new DataView(result);
  const aView = new DataView(bufferA);
  const bView = new DataView(bufferB);

  // Storage for overflow carry bits
  let carry = 0;

  /*
    The 'resultIndex' refers to a 16-bit portion of the result buffer, from right-to-left, starting with 2.
    The given 16-bit value can be accessed with array.getUint16(array.byteLength - resultIndex)

    Ex. given this 8-byte array:
    -------------------------------------------------
    |  0  |  1  |  2  |  3  |  4  |  5  |  6  |  7  |
    -------------------------------------------------
    the resultIndexes are:
    -------------------------------------------------
    |  8        |  6        |  4        |  2        |
    -------------------------------------------------
    
    This loop calculates the values of each resultIndex
  */
  for (let resultIndex = 2; resultIndex <= result.byteLength; resultIndex += 2) {
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
    for (let pairIndex = Math.min(bufferA.byteLength, resultIndex); pairIndex >= 2 && resultIndex + 2 - pairIndex <= bufferB.byteLength; pairIndex -= 2) {
      // Multiply the 16-bit values and add the current sum into tmp
      // Invariant: tmp may never exceed 0xFFFFFFFF (32 bits)
      // Proof: (0xFFFF * 0xFFFF) + 0xFFFF = 0xFFFF0000
      const tmp =
        aView.getUint16(bufferA.byteLength - pairIndex, BIG_ENDIAN) * bView.getUint16(bufferB.byteLength - (resultIndex + 2 - pairIndex), BIG_ENDIAN) + sum;

      // The lower 16 bits of tmp are the new sum
      sum = tmp & 0xffff;

      // The upper 16 bits of tmp are added to the carry
      carry += tmp >>> 16;
    }
    // Write the resulting sum to the resultIndex in the result array
    resultView.setUint16(result.byteLength - resultIndex, sum, BIG_ENDIAN);
  }
  return result;
};

// This implements three-way comparison (also known as <=> or 'spaceship' operator)
// Returns -1, 0, or 1
const spaceShip = (bufferA, bufferB) => {
  const arrayA = new Uint8Array(bufferA);
  const arrayB = new Uint8Array(bufferB);
  const lengthDifference = Math.abs(bufferA.byteLength - bufferB.byteLength);

  // longArray is the longer of arrayA and arrayB
  // shortArray is the shorter of arrayA and arrayB
  // LongArrayIsBufferA === true if longArray.buffer === bufferA
  let shortArray = arrayA;
  let longArray = arrayB;
  let LongArrayIsBufferA = false;
  if (bufferA.byteLength > bufferB.byteLength) {
    shortArray = arrayB;
    longArray = arrayA;
    LongArrayIsBufferA = true;
  }

  // Loop over bytes in the long array, starting with the most significant byte
  for (let i = 0; i < longArray.length; i++) {
    // If the short array has no matching byte
    if (i < lengthDifference) {
      // And the long array is non-zero
      if (longArray[i] !== 0) {
        // The long array is larger
        return LongArrayIsBufferA ? 1 : -1;
      }
      // If the short array has a matching byte, and they are not equal
    } else if (longArray[i] !== shortArray[i - lengthDifference]) {
      // The array with the largest byte is larger
      return longArray[i] > shortArray[i - lengthDifference] === LongArrayIsBufferA ? 1 : -1;
    }
  }
  // All bytes are equal
  return 0;
};

export const eq = (bufferA, bufferB) => {
  return spaceShip(bufferA, bufferB) === 0;
};

export const gt = (bufferA, bufferB) => {
  return spaceShip(bufferA, bufferB) > 0;
};

export const lt = (bufferA, bufferB) => {
  return spaceShip(bufferA, bufferB) < 0;
};

export const gte = (bufferA, bufferB) => {
  return spaceShip(bufferA, bufferB) >= 0;
};

export const lte = (bufferA, bufferB) => {
  return spaceShip(bufferA, bufferB) <= 0;
};

export const add = (bufferA, bufferB) => {
  const resultArray = new Uint8Array(Math.max(bufferA.byteLength, bufferB.byteLength));
  const arrayA = new Uint8Array(bufferA);
  const arrayB = new Uint8Array(bufferB);
  const lengthDifference = Math.abs(bufferA.byteLength - bufferB.byteLength);

  // longArray is the longer of arrayA and arrayB
  // shortArray is the shorter of arrayA and arrayB
  let shortArray, longArray;
  if (bufferA.byteLength > bufferB.byteLength) {
    [shortArray, longArray] = [arrayB, arrayA];
  } else {
    [shortArray, longArray] = [arrayA, arrayB];
  }

  // Loop over bytes in the long array, starting with the least significant byte
  const overflow = longArray.reduceRight((carry, value, index) => {
    // The sum is the carry added to the value
    let sum = value + carry;
    // If the index exists in the short array
    if (index >= lengthDifference) {
      // Add the byte of the short array with the same significance
      sum += shortArray[index - lengthDifference];
    }
    // Store the lower 8 bits of the sum in the result array
    resultArray[index] = sum & 0xff;
    // If the sum is larger than 8 bits, carry 1
    return sum > 0xff ? 1 : 0;
  }, 0);

  if (overflow === 0) {
    return resultArray.buffer;
  } else {
    // If there is overflow, create a buffer that is one byte longer to hold the overflow
    const overflowArray = new Uint8Array(resultArray.length + 1);
    overflowArray.set(resultArray, 1);
    overflowArray[0] = overflow;
    return overflowArray.buffer;
  }
};

// Subtract bufferB from bufferA
export const sub = (bufferA, bufferB) => {
  // Clone bufferA
  let bufferClone = new Uint8Array(new Uint8Array(bufferA)).buffer;
  // Subtract in place in the cloned array
  subI(bufferClone, bufferB);
  return bufferClone;
};

// Subtract bufferB from BufferA, in place
export const subI = (bufferA, bufferB) => {
  let compare = spaceShip(bufferA, bufferB);
  // if A is smaller than B, this subtraction results in underflow.
  if (compare < 0) {
    throw new OverflowError('Result is smaller than 0');
  }

  const arrayA = new Uint8Array(bufferA);

  // if A equals B, the result is zero
  if (compare === 0) {
    arrayA.fill(0);
    return;
  }

  const arrayB = new Uint8Array(bufferB);
  const lengthDifference = Math.abs(bufferA.byteLength - bufferB.byteLength);
  let carry = 0;

  // Loop over bytes in arrayA, starting with the least significant byte
  for (let index = bufferA.byteLength; index >= 0; index--) {
    // Add the byte of bufferA to the carry
    carry += arrayA[index];

    // If the index exists in bufferB
    if (index >= lengthDifference) {
      // Subtract the byte of bufferB with the same significance
      carry -= arrayB[index - lengthDifference];
    }
    // Store the lower 8 bits of the value back
    arrayA[index] = carry & 0xff;
    // If the carry is negative, carry -1
    carry = carry < 0 ? -1 : 0;
  }
};

// Division/modulo
// TODO: Look at performance
export const divmod = (numerator, denominator) => {
  // Check for division by zero
  if (bitLength(denominator) === 0) {
    throw new DivisionByZeroError();
  }

  // If numerator < denominator, div == zero and mod == numerator
  if (lt(numerator, denominator)) {
    return { div: new ArrayBuffer(0), mod: new Uint8Array(new Uint8Array(numerator)).buffer };
  }

  const numeratorArray = new Uint8Array(numerator);
  const quotientBuffer = new ArrayBuffer(numerator.byteLength);
  const quotient = new Uint8Array(quotientBuffer);
  const remainderBuffer = new ArrayBuffer(denominator.byteLength + 1);
  const remainder = new Uint8Array(remainderBuffer);

  // Long division algorithm (https://en.wikipedia.org/wiki/Division_algorithm#Long_division)
  for (let index = bitLength(numerator); index > 0; index--) {
    leftShiftI(remainderBuffer, 1);
    remainder[remainder.length - 1] |= numeratorArray[numerator.byteLength - Math.ceil(index / 8)] & (1 << (index - 1) % 8) ? 1 : 0;
    if (gte(remainderBuffer, denominator)) {
      subI(remainderBuffer, denominator);
      quotient[quotient.byteLength - Math.ceil(index / 8)] |= 1 << (index - 1) % 8;
    }
  }

  return { div: quotientBuffer, mod: remainderBuffer };
};

// Simple bufferUtil tests
const a = new Uint8Array([0x00, 0x00, 0x01, 0x01, 0xff, 0xff]).buffer;
const b = new Uint8Array([0xff, 0x0f, 0xff]).buffer;

console.log(`00000101ffff = ${toHex(a)}`);
console.log(`ff0fff = ${toHex(b)}`);

console.log(`${eval(`0x${toHex(a)} * 0x${toHex(b)}`)} = ${eval(`0x${toHex(mul(a, b))}`)}`);

console.log(`${eval(`0x${toHex(a)} + 0x${toHex(b)}`)} = ${eval(`0x${toHex(add(a, b))}`)}`);

console.log(`${bitLength(a)} = ${Math.floor(Math.log2(eval(`0x${toHex(a)}`))) + 1}`);
console.log(`${bitLength(b)} = ${Math.floor(Math.log2(eval(`0x${toHex(b)}`))) + 1}`);
console.log(`${bitLength(new Uint8Array(1).buffer)} = 0`); // Test zero-value buffer
console.log(`${bitLength(new Uint8Array(0).buffer)} = 0`); // Test zero-length buffer

console.log(`0101ffff = ${toHex(trim(a))}`);
console.log(`ff0fff = ${toHex(trim(b))}`);

const utf8String = '한글';
console.log(`${utf8String} = ${Uint.fromUTF(utf8String).utf}`);

console.log(`\\x00TEST = ${escape(Uint.fromUTF('\x00TEST').utf).replace('%', '\\x')}`);

console.log(`123ff8 = ${new Uint('123ff8').hex}`);

console.log(`${eval(`0x${toHex(b)} * 2`).toString(16)} = ${toHex(leftShift(b))}`);

const e = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]).buffer;

console.log(`${eval(`0x${toHex(e)} * 0x${toHex(e)}`)} = ${eval(`0x${toHex(mul(e, e))}`)}`);

console.log(`${gt(a, b)} = true`);
console.log(`${lte(b, b)} = true`);
console.log(`${eq(fromHex('00ab'), fromHex('ab'))} = true`);
console.log(`${lt(fromHex('ab'), fromHex('ac'))} = true`);
console.log(`${eq(new Uint8Array([0, 0]).buffer, new ArrayBuffer(0))} = true`);

console.log(`${eval(`0x${toHex(sub(e, e))}`)} = ${eval(`0x${toHex(e)} - 0x${toHex(e)}`)}`);

console.log(`${eval(`0x${toHex(sub(a, b))}`)} = ${eval(`0x${toHex(a)} - 0x${toHex(b)}`)}`);

try {
  sub(b, a);
  console.log('bad');
} catch (e) {
  console.log(e instanceof OverflowError ? 'good' : 'bad');
}

let f = leftShift(fromHex('ffffff'), 23);
console.log(`${toHex(f)}`);
console.log(`${eval(`0x${toHex(a)} / 0x${toHex(b)} | 0`)} = ${eval(`0x${toHex(divmod(a, b).div)}`)}`);
console.log(`${eval(`0x${toHex(a)} % 0x${toHex(b)}`)} = ${eval(`0x${toHex(divmod(a, b).mod)}`)}`);
