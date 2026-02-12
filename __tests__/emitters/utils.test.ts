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
  toDisplayName,
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

describe('toDisplayName', () => {
  it('should convert kebab-case to title case', () => {
    expect(toDisplayName('my-component-name')).toBe('My Component Name');
  });

  it('should handle single word components', () => {
    expect(toDisplayName('button')).toBe('Button');
  });

  it('should handle multiple separators', () => {
    expect(toDisplayName('data--value')).toBe('Data Value');
  });

  it('should handle leading separator', () => {
    expect(toDisplayName('-my-component')).toBe('My Component');
  });

  it('should handle trailing separator', () => {
    expect(toDisplayName('my-component-')).toBe('My Component');
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
