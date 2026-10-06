import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5000
  },
  build: {
    lib: {
      entry: 'lib/BigNum.ts',
      formats: ['es'],
      fileName: 'bignum'
    }
  },
  test: {
    include: ['test/**/*.ts']
  }
});
