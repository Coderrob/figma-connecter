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
 * @fileoverview Tests for tag name resolution.
 */

import path from 'node:path';

import ts from 'typescript';

import { resolveTagName } from '../../src/parsers/webcomponent/tagname-resolver';

const createSourceFile = (source: string, fileName = 'component.ts'): ts.SourceFile =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);

const findClassDeclaration = (sourceFile: ts.SourceFile, name: string): ts.ClassDeclaration => {
  let found: ts.ClassDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (!found) {
    throw new Error(`Class declaration not found: ${name}`);
  }
  return found;
};

describe('resolveTagName', () => {
  it('should prefer @tagname JSDoc tags', () => {
    const source = `
      /**
       * @tagname my-jsdoc
       */
      export class Demo {}
    `;
    const sourceFile = createSourceFile(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const result = resolveTagName({
      classDeclaration: classDecl,
      componentDir: '/tmp/component',
      componentFilePath: '/tmp/component/demo.component.ts',
      className: 'Demo',
    });

    expect(result.tagName).toBe('my-jsdoc');
    expect(result.source).toBe('jsdoc');
  });

  it('should resolve tag name from index.ts register(TAG_NAME)', () => {
    const fixtureDir = path.resolve(__dirname, '../../__fixtures__/components/button');
    const filePath = path.join(fixtureDir, 'button.component.ts');

    const result = resolveTagName({
      componentDir: fixtureDir,
      componentFilePath: filePath,
      className: 'Button',
    });

    expect(result.tagName).toBe('mdc-button');
    expect(result.source).toBe('index-ts');
  });

  it('should fall back to filename-derived tag name', () => {
    const fixtureDir = path.resolve(__dirname, '../../__fixtures__/components/standalone');
    const filePath = path.join(fixtureDir, 'standalone.component.ts');

    const result = resolveTagName({
      componentDir: fixtureDir,
      componentFilePath: filePath,
      className: 'Standalone',
    });

    expect(result.tagName).toBe('mdc-standalone');
    expect(result.source).toBe('filename');
  });
});
