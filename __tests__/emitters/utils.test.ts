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
 * @fileoverview Tests for emitter utilities.
 */

import {
  buildEventsSection,
  buildPropsSection,
  formatPropAccessor,
  formatPropKey,
  GENERATED_SECTION_MARKERS,
  getComponentBaseName,
  indent,
  indentBlock,
  isValidIdentifier,
  toTitleCase,
  wrapGeneratedSection,
} from '../../src/emitters/utils';
import { createMockComponentModel } from '../helpers/fixtures';
import type { EventDescriptor } from '../../src/core/types';

describe('getComponentBaseName', () => {
  it('should return file-based component name when pattern matches', () => {
    const model = createMockComponentModel({
      filePath: '/tmp/button.component.ts',
      componentDir: '/tmp/button',
    });

    expect(getComponentBaseName(model)).toBe('button');
  });

  it('should fall back to directory name when pattern does not match', () => {
    const model = createMockComponentModel({
      filePath: '/tmp/button.ts',
      componentDir: '/tmp/button',
    });

    expect(getComponentBaseName(model)).toBe('button');
  });
});

describe('formatPropAccessor', () => {
  it('should use dot access for valid identifiers', () => {
    expect(formatPropAccessor('disabled')).toBe('props.disabled');
  });

  it('should use bracket access for invalid identifiers', () => {
    expect(formatPropAccessor('data-value')).toBe("props['data-value']");
  });
});

describe('buildPropsSection', () => {
  it('should return an empty props block when no props are provided', () => {
    const result = buildPropsSection([]);

    expect(result.lines).toContain('  props: {},');
    expect(result.warnings).toHaveLength(0);
  });
});

describe('wrapGeneratedSection', () => {
  it('should wrap content with default generated section markers', () => {
    const wrapped = wrapGeneratedSection('props: {}');

    expect(wrapped[0]).toContain(GENERATED_SECTION_MARKERS.start);
    expect(wrapped[wrapped.length - 1]).toContain(GENERATED_SECTION_MARKERS.end);
  });
});

describe('toTitleCase', () => {
  it('should convert kebab-case to title case', () => {
    expect(toTitleCase('my-component-name')).toBe('My Component Name');
  });

  it('should handle single word components', () => {
    expect(toTitleCase('button')).toBe('Button');
  });

  it('should handle multiple separators', () => {
    expect(toTitleCase('data--value')).toBe('Data Value');
  });

  it('should handle leading separator', () => {
    expect(toTitleCase('-my-component')).toBe('My Component');
  });

  it('should handle trailing separator', () => {
    expect(toTitleCase('my-component-')).toBe('My Component');
  });
});

describe('indent', () => {
  it('should return empty string for depth 0', () => {
    expect(indent(0)).toBe('');
  });

  it('should return correct indentation for depth 1', () => {
    expect(indent(1)).toBe('  ');
  });

  it('should return correct indentation for depth 3', () => {
    expect(indent(3)).toBe('      ');
  });
});

describe('indentBlock', () => {
  it('should indent each line of a content block', () => {
    const content = 'line1\nline2\nline3';
    const result = indentBlock(content, 1);

    expect(result).toEqual(['  line1', '  line2', '  line3']);
  });

  it('should handle depth 0', () => {
    const content = 'line1\nline2';
    const result = indentBlock(content, 0);

    expect(result).toEqual(['line1', 'line2']);
  });
});

describe('isValidIdentifier', () => {
  it('should return true for valid identifiers', () => {
    expect(isValidIdentifier('validName')).toBe(true);
    expect(isValidIdentifier('_private')).toBe(true);
    expect(isValidIdentifier('$jquery')).toBe(true);
    expect(isValidIdentifier('name123')).toBe(true);
  });

  it('should return false for invalid identifiers', () => {
    expect(isValidIdentifier('data-value')).toBe(false);
    expect(isValidIdentifier('123invalid')).toBe(false);
    expect(isValidIdentifier('my-component')).toBe(false);
  });
});

describe('formatPropKey', () => {
  it('should return unquoted key for valid identifiers', () => {
    expect(formatPropKey('disabled')).toBe('disabled');
  });

  it('should return quoted key for invalid identifiers', () => {
    expect(formatPropKey('data-value')).toBe("'data-value'");
  });
});

describe('buildEventsSection', () => {
  it('should return empty events block when no events provided', () => {
    const result = buildEventsSection([]);

    expect(result).toContain('  events: {},');
  });

  it('should build events section with multiple events', () => {
    const events: EventDescriptor[] = [
      { name: 'click', reactHandler: 'onClick' },
      { name: 'change', reactHandler: 'onChange' },
    ];
    const result = buildEventsSection(events);

    expect(result).toContain('  events: {');
    expect(result.some((line) => line.includes('click'))).toBe(true);
    expect(result.some((line) => line.includes('onChange'))).toBe(true);
  });

  it('should handle events with custom depth', () => {
    const events: EventDescriptor[] = [{ name: 'click', reactHandler: 'onClick' }];
    const result = buildEventsSection(events, 2);

    expect(result[0]).toContain('    events: {');
  });
});

describe('file payload builders', () => {
  it('should create a file payload with default action', () => {
    const { createFilePayload } = require('../../src/emitters/utils');
    const payload = createFilePayload('/path/to/file.ts');

    expect(payload.filePath).toBe('/path/to/file.ts');
    expect(payload.action).toBe('created');
    expect(payload.contentLines).toEqual([]);
    expect(payload.sections).toEqual([]);
    expect(payload.warnings).toEqual([]);
  });

  it('should create a file payload with custom action', () => {
    const { createFilePayload } = require('../../src/emitters/utils');
    const payload = createFilePayload('/path/to/file.ts', 'updated');

    expect(payload.action).toBe('updated');
  });

  it('should build file payload from draft', () => {
    const { createFilePayload, buildFilePayload } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    const result = buildFilePayload(draft);

    expect(result.filePath).toBe('/path/to/file.ts');
    expect(result.action).toBe('created');
    expect(result.content).toBe('');
    expect(result.sections).toBeUndefined();
  });

  it('should apply builders in order', () => {
    const { createFilePayload, buildFilePayload } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const builder1 = (d: any) => ({ ...d, contentLines: [...d.contentLines, 'line1'] });
    const builder2 = (d: any) => ({ ...d, contentLines: [...d.contentLines, 'line2'] });
    
    const result = buildFilePayload(draft, builder1, builder2);

    expect(result.content).toBe('line1\nline2');
  });

  it('should include sections when present', () => {
    const { createFilePayload, buildFilePayload } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const builder = (d: any) => ({ 
      ...d, 
      sections: [{ name: 'props', content: 'props: {}', markers: {} }] 
    });
    
    const result = buildFilePayload(draft, builder);

    expect(result.sections).toBeDefined();
    expect(result.sections?.length).toBe(1);
  });

  it('should add imports with withImports builder', () => {
    const { createFilePayload, buildFilePayload, withImports } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const result = buildFilePayload(draft, withImports(['import { A } from "a";']));

    expect(result.content).toContain('import { A } from "a";');
  });

  it('should add sections with withSections builder', () => {
    const { createFilePayload, buildFilePayload, withSections } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const result = buildFilePayload(
      draft, 
      withSections({ 
        lines: ['props: {}'], 
        sections: [{ name: 'props', content: 'props: {}' }] 
      })
    );

    expect(result.content).toContain('props: {}');
    expect(result.sections?.length).toBe(1);
  });

  it('should add props with withProps builder', () => {
    const { createFilePayload, buildFilePayload, withProps } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const result = buildFilePayload(
      draft, 
      withProps({ content: 'disabled: boolean' })
    );

    expect(result.content).toContain('disabled: boolean');
  });

  it('should add example with withExample builder', () => {
    const { createFilePayload, buildFilePayload, withExample } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const result = buildFilePayload(
      draft, 
      withExample({ content: '<Button disabled={true} />' })
    );

    expect(result.content).toContain('<Button disabled={true} />');
  });

  it('should add warnings with withWarnings builder', () => {
    const { createFilePayload, buildFilePayload, withWarnings } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const result = buildFilePayload(
      draft, 
      withWarnings(['warning1', 'warning2'])
    );

    expect(result.warnings).toEqual(['warning1', 'warning2']);
  });

  it('should handle withWarnings with default empty array', () => {
    const { createFilePayload, buildFilePayload, withWarnings } = require('../../src/emitters/utils');
    const draft = createFilePayload('/path/to/file.ts');
    
    const result = buildFilePayload(draft, withWarnings());

    expect(result.warnings).toEqual([]);
  });
});
