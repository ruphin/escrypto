import { test, assert, equal } from 'https://deno.land/x/testing/mod.ts';

import { BigNum } from '../lib/BigNum.ts';

const bufferA = new Uint8Array([0x00, 0x00, 0x01, 0x01, 0xff, 0xff]).buffer;
const hexStringA = '00000101ffff';
const numA = eval(`0x${hexStringA}`);

const bufferB = new Uint8Array([0xff, 0x0f, 0xff]).buffer;
const hexStringB = 'ff0fff';
const numB = eval(`0x${hexStringB}`);

test({
  name: 'constructor',
  fn() {
    const fromBufferA = new BigNum(bufferA);
    assert(equal(fromBufferA.buffer, bufferA));

    const fromHexStringA = new BigNum(hexStringA, 16);
    assert(equal(fromHexStringA.buffer, bufferA));

    const fromNumA = new BigNum(numA);
    assert(equal(fromNumA.buffer, bufferA));

    const fromBufferB = new BigNum(bufferA);
    assert(equal(fromBufferB.buffer, bufferA));

    const fromHexStringB = new BigNum(hexStringA, 16);
    assert(equal(fromHexStringB.buffer, bufferA));

    const fromNumB = new BigNum(numA);
    assert(equal(fromNumB.buffer, bufferA));
  }
});

// tests
// const a = new Uint8Array([0x00, 0x00, 0x01, 0x01, 0xff, 0xff]).buffer;
// const b = new Uint8Array([0xff, 0x0f, 0xff]).buffer;

// const a = new BigNum('0123456789abcd', 16);

// console.log(`0123456789abcd = ${a.hex}`, '--', '0123456789abcd' === a.hex);
// console.log(`ffff01010000 = ${new BigNum(a, 16, 'le').hex}`);
// console.log(`ff0fff = ${new BigNum(b).hex}`);

// console.log(`${eval(`0x${toHex(a)} * 0x${toHex(b)}`)} = ${eval(`0x${toHex(mul(a, b))}`)}`);

// console.log(`${eval(`0x${toHex(a)} + 0x${toHex(b)}`)} = ${eval(`0x${toHex(add(a, b))}`)}`);

// console.log(`${bitLength(a)} = ${Math.floor(Math.log2(eval(`0x${toHex(a)}`))) + 1}`);
// console.log(`${bitLength(b)} = ${Math.floor(Math.log2(eval(`0x${toHex(b)}`))) + 1}`);
// console.log(`${bitLength(new Uint8Array(1).buffer)} = 0`); // Test zero-value buffer
// console.log(`${bitLength(new Uint8Array(0).buffer)} = 0`); // Test zero-length buffer

// console.log(`0101ffff = ${toHex(trim(a))}`);
// console.log(`ff0fff = ${toHex(trim(b))}`);

// const utf8String = '한글';
// console.log(`${utf8String} = ${Uint.fromUTF(utf8String).utf}`);

// console.log(`\\x00TEST = ${escape(Uint.fromUTF('\x00TEST').utf).replace('%', '\\x')}`);

// console.log(`123ff8 = ${new Uint('123ff8').hex}`);

// console.log(`${eval(`0x${toHex(b)} * 2`).toString(16)} = ${toHex(leftShift(b))}`);

// const e = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]).buffer;

// console.log(`${eval(`0x${toHex(e)} * 0x${toHex(e)}`)} = ${eval(`0x${toHex(mul(e, e))}`)}`);

// console.log(`${gt(a, b)} = true`);
// console.log(`${lte(b, b)} = true`);
// console.log(`${eq(fromHex('00ab'), fromHex('ab'))} = true`);
// console.log(`${lt(fromHex('ab'), fromHex('ac'))} = true`);
// console.log(`${eq(new Uint8Array([0, 0]).buffer, new ArrayBuffer(0))} = true`);

// console.log(`${eval(`0x${toHex(sub(e, e))}`)} = ${eval(`0x${toHex(e)} - 0x${toHex(e)}`)}`);

// console.log(`${eval(`0x${toHex(sub(a, b))}`)} = ${eval(`0x${toHex(a)} - 0x${toHex(b)}`)}`);

// try {
//   sub(b, a);
//   console.log('bad');
// } catch (e) {
//   console.log(e instanceof OverflowError ? 'good' : 'bad');
// }

// let f = leftShift(fromHex('ffffff'), 23);
// console.log(`${toHex(f)}`);
// console.log(`${eval(`0x${toHex(a)} / 0x${toHex(b)} | 0`)} = ${eval(`0x${toHex(divmod(a, b).div)}`)}`);
// console.log(`${eval(`0x${toHex(a)} % 0x${toHex(b)}`)} = ${eval(`0x${toHex(divmod(a, b).mod)}`)}`);
