export const stringToBuffer = string => {
  return new Uint8Array(Array.from(string).map(char => char.charCodeAt(0))).buffer;
};

export const bufferToHex = buffer => {
  return Array.from(new Uint8Array(buffer), num => `0${num.toString(16)}`.slice(-2)).join('');
};
