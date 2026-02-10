/**
 * Rollup Configuration
 * 
 * Bundles the project into:
 * - dist/index.cjs - Minified CommonJS bundle
 * - dist/index.d.ts - Bundled type definitions
 */

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

const external = [
  '@automapper/core',
  '@automapper/pojos',
  'commander',
  'fs',
  'path',
  'typescript',
  'util',
  'os',
];

const terserOptions = {
  compress: {
    drop_console: false,
    drop_debugger: true,
    ecma: 2020,
  },
  format: {
    comments: false,
  },
};

export default [
  // Main bundle - minified CommonJS
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: false,
      exports: 'named',
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        module: 'ESNext',
      }),
      commonjs({
        extensions: ['.js', '.ts'],
      }),
      terser(terserOptions),
    ],
  },
  // Type definitions bundle
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    external,
    plugins: [dts()],
  },
];
