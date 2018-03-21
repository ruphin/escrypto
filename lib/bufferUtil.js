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
  const aView = new DataView(bufferA);
  const bView = new DataView(bufferB);

  // Storage for overflow carry bits
  // Invariant: carry may never exceed 0xFFFF (16 bit)
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
    // Storage for the value of this index. Start with the carry from the previous index
    // Invariant: sum may never exceed 0xFFFF (16 bit)
    let sum = carry;

    // Reset the carry
    carry = 0;

    // For each pair of 16-bit values that multiplies into the index
    for (let x = Math.min(bufferA.byteLength, index); x >= 2 && index + 2 - x <= bufferB.byteLength; x -= 2) {
      // Multiply the 16-bit values and add the current sum into tmp
      // Invariant: tmp may never exceed 0xFFFFFFFF (32 bit)
      // Proof: (0xFFFF * 0xFFFF) + 0xFFFF = 0xFFFF0000
      const tmp = aView.getUint16(bufferA.byteLength - x, false) * bView.getUint16(bufferB.byteLength - (index + 2 - x), false) + sum;

      // The lower 16 bits of the result are the new sum
      sum = tmp & 0x0000ffff;

      // The upper 16 bits of the result are added to the carry
      carry += tmp >> 16;
    }
    // Write the resulting sum to the index in the output array
    outputView.setUint16(output.byteLength - index, sum, false);
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
