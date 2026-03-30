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
import fs from 'node:fs';
import path from 'node:path';

const external = [
  '@automapper/core',
  '@automapper/pojos',
  'commander',
  'fs',
  'node:fs',
  'path',
  'node:path',
  'typescript',
  'util',
  'node:util',
  'os',
  'node:os',
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

const SRC_ALIAS_PREFIX = '@/';
const RESOLVABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function resolveProjectAlias(importPath) {
  const targetPath = path.resolve(process.cwd(), importPath.slice(SRC_ALIAS_PREFIX.length));
  const directMatch = resolveAliasCandidate(targetPath);
  if (directMatch) {
    return directMatch;
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    const indexMatch = resolveAliasCandidate(path.join(targetPath, `index${extension}`));
    if (indexMatch) {
      return indexMatch;
    }
  }

  return null;
}

function resolveAliasCandidate(candidatePath) {
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    const withExtension = `${candidatePath}${extension}`;
    if (fs.existsSync(withExtension) && fs.statSync(withExtension).isFile()) {
      return withExtension;
    }
  }

  return null;
}

function projectAliasPlugin() {
  return {
    name: 'project-alias',
    resolveId(source) {
      if (!source.startsWith(SRC_ALIAS_PREFIX)) {
        return null;
      }

      return resolveProjectAlias(source);
    },
  };
}

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
      projectAliasPlugin(),
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
  // CLI executable bundle
  {
    input: 'bin/figma-connecter.ts',
    output: {
      file: 'dist/figma-connecter.cjs',
      format: 'cjs',
      sourcemap: false,
    },
    external,
    plugins: [
      projectAliasPlugin(),
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
    plugins: [projectAliasPlugin(), dts()],
  },
];
