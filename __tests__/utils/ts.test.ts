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
 * @fileoverview Tests for TypeScript AST utilities.
 */

import ts from 'typescript';

import { getDecoratorOptions, getJSDocSummary, getJSDocTagText, getLiteralValue } from '../../src/utils/ts';
import { createMockSourceFile } from '../helpers/fixtures';

const createSourceFile = (contents: string): ts.SourceFile => createMockSourceFile(contents);

const findNode = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T | null => {
  let found: T | null = null;
  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }
    if (predicate(node)) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(root, visit);
  return found;
};

describe('TypeScript AST utilities', () => {
  it('should read JSDoc summaries and tags', () => {
    const sourceFile = createSourceFile(`
      /** Class summary */
      @customElement('my-test')
      class TestComponent {
        /** Property summary */
        @property({ type: String, attribute: 'data-label', reflect: true })
        label = 'Label';
      }

      /** @event change React: onChange */
      class EventsComponent {}
    `);

    const property = findNode(sourceFile, ts.isPropertyDeclaration);
    expect(property).not.toBeNull();
    expect(getJSDocSummary(property!)).toBe('Property summary');

    const eventsClass = sourceFile.statements.find(
      (statement) => ts.isClassDeclaration(statement) && statement.name?.text === 'EventsComponent',
    ) as ts.ClassDeclaration | undefined;
    expect(eventsClass).toBeDefined();

    const tags = ts.getJSDocTags(eventsClass!);
    expect(tags).toHaveLength(1);
    expect(getJSDocTagText(tags[0])).toBe('change React: onChange');
  });

  it('should extract decorator options', () => {
    const sourceFile = createSourceFile(`
      class TestComponent {
        @property({ type: String, attribute: 'data-label', reflect: true })
        label = 'Label';
      }
    `);

    const property = findNode(sourceFile, ts.isPropertyDeclaration);
    expect(property).not.toBeNull();

    const decorators = ts.canHaveDecorators(property!) ? (ts.getDecorators(property!) ?? []) : [];
    expect(decorators).toHaveLength(1);

    const options = getDecoratorOptions(decorators[0]);
    expect(options).not.toBeNull();
    expect(options!.properties.length).toBe(3);
  });

  it('should return null for non-call decorators', () => {
    const sourceFile = createSourceFile(`
      class TestComponent {
        @logged
        value = 1;
      }
    `);

    const property = findNode(sourceFile, ts.isPropertyDeclaration);
    expect(property).not.toBeNull();

    const decorators = ts.canHaveDecorators(property!) ? (ts.getDecorators(property!) ?? []) : [];
    expect(decorators).toHaveLength(1);

    const options = getDecoratorOptions(decorators[0]);
    expect(options).toBeNull();
  });

  it('should parse literal values', () => {
    const sourceFile = createSourceFile(`
      const text = 'hello';
      const tmpl = \`world\`;
      const count = 42;
      const enabled = false;
      const active = true;
      const obj = { value: 1 };
      const other = unknownValue;
    `);

    const getInitializer = (name: string): ts.Expression | undefined => {
      const declaration = sourceFile.statements
        .filter(ts.isVariableStatement)
        .flatMap((statement) => statement.declarationList.declarations)
        .find((item) => ts.isIdentifier(item.name) && item.name.text === name);
      return declaration?.initializer;
    };

    expect(getLiteralValue(getInitializer('text'))).toBe('hello');
    expect(getLiteralValue(getInitializer('tmpl'))).toBe('world');
    expect(getLiteralValue(getInitializer('count'))).toBe(42);
    expect(getLiteralValue(getInitializer('enabled'))).toBe(false);
    expect(getLiteralValue(getInitializer('active'))).toBe(true);
    expect(getLiteralValue(getInitializer('obj'))).toBeNull();
    expect(getLiteralValue(getInitializer('other'))).toBeNull();
    expect(getLiteralValue(undefined)).toBeNull();
  });
});
