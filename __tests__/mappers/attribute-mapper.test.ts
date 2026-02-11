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
 * @fileoverview Tests for attribute mapper utilities.
 */

import { FigmaPropertyType, type PropertyDescriptor, PropertyVisibility } from '../../src/core/types';
import { mapPropertiesToAttributes, mapPropertyToAttribute } from '../../src/mappers/attribute-mapper';

describe('mapPropertyToAttribute', () => {
  const baseProperty: PropertyDescriptor = {
    name: 'expanded',
    attribute: 'expanded',
    type: FigmaPropertyType.Boolean,
    tsType: 'boolean',
    reflect: true,
    defaultValue: false,
    doc: 'Expands the button.',
    visibility: PropertyVisibility.Public,
  };

  describe('positive cases', () => {
    it('should map property metadata to attribute descriptor', () => {
      const result = mapPropertyToAttribute(baseProperty);

      expect(result).toMatchObject({
        name: 'expanded',
        propertyName: 'expanded',
        type: FigmaPropertyType.Boolean,
        reflect: true,
        defaultValue: false,
        doc: 'Expands the button.',
      });
    });
  });

  describe('negative cases', () => {
    it('should return null when attribute is null', () => {
      const result = mapPropertyToAttribute({
        ...baseProperty,
        attribute: null,
      });

      expect(result).toBeNull();
    });

    it('should return null when attribute is an empty string', () => {
      const result = mapPropertyToAttribute({
        ...baseProperty,
        attribute: '',
      });

      expect(result).toBeNull();
    });
  });
});

describe('mapPropertiesToAttributes', () => {
  const baseProperty: PropertyDescriptor = {
    name: 'expanded',
    attribute: 'expanded',
    type: FigmaPropertyType.Boolean,
    tsType: 'boolean',
    reflect: false,
    defaultValue: null,
    doc: null,
    visibility: PropertyVisibility.Public,
  };

  describe('positive cases', () => {
    it('should merge duplicate attribute names with last-in-wins', () => {
      const attributes = mapPropertiesToAttributes([
        baseProperty,
        {
          ...baseProperty,
          name: 'expandedAlias',
          attribute: 'expanded',
          reflect: true,
          defaultValue: true,
          doc: 'Overrides expanded.',
        },
      ]);

      expect(attributes).toEqual([
        {
          name: 'expanded',
          propertyName: 'expandedAlias',
          type: FigmaPropertyType.Boolean,
          reflect: true,
          defaultValue: true,
          doc: 'Overrides expanded.',
        },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should skip properties without attributes', () => {
      const attributes = mapPropertiesToAttributes([
        baseProperty,
        {
          ...baseProperty,
          name: 'internalOnly',
          attribute: null,
        },
      ]);

      expect(attributes).toHaveLength(1);
      expect(attributes[0]).toMatchObject({
        name: 'expanded',
        propertyName: 'expanded',
      });
    });

    it('should return empty array for empty input', () => {
      const attributes = mapPropertiesToAttributes([]);

      expect(attributes).toEqual([]);
    });
  });
});
