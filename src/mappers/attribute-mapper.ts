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
 * Attribute Mapper Module
 *
 * Maps property metadata into attribute descriptors.
 *
 * @module mappers/attribute-mapper
 */

import type { AttributeDescriptor, PropertyDescriptor } from '../core/types';
import { mergeByKey } from '../utils/merge-by-key';

/**
 * Maps a property descriptor into an attribute descriptor when possible.
 *
 * @param property - Property descriptor to map.
 * @returns Attribute descriptor or null if no attribute is configured.
 */
export const mapPropertyToAttribute = (property: PropertyDescriptor): AttributeDescriptor | null => {
  if (!property.attribute) {
    return null;
  }

  return {
    name: property.attribute,
    propertyName: property.name,
    type: property.type,
    reflect: property.reflect,
    defaultValue: property.defaultValue,
    doc: property.doc,
  };
};

/**
 * Maps property descriptors into unique attribute descriptors.
 *
 * @param properties - Property descriptors to map.
 * @returns Attribute descriptors keyed by attribute name.
 */
export const mapPropertiesToAttributes = (properties: readonly PropertyDescriptor[]): AttributeDescriptor[] => {
  const mapped = properties
    .map(mapPropertyToAttribute)
    .filter((attribute): attribute is AttributeDescriptor => Boolean(attribute));

  const merged = mergeByKey(mapped, {
    /**
     * Provides the merge key for an attribute descriptor.
     *
     * @param attribute - Attribute descriptor to key.
     * @returns Attribute name for deduplication.
     */
    getKey: (attribute) => attribute.name,
  });

  return Array.from(merged.values());
};
