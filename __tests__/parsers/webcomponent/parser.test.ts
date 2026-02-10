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
 * @fileoverview Tests for the Web Component parser entrypoint.
 */

import ts from 'typescript';

import { parseWebComponent, WebComponentParser } from '../../../src/parsers/webcomponent/parser';
import { COMPONENT_WITH_PROPS_SOURCE, createMockProgram } from '../../helpers/fixtures';

interface ProgramFixture {
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
}

const createProgramFromSource = (source: string, fileName = 'component.ts'): ProgramFixture => {
  const { checker, sourceFile } = createMockProgram(source, fileName);
  return { checker, sourceFile };
};

const createParseContext = (
  sourceFile: ts.SourceFile,
  filePath: string,
  componentDir: string,
  checker: ts.TypeChecker,
  strict = false,
) => ({
  sourceFile,
  filePath,
  componentDir,
  checker,
  strict,
});

describe('parseWebComponent', () => {
  it('should parse component metadata and attributes', () => {
    const { checker, sourceFile } = createProgramFromSource(COMPONENT_WITH_PROPS_SOURCE);

    const result = parseWebComponent(
      createParseContext(
        sourceFile,
        '/repo/packages/components/src/components/sample/sample.component.ts',
        '/repo/packages/components/src/components/sample',
        checker,
      ),
    );

    expect(result.value?.className).toBe('ComponentWithProps');
    expect(result.value?.tagName).toBe('my-with-props');
    expect(result.value?.attributes.length).toBeGreaterThan(0);
    expect(result.value?.importPath).toBe('components/sample');
  });

  it('should include extracted events in the parsed model', () => {
    const source = `
      /**
       * @tagname my-events
       * @event ready
       */
      export class EventComponent {
        handle() {
          this.dispatchEvent(new CustomEvent('ready'));
        }
      }
    `;
    const { checker, sourceFile } = createProgramFromSource(source, 'event.component.ts');

    const result = parseWebComponent(
      createParseContext(sourceFile, '/tmp/events/event.component.ts', '/tmp/events', checker),
    );

    expect(result.value?.events.length).toBeGreaterThan(0);
  });

  it('should fall back to UnknownComponent when class name is missing', () => {
    const source = `
      /** @tagname my-anon */
      export default class extends HTMLElement {}
    `;
    const { checker, sourceFile } = createProgramFromSource(source, 'anon.component.ts');

    const result = parseWebComponent(
      createParseContext(sourceFile, '/tmp/anon/anon.component.ts', '/tmp/anon', checker),
    );

    expect(result.value?.className).toBe('UnknownComponent');
  });

  it('should fall back to component directory name when import marker is missing', () => {
    const source = `
      /** @tagname my-basic */
      export class BasicComponent {}
    `;
    const { checker, sourceFile } = createProgramFromSource(source, 'basic.component.ts');

    const result = parseWebComponent(
      createParseContext(sourceFile, '/tmp/basic/basic.component.ts', '/tmp/basic', checker),
    );

    expect(result.value?.importPath).toBe('basic');
  });

  it('should return an error result when no class declaration is found', () => {
    const { checker, sourceFile } = createProgramFromSource('export const value = 1;');

    const result = parseWebComponent(createParseContext(sourceFile, '/tmp/empty.component.ts', '/tmp', checker));

    expect(result.errors[0]).toContain('No class declaration found');
    expect(result.value).toBeUndefined();
  });

  it('should add errors in strict mode when base classes are unresolved', () => {
    const source = `
      export class StrictComponent extends MissingBase {}
    `;
    const { checker, sourceFile } = createProgramFromSource(source, 'strict.component.ts');

    const result = parseWebComponent(
      createParseContext(sourceFile, '/tmp/strict/strict.component.ts', '/tmp/strict', checker, true),
    );

    expect(result.errors[0]).toContain('Unable to resolve base classes');
  });

  it('should parse via the WebComponentParser strategy', () => {
    const { checker, sourceFile } = createProgramFromSource(COMPONENT_WITH_PROPS_SOURCE);
    const parser = new WebComponentParser();

    const result = parser.parse(
      createParseContext(
        sourceFile,
        '/repo/packages/components/src/components/sample/sample.component.ts',
        '/repo/packages/components/src/components/sample',
        checker,
      ),
    );

    expect(result.value?.className).toBe('ComponentWithProps');
  });
});
