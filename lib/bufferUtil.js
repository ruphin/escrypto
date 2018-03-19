export const fromString = string => {
  return new Uint8Array(Array.from(string).map(char => char.charCodeAt(0))).buffer;
};

export const toHex = buffer => {
  return Array.from(new Uint8Array(buffer), num => `0${num.toString(16)}`.slice(-2)).join('');
};

const padTo16Bit = buffer => {
  if (buffer.byteLength % 2 !== 0) {
    const tmp = new Uint8Array(buffer.byteLength + 1);
    tmp.set(new Uint8Array(buffer), 1);
    buffer = tmp.buffer;
  }
  return buffer;
};

export const mult = (bufferA, bufferB) => {
  // Output buffer is the length of both inputs combined (padded to a multiple of 16 bits on the next line)
  let output = new ArrayBuffer(bufferA.byteLength + bufferB.byteLength);

  // Pad each buffer size to a multiple of 16 bits for easy processing
  output = padTo16Bit(output);
  bufferA = padTo16Bit(bufferA);
  bufferB = padTo16Bit(bufferB);

  // Create views for each buffer
  const outputView = new DataView(output);
  const AView = new DataView(bufferA);
  const BView = new DataView(bufferB);

  // This 32-bit cache holds intermediate results of Uint16 multiplications
  const cache = new DataView(new ArrayBuffer(4));

  let carry = 0;

  /*
    The 'index' refers to a 16-bit portion of the result buffer, using right-to-left, starting with 2.
    The given 16-bit value can be accessed with array.getUint16(array.byteLength - index)

    Ex. given this 8-byte array:
    -------------------------------------------------
    |  0  |  1  |  2  |  3  |  4  |  5  |  6  |  7  |
    -------------------------------------------------
    the indexes are:
    -------------------------------------------------
    |  8        |  6        |  4        |  2        |
    -------------------------------------------------
    
    This loop calculates the values of each index on the output one by one
  */
  for (let index = 2; index <= output.byteLength; index += 2) {
    // The resulting value of this index. Start with the carry from the previous index
    let sum = carry;
    // Reset the carry;
    carry = 0;
    // For each pair of 16-bit values that multiplies into the index
    for (let x = Math.min(bufferA.byteLength, index); x >= 2 && index + 2 - x <= bufferB.byteLength; x -= 2) {
      // Write the multiple of those values added to the existing sum into the cache
      cache.setUint32(0, AView.getUint16(bufferA.byteLength - x, false) * BView.getUint16(bufferB.byteLength - (index + 2 - x), false) + sum, false);
      // The lower 16 bits of the cache are the new sum
      sum = cache.getUint16(2, false);
      // Add the upper 16 bits to the carry
      carry += cache.getUint16(0, false);
    }
    // Write the resulting sum to the index in the output array
    outputView.setUint16(output.byteLength - index, sum, false);
  }
  return output;
};

export const add = (bufferA, bufferB) => {};
