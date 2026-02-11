/**
 * Copyright (c) 2026 Robert Lindley
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Integration tests for the figma-connecter CLI.
 */

import fs from 'node:fs';
import path from 'node:path';

import { run } from '../../src/cli/program';
import { expectContainsAll, expectGeneratedSectionMarkers, expectKeysEqual } from '../helpers/assertions';

const packageRoot = path.resolve(__dirname, '..', '..');
const fixturesRoot = path.join(packageRoot, '__fixtures__');
const outputRoot = path.join(packageRoot, '__tests__', '__output__', 'connect-cli');
const outputFixturesRoot = path.join(outputRoot, '__fixtures__');
const outputComponentsRoot = path.join(outputFixturesRoot, 'components');
const tsconfigPath = path.join(outputRoot, 'tsconfig.json');

const writeTsconfig = (): void => {
  const tsconfig = {
    compilerOptions: {
      target: 'ESNext',
      module: 'ESNext',
      experimentalDecorators: true,
      useDefineForClassFields: false,
      skipLibCheck: true,
    },
    include: ['**/*.ts'],
  };
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');
};

const prepareOutput = (): void => {
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.cpSync(fixturesRoot, outputFixturesRoot, { recursive: true });
  writeTsconfig();
};

const collectGeneratedFiles = (): Record<string, string> => {
  const results: Record<string, string> = {};

  const traverse = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        traverse(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!entryPath.includes(`${path.sep}code-connect${path.sep}`)) {
        continue;
      }
      if (!entryPath.endsWith('.figma.ts') && !entryPath.endsWith('.figma.tsx')) {
        continue;
      }
      const relative = path.relative(outputRoot, entryPath).split(path.sep).join('/');
      results[relative] = fs.readFileSync(entryPath, 'utf8');
    }
  };

  traverse(outputComponentsRoot);

  return Object.fromEntries(
    Object.keys(results)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => [key, results[key]]),
  );
};

describe('figma-connecter CLI integration', () => {
  beforeAll(async () => {
    prepareOutput();

    await run([
      'node',
      'figma-connecter',
      '--quiet',
      '--config',
      tsconfigPath,
      'connect',
      '--path',
      outputComponentsRoot,
      '--recursive',
      '--emit',
      'webcomponent,react',
      '--base-import-path',
      '@momentum-design/components',
      '--no-strict',
    ]);
  });

  it('should generates webcomponent and react connect files from fixtures', () => {
    const generated = collectGeneratedFiles();
    const generatedPaths = Object.keys(generated);
    const expectedPaths = [
      '__fixtures__/components/base/code-connect/base.react.figma.tsx',
      '__fixtures__/components/base/code-connect/base.webcomponent.figma.ts',
      '__fixtures__/components/button/code-connect/button.react.figma.tsx',
      '__fixtures__/components/button/code-connect/button.webcomponent.figma.ts',
      '__fixtures__/components/standalone/code-connect/standalone.react.figma.tsx',
      '__fixtures__/components/standalone/code-connect/standalone.webcomponent.figma.ts',
      '__fixtures__/components/variants/code-connect/variants.react.figma.tsx',
      '__fixtures__/components/variants/code-connect/variants.webcomponent.figma.ts',
    ];

    expectKeysEqual(generatedPaths, expectedPaths);

    for (const [relativePath, content] of Object.entries(generated)) {
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('figma.connect(');
      expectGeneratedSectionMarkers(content);

      if (relativePath.endsWith('.react.figma.tsx')) {
        expectContainsAll(content, ["import figma from '@figma/code-connect';", 'example: props => {']);
      } else {
        expect(content).toContain("import figma, { html } from '@figma/code-connect/html';");
        expect(content).toContain('example:');
        expect(content).toContain('html`');
      }
    }
  });
});
