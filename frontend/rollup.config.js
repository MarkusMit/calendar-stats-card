import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';

export default {
  input: 'src/calendar-stats-card.ts',
  output: {
    file: 'dist/calendar-stats-card.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    resolve(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
      sourceMap: false,
    }),
    terser(),
  ],
};
