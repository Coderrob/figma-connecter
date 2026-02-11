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
 * @fileoverview Tests for mixin inheritance resolution.
 */

import ts from 'typescript';

import { extractPropertyDecorators } from '../../src/parsers/webcomponent/decorator-extractor';
import { resolveInheritanceChain } from '../../src/parsers/webcomponent/inheritance-resolver';
import { createMockProgram } from '../helpers/fixtures';

interface ProgramFixture {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
}

const createProgramFromSource = (source: string, fileName = 'mixin.ts'): ProgramFixture =>
  createMockProgram(source, fileName);

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

describe('resolveInheritanceChain', () => {
  it('should include mixin class expressions returned from functions', () => {
    const source = `
      const property = () => () => {};
      const WithDisabled = (Base) => {
        return class extends Base {
          @property({ type: Boolean })
          disabled = false;
        };
      };

      class Base {}

      class Demo extends WithDisabled(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);

    const { properties } = extractPropertyDecorators(resolution.chain, { checker });
    const names = properties.map((prop) => prop.name);

    expect(names).toContain('disabled');
  });

  it('should resolve properties from fixtures (Button with BaseComponent)', () => {
    const fixtureRoot = `${__dirname}/../../__fixtures__/components`;
    const buttonPath = `${fixtureRoot}/button/button.component.ts`;
    const basePath = `${fixtureRoot}/base/base.component.ts`;

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      experimentalDecorators: true,
      moduleResolution: ts.ModuleResolutionKind.Node10,
    };

    const program = ts.createProgram(
      [buttonPath, basePath],
      compilerOptions,
      ts.createCompilerHost(compilerOptions, true),
    );
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(buttonPath);

    if (!sourceFile) {
      throw new Error('Failed to load button fixture source file.');
    }

    const classDecl = findClassDeclaration(sourceFile, 'Button');
    const resolution = resolveInheritanceChain(classDecl, { checker });
    const { properties } = extractPropertyDecorators(resolution.chain, { checker });
    const names = properties.map((prop) => prop.name);

    expect(names).toContain('ariaLabel');
  });

  it('should track unresolved base classes', () => {
    const source = `
      class MissingBase extends UnknownBase {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'MissingBase');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.unresolved).toContain('UnknownBase');
    expect(resolution.warnings[0]).toContain('Unable to resolve base class');
  });

  it('should resolve mixin classes returned by identifier', () => {
    const source = `
      const WithFeature = (Base) => {
        class Feature extends Base {}
        return Feature;
      };

      class Base {}

      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });
    const hasFeature = resolution.chain.some(
      (node) => ts.isClassDeclaration(node) && node.name?.text === 'Feature',
    );

    expect(hasFeature).toBe(true);
  });

  it('should resolve property access base classes', () => {
    const source = `
      namespace Foo {
        export class Base {}
      }

      class Derived extends Foo.Base {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Derived');

    const resolution = resolveInheritanceChain(classDecl, { checker });
    const names = resolution.chain
      .filter(ts.isClassDeclaration)
      .map((node) => node.name?.text)
      .filter(Boolean);

    expect(names).toContain('Base');
    expect(names).toContain('Derived');
  });

  it('should resolve mixin classes returned as class expressions', () => {
    const source = `
      const WithFeature = (Base) => class extends Base {};
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);
  });

  it('should resolve mixin classes returned by class-expression variables', () => {
    const source = `
      const WithFeature = (Base) => {
        const Feature = class extends Base {};
        return Feature;
      };
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);
  });

  it('should fall back to the first class in a mixin body without returns', () => {
    const source = `
      const WithFeature = (Base) => {
        class Feature extends Base {}
      };
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });
    const hasFeature = resolution.chain.some(
      (node) => ts.isClassDeclaration(node) && node.name?.text === 'Feature',
    );

    expect(hasFeature).toBe(true);
  });

  it('should warn when mixin resolution fails', () => {
    const source = `
      const WithMissing = (Base) => missing(Base);
      class Base {}
      class Demo extends WithMissing(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.warnings.length).toBeGreaterThan(0);
  });

  it('should resolve mixins declared as function declarations', () => {
    const source = `
      function WithFeature(Base) {
        return class Feature extends Base {};
      }

      class Base {}

      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });
    const hasFeature = resolution.chain.some(
      (node) => ts.isClassExpression(node) && node.name?.text === 'Feature',
    );

    expect(hasFeature).toBe(true);
  });

  it('should resolve mixins declared as function expressions', () => {
    const source = `
      const WithFeature = function(Base) {
        return class Feature extends Base {};
      };

      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });
    const hasFeature = resolution.chain.some(
      (node) => ts.isClassExpression(node) && node.name?.text === 'Feature',
    );

    expect(hasFeature).toBe(true);
  });

  it('should unwrap parenthesized return expressions in mixins', () => {
    const source = `
      const WithFeature = (Base) => {
        return ((class Feature extends Base {}));
      };

      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });
    const hasFeature = resolution.chain.some(
      (node) => ts.isClassExpression(node) && node.name?.text === 'Feature',
    );

    expect(hasFeature).toBe(true);
  });

  it('should mark unresolved when extending a class expression directly', () => {
    const source = `
      class Demo extends (class Base {}) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.unresolved.length).toBeGreaterThan(0);
  });

  it('should skip non-extends heritage clauses', () => {
    const source = `
      interface DemoInterface {}
      class Demo implements DemoInterface {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.length).toBeGreaterThan(0);
    expect(resolution.warnings).toHaveLength(0);
  });

  it('should de-duplicate base classes when mixins repeat arguments', () => {
    const source = `
      const WithFeature = (Base, Other) => class extends Base {};
      class Base {}
      class Demo extends WithFeature(Base, Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    const baseEntries = resolution.chain.filter(
      (node) => ts.isClassDeclaration(node) && node.name?.text === 'Base',
    );
    expect(baseEntries.length).toBe(1);
  });

  it('should warn when mixin call expressions have no resolvable symbol', () => {
    const source = `
      class Base {}
      class Demo extends ((Base) => class extends Base {})(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.warnings.length).toBeGreaterThan(0);
  });

  it('should handle arrow functions with non-block bodies that return from variable declarations', () => {
    const source = `
      const WithFeature = (Base) => class extends Base {};
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);
  });

  it('should handle variable declarations with arrow functions that have block bodies', () => {
    const source = `
      const WithFeature = (Base) => {
        return class extends Base {};
      };
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);
  });

  it('should handle variable declarations with function expressions that have bodies', () => {
    const source = `
      const WithFeature = function(Base) {
        return class extends Base {};
      };
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);
  });

  it('should handle function declarations without bodies', () => {
    const source = `
      declare function WithFeature(Base: any): any;
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.warnings.length).toBeGreaterThan(0);
  });

  it('should handle arrow functions that have non-block bodies from variable declarations', () => {
    const source = `
      const WithFeature = (Base) => class FeatureClass extends Base {};
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(
      resolution.chain.some(
        (node) => ts.isClassExpression(node) && node.name?.text === 'FeatureClass',
      ),
    ).toBe(true);
  });

  it('should handle arrow function declarations with non-block bodies', () => {
    const source = `
      const createMixin = (Base) => class extends Base {};
      class Base {}
      class Demo extends createMixin(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);
  });

  it('should handle variable declarations with arrow functions that return from block body', () => {
    const source = `
      const WithFeature = (Base) => {
        const FeatureClass = class extends Base {};
        return FeatureClass;
      };
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.chain.some((node) => ts.isClassExpression(node))).toBe(true);
  });

  it('should handle variable declarations with function expressions that have no body', () => {
    const source = `
      declare const WithFeature: (Base: any) => any;
      class Base {}
      class Demo extends WithFeature(Base) {}
    `;

    const { checker, sourceFile } = createProgramFromSource(source);
    const classDecl = findClassDeclaration(sourceFile, 'Demo');

    const resolution = resolveInheritanceChain(classDecl, { checker });

    expect(resolution.warnings.length).toBeGreaterThan(0);
  });
});
