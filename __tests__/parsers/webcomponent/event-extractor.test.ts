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
 * @fileoverview Tests for event extraction.
 */

import ts from 'typescript';

import { visitSourceFile } from '../../../src/parsers/webcomponent/ast-visitor';
import { extractEvents, extractEventsFromChain } from '../../../src/parsers/webcomponent/event-extractor';

describe('extractEvents', () => {
  it('should extract events from JSDoc and dispatchEvent calls', () => {
    const source = `
      class EventComponent {
        /**
         * @event change React: onChanged
         */
        handleClick() {
          this.dispatchEvent(new CustomEvent('change'));
          this.dispatchEvent(new CustomEvent(\`toggle\`));
        }

        /**
         * @event
         */
        unused() {}
      }
    `;

    const sourceFile = ts.createSourceFile('events.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const astData = visitSourceFile(sourceFile);

    const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
    if (!classDecl) {
      throw new Error('Class declaration not found.');
    }

    const result = extractEvents(classDecl, { astData });

    const eventNames = result.events.map((event) => event.name);
    expect(eventNames).toContain('change');
    expect(eventNames).toContain('toggle');

    const changeEvent = result.events.find((event) => event.name === 'change');
    const toggleEvent = result.events.find((event) => event.name === 'toggle');

    expect(changeEvent?.reactHandler).toBe('onChange');
    expect(toggleEvent?.reactHandler).toBe('onToggle');
  });

  it('should handle class-level JSDoc tags with overrides and inline links', () => {
    const source = `
      /**
       * @event ready React: onReady {@link Foo}
       * @event simple
       * @event custom-event {@link Bar}
       * @event {@link MissingName}
       * @event [invalid]
       * @event React: onIgnored
       * @event
       */
      class EventComponent {}
    `;

    const sourceFile = ts.createSourceFile('events-jsdoc.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const astData = visitSourceFile(sourceFile);

    const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
    if (!classDecl) {
      throw new Error('Class declaration not found.');
    }

    const result = extractEvents(classDecl, { astData });

    const eventNames = result.events.map((event) => event.name);
    expect(eventNames).toContain('ready');
    expect(eventNames).toContain('simple');
    expect(eventNames).toContain('custom-event');
    expect(eventNames).not.toContain('React');

    const readyEvent = result.events.find((event) => event.name === 'ready');
    expect(readyEvent?.reactHandler).toBe('onReady');
  });

  it('should return an empty array when no events are found', () => {
    const source = `
      class EmptyComponent {
        method() {
          return true;
        }
      }
    `;

    const sourceFile = ts.createSourceFile('events-empty.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const astData = visitSourceFile(sourceFile);

    const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
    if (!classDecl) {
      throw new Error('Class declaration not found.');
    }

    const result = extractEvents(classDecl, { astData });

    expect(result.events).toHaveLength(0);
  });

  it('should ignores unsupported dispatch patterns and empty JSDoc tags', () => {
    const source = `
      class EventComponent {
        /**
         * @event
         */
        emptyTag() {}

        handleClick() {
          const name = 'dynamic';
          this.dispatchEvent(new CustomEvent(name));
          this.dispatchEvent(new CustomEvent());
          this.dispatchEvent(new Event('ignored'));
        }
      }
    `;

    const sourceFile = ts.createSourceFile('events-ignored.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const astData = visitSourceFile(sourceFile);

    const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
    if (!classDecl) {
      throw new Error('Class declaration not found.');
    }

    const result = extractEvents(classDecl, { astData });

    expect(result.events).toHaveLength(0);
  });
});

describe('extractEventsFromChain', () => {
  it('should merge events across a class chain', () => {
    const source = `
      /**
       * @event ready
       */
      class Base {}

      class Derived extends Base {
        handle() {
          this.dispatchEvent(new CustomEvent('toggle'));
        }
      }
    `;

    const sourceFile = ts.createSourceFile('events-chain.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const astData = visitSourceFile(sourceFile);

    const classes = sourceFile.statements.filter(ts.isClassDeclaration);
    const baseClass = classes.find((node) => node.name?.text === 'Base');
    const derivedClass = classes.find((node) => node.name?.text === 'Derived');

    if (!baseClass || !derivedClass) {
      throw new Error('Class declarations not found.');
    }

    const result = extractEventsFromChain([baseClass, derivedClass], { astData });
    const eventNames = result.events.map((event) => event.name);

    expect(eventNames).toContain('ready');
    expect(eventNames).toContain('toggle');
  });

  it('should deduplicate events by name across the chain', () => {
    const source = `
      /**
       * @event ready
       */
      class Base {}

      class Derived extends Base {
        handle() {
          this.dispatchEvent(new CustomEvent('ready'));
        }
      }
    `;

    const sourceFile = ts.createSourceFile(
      'events-chain-dedupe.ts',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const astData = visitSourceFile(sourceFile);

    const classes = sourceFile.statements.filter(ts.isClassDeclaration);
    const baseClass = classes.find((node) => node.name?.text === 'Base');
    const derivedClass = classes.find((node) => node.name?.text === 'Derived');

    if (!baseClass || !derivedClass) {
      throw new Error('Class declarations not found.');
    }

    const result = extractEventsFromChain([baseClass, derivedClass], { astData });
    const readyEvents = result.events.filter((event) => event.name === 'ready');

    expect(readyEvents).toHaveLength(1);
  });
});
