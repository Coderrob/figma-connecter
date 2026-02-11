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
 * @fileoverview Tests for string utility functions.
 */

import {
  kebabToTitleCase,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  upperCaseFirstCharacter,
} from '../../src/utils/strings';

describe('upperCaseFirstCharacter', () => {
  describe('positive cases', () => {
    it('should capitalizes first letter of lowercase string', () => {
      expect(upperCaseFirstCharacter('hello')).toBe('Hello');
    });

    it('should preserve rest of string', () => {
      expect(upperCaseFirstCharacter('hELLO')).toBe('HELLO');
    });

    it('should handle single character', () => {
      expect(upperCaseFirstCharacter('a')).toBe('A');
    });

    it('should preserve already capitalized first letter', () => {
      expect(upperCaseFirstCharacter('Hello')).toBe('Hello');
    });
  });

  describe('negative cases', () => {
    it('should return empty string for empty input', () => {
      expect(upperCaseFirstCharacter('')).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(upperCaseFirstCharacter(undefined)).toBe('');
    });

    it('should handle string starting with number', () => {
      expect(upperCaseFirstCharacter('1test')).toBe('1test');
    });

    it('should handle string starting with special character', () => {
      expect(upperCaseFirstCharacter('-test')).toBe('-test');
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace string', () => {
      expect(upperCaseFirstCharacter(' hello')).toBe(' hello');
    });

    it('should handle string with only special characters', () => {
      expect(upperCaseFirstCharacter('---')).toBe('---');
    });
  });
});

describe('kebabToTitleCase', () => {
  describe('positive cases', () => {
    it('should convert simple kebab-case to title case', () => {
      expect(kebabToTitleCase('hello-world')).toBe('Hello World');
    });

    it('should convert single word', () => {
      expect(kebabToTitleCase('hello')).toBe('Hello');
    });

    it('should convert multiple words', () => {
      expect(kebabToTitleCase('hello-beautiful-world')).toBe('Hello Beautiful World');
    });
  });

  describe('negative cases', () => {
    it('should return empty string for empty input', () => {
      expect(kebabToTitleCase('')).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(kebabToTitleCase(undefined)).toBe('');
    });

    it('should handle only hyphens', () => {
      expect(kebabToTitleCase('---')).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should trim leading and trailing whitespace', () => {
      expect(kebabToTitleCase('  hello-world  ')).toBe('Hello World');
    });

    it('should handle consecutive hyphens', () => {
      expect(kebabToTitleCase('hello--world')).toBe('Hello World');
    });
  });
});

describe('toKebabCase', () => {
  describe('positive cases', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('myPropertyName')).toBe('my-property-name');
    });

    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('MyComponent')).toBe('my-component');
    });

    it('should convert snake_case to kebab-case', () => {
      expect(toKebabCase('my_property_name')).toBe('my-property-name');
    });

    it('should convert space-delimited to kebab-case', () => {
      expect(toKebabCase('my property name')).toBe('my-property-name');
    });

    it('should handle single word', () => {
      expect(toKebabCase('hello')).toBe('hello');
    });

    it('should handle acronyms', () => {
      expect(toKebabCase('XMLHttpRequest')).toBe('xmlhttp-request');
    });
  });

  describe('negative cases', () => {
    it('should return empty string for empty input', () => {
      expect(toKebabCase('')).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(toKebabCase(undefined)).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should remove leading hyphens', () => {
      expect(toKebabCase('-myProperty')).toBe('my-property');
    });

    it('should remove trailing hyphens', () => {
      expect(toKebabCase('myProperty-')).toBe('my-property');
    });

    it('should normalize consecutive hyphens', () => {
      expect(toKebabCase('my--property')).toBe('my-property');
    });

    it('should convert mixed casing', () => {
      expect(toKebabCase('My_Property Name')).toBe('my-property-name');
    });

    it('should handle numbers in string', () => {
      expect(toKebabCase('myProperty2Name')).toBe('my-property2-name');
    });
  });
});

describe('toPascalCase', () => {
  describe('positive cases', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('my-component')).toBe('MyComponent');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('my_component_name')).toBe('MyComponentName');
    });

    it('should convert space-delimited to PascalCase', () => {
      expect(toPascalCase('my component name')).toBe('MyComponentName');
    });

    it('should convert camelCase to PascalCase', () => {
      expect(toPascalCase('myComponent')).toBe('MyComponent');
    });

    it('should handle single word', () => {
      expect(toPascalCase('hello')).toBe('Hello');
    });
  });

  describe('negative cases', () => {
    it('should return empty string for empty input', () => {
      expect(toPascalCase('')).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(toPascalCase(undefined)).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle consecutive special characters', () => {
      expect(toPascalCase('my--component')).toBe('MyComponent');
    });

    it('should handle mixed delimiters', () => {
      expect(toPascalCase('my-component_name')).toBe('MyComponentName');
    });

    it('should handle numbers in string', () => {
      expect(toPascalCase('my-component-2')).toBe('MyComponent2');
    });
  });
});

describe('toCamelCase', () => {
  describe('positive cases', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('my-component')).toBe('myComponent');
    });

    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('my_component_name')).toBe('myComponentName');
    });

    it('should convert space-delimited to camelCase', () => {
      expect(toCamelCase('my component name')).toBe('myComponentName');
    });

    it('should convert PascalCase to camelCase', () => {
      expect(toCamelCase('MyComponent')).toBe('myComponent');
    });

    it('should handle single word', () => {
      expect(toCamelCase('hello')).toBe('hello');
    });
  });

  describe('negative cases', () => {
    it('should return empty string for empty input', () => {
      expect(toCamelCase('')).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(toCamelCase(undefined)).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle consecutive special characters', () => {
      expect(toCamelCase('my--component')).toBe('myComponent');
    });

    it('should handle mixed delimiters', () => {
      expect(toCamelCase('my-component_name')).toBe('myComponentName');
    });

    it('should handle numbers in string', () => {
      expect(toCamelCase('my-component-2')).toBe('myComponent2');
    });

    it('should handle already camelCase', () => {
      expect(toCamelCase('myComponent')).toBe('myComponent');
    });
  });
});
