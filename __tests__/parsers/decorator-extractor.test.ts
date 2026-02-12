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
 * @fileoverview Tests for decorator extraction visibility rules.
 */

import ts from 'typescript';

import { extractPropertyDecorators } from '../../src/parsers/webcomponent/decorator-extractor';
import { createMockProgram } from '../helpers/fixtures';

interface ProgramFixture {
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
}

const createProgramFromSource = (source: string, fileName = 'props.ts'): ProgramFixture => {
  const { checker, sourceFile } = createMockProgram(source, fileName);
  return { checker, sourceFile };
};

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

describe('extractPropertyDecorators', () => {
  it('should include protected properties and excludes private properties', () => {
    const source = `
      const property = () => () => {};

      class Sample {
        @property({ type: String })
        publicProp = 'public';

        @property({ type: String })
        protected protectedProp = 'protected';

        @property({ type: String })
        private privateProp = 'private';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Sample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const names = result.items.map((prop) => prop.name);

    expect(names).toContain('publicProp');
    expect(names).toContain('protectedProp');
    expect(names).not.toContain('privateProp');

    const protectedProp = result.items.find((prop) => prop.name === 'protectedProp');
    expect(protectedProp?.visibility).toBe('protected');
  });

  it('should handle decorator options and inferred types', () => {
    const source = `
      const property = (_options?: unknown) => () => {};

      class OptionsSample {
        @property({ type: Boolean, attribute: false, reflect: true })
        disabled = false;

        @property({ reflect: true })
        count: number = 1;

        @property()
        label: string = 'Label';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'OptionsSample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const disabled = result.items.find((prop) => prop.name === 'disabled');
    const count = result.items.find((prop) => prop.name === 'count');
    const label = result.items.find((prop) => prop.name === 'label');

    expect(disabled?.attribute).toBeNull();
    expect(disabled?.reflect).toBe(true);
    expect(disabled?.type).toBe('boolean');

    expect(count?.type).toBe('number');
    expect(count?.reflect).toBe(true);
    expect(count?.attribute).toBe('count');

    expect(label?.type).toBe('string');
    expect(label?.attribute).toBe('label');
  });

  it('should capture enum values, string attributes, and default values', () => {
    const source = `
      const property = (_options?: unknown) => () => {};

      class AdvancedSample {
        /** The variant to render. */
        @property({ type: String, attribute: 'data-variant' })
        variant: 'primary' | 'secondary' = 'primary';

        @property({ attribute: true })
        autoFocus = true;

        @property()
        value = SOME_CONST;

        @property()
        'data-label': string = 'Label';

        @property()
        [dynamicKey] = 'ignored';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'AdvancedSample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const variant = result.items.find((prop) => prop.name === 'variant');
    const autoFocus = result.items.find((prop) => prop.name === 'autoFocus');
    const value = result.items.find((prop) => prop.name === 'value');
    const dataLabel = result.items.find((prop) => prop.name === 'data-label');

    expect(variant?.type).toBe('enum');
    expect(variant?.enumValues).toEqual(['primary', 'secondary']);
    expect(variant?.attribute).toBe('data-variant');
    expect(variant?.doc).toBe('The variant to render.');

    expect(autoFocus?.attribute).toBe('auto-focus');
    expect(autoFocus?.defaultValue).toBe(true);

    expect(value?.defaultValue).toBe('SOME_CONST');
    expect(dataLabel?.attribute).toBe('data-label');

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle computed names, accessors, and decorator variants', () => {
    const source = `
      const decorators = { property: (_options?: unknown) => () => {} };
      const property = (_options?: unknown) => () => {};
      const SOME_CONST = 'data-x';
      const dynamicKey = Symbol('dynamic');

      class MixedSample {
        @property
        ignored = 'skip';

        /** @deprecated */
        @property({ attribute: SOME_CONST })
        withAttribute: string = 'value';

        /** Summary {@link Foo} */
        @decorators.property({ type: SomeNamespace.Type, reflect: false })
        namespacedType: string;

        @property({ reflect: 'yes' })
        reflectMaybe = false;

        @property()
        get computed(): string {
          return 'value';
        }

        @property()
        ['template-name'] = 'value';

        @property()
        [dynamicKey] = 'value';

        @property()
        #privateField = 'secret';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'MixedSample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const names = result.items.map((prop) => prop.name);

    expect(names).toContain('withAttribute');
    expect(names).toContain('namespacedType');
    expect(names).toContain('computed');
    expect(names).toContain('template-name');
    expect(names).not.toContain('ignored');

    const withAttribute = result.items.find((prop) => prop.name === 'withAttribute');
    expect(withAttribute?.attribute).toBe('SOME_CONST');
    expect(withAttribute?.doc).toBeNull();

    const namespacedType = result.items.find((prop) => prop.name === 'namespacedType');
    expect(namespacedType?.type).toBe('string');
    expect(namespacedType?.reflect).toBe(false);
    expect(namespacedType?.doc).toContain('Summary');

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle non-call decorator expressions', () => {
    const source = `
      const property = () => () => {};
      const simpleDecorator = {};

      class Sample {
        @simpleDecorator
        withoutCall = 'value';

        @property()
        withCall = 'value';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Sample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const names = result.items.map((prop) => prop.name);

    expect(names).toContain('withCall');
    expect(names).not.toContain('withoutCall');
  });

  it('should handle members without names', () => {
    const source = `
      const property = () => () => {};
      const computedKey = Symbol('key');

      class Sample {
        @property()
        [computedKey] = 'computed';

        @property()
        named = 'value';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Sample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const names = result.items.map((prop) => prop.name);

    expect(names).toContain('named');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should handle non-property-assignment decorator options', () => {
    const source = `
      const property = () => () => {};

      class Sample {
        @property({ ...{ type: String } })
        spreadProp = 'value';

        @property({ type: String })
        normalProp = 'value';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Sample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const normalProp = result.items.find((prop) => prop.name === 'normalProp');

    expect(normalProp?.type).toBe('string');
  });

  it('should return undefined for non-union type enums', () => {
    const source = `
      const property = () => () => {};

      class Sample {
        @property({ type: String })
        plainString: string = 'value';
      }
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Sample');

    const result = extractPropertyDecorators([classDecl], { checker });
    const plainString = result.items.find((prop) => prop.name === 'plainString');

    expect(plainString?.enumValues).toBeUndefined();
    expect(plainString?.type).toBe('string');
  });
});
