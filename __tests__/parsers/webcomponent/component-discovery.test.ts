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
 * @fileoverview Tests for component class discovery.
 */

import ts from 'typescript';

import { ClassDiscoveryMethod } from '../../../src/core/types';
import { visitSourceFile } from '../../../src/parsers/webcomponent/ast-visitor';
import { discoverComponentClass } from '../../../src/parsers/webcomponent/component-discovery';

describe('discoverComponentClass', () => {
  const createSourceFile = (source: string): ts.SourceFile =>
    ts.createSourceFile('component.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const discoverFromSource = (source: string) => discoverComponentClass(visitSourceFile(createSourceFile(source)));

  it('should prefer default exported classes', () => {
    const source = `
      export default class DefaultExported {}
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('DefaultExported');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.DefaultExport);
  });

  it('should resolve default export assignments', () => {
    const source = `
      class AssignedExport {}
      export default AssignedExport;
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('AssignedExport');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.DefaultExport);
  });

  it('should fall back to customElement decorator', () => {
    const source = `
      const customElement = () => () => {};
      @customElement('my-demo')
      export class DecoratedComponent {}
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('DecoratedComponent');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.CustomElement);
  });

  it('should fall back to JSDoc tagname', () => {
    const source = `
      /** @tagname my-jsdoc */
      export class JSDocComponent {}
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('JSDocComponent');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.TagnameJSDoc);
  });

  it('should return the first class when no signals are found', () => {
    const source = `
      class First {}
      class Second {}
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('First');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.FirstClass);
  });

  it('should ignore non-call decorators and fall back to first class', () => {
    const source = `
      const customElement = () => () => {};
      @customElement
      class Decorated {}
      class Fallback {}
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('Decorated');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.FirstClass);
  });

  it('should detect customElement decorators on property access expressions', () => {
    const source = `
      const decorators = { customElement: () => () => {} };
      @decorators.customElement('my-access')
      class AccessComponent {}
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('AccessComponent');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.CustomElement);
  });

  it('should fall back when export assignments do not match classes', () => {
    const source = `
      class RealComponent {}
      export default MissingComponent;
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('RealComponent');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.FirstClass);
  });

  it('should return null when no classes are found', () => {
    const source = `
      const foo = 'bar';
    `;

    const result = discoverFromSource(source);

    expect(result).toBeNull();
  });

  it('should handle non-identifier export assignments', () => {
    const source = `
      class RealComponent {}
      export default { value: 123 };
    `;

    const result = discoverFromSource(source);

    expect(result?.classDeclaration.name?.text).toBe('RealComponent');
    expect(result?.source.discoveryMethod).toBe(ClassDiscoveryMethod.FirstClass);
  });
});
