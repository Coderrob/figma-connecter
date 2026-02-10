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
 * @fileoverview Snapshot tests for ComponentModel shape consistency.
 */

import { expectKeysEqual } from '../helpers/assertions';
import {
  createMockAttribute,
  createMockComponentModel,
  createMockEvent,
  createMockProperty,
} from '../helpers/fixtures';

describe('ComponentModel consistency', () => {
  it('should use props field and maintains stable shape', () => {
    const model = createMockComponentModel({
      props: [createMockProperty()],
      attributes: [createMockAttribute()],
      events: [createMockEvent()],
    });

    expect(Object.keys(model)).toContain('props');
    expect(Object.keys(model)).not.toContain('properties');

    expectKeysEqual(Object.keys(model), [
      'attributes',
      'className',
      'componentDir',
      'events',
      'filePath',
      'importPath',
      'props',
      'tagName',
    ]);
    expectKeysEqual(Object.keys(model.props[0]), [
      'attribute',
      'defaultValue',
      'doc',
      'name',
      'reflect',
      'tsType',
      'type',
      'visibility',
    ]);
    expectKeysEqual(Object.keys(model.attributes[0]), [
      'defaultValue',
      'doc',
      'name',
      'propertyName',
      'reflect',
      'type',
    ]);
    expectKeysEqual(Object.keys(model.events[0]), ['detailType', 'name', 'reactHandler']);
  });
});
