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
 * @fileoverview Tests for component model normalization.
 */

import { FigmaPropertyType } from '../../src/core/types';
import { deriveImportPath, mapComponentModel } from '../../src/mappers/component-model';
import { createMockEvent, createMockProperty } from '../helpers/fixtures';

describe('deriveImportPath', () => {
  it('should derive import paths relative to the components marker', () => {
    const componentDir = '/repo/packages/components/src/components/button';

    expect(deriveImportPath(componentDir)).toBe('components/button');
  });

  it('should fall back to the component directory basename when marker is missing', () => {
    const componentDir = '/tmp/components/standalone';

    expect(deriveImportPath(componentDir)).toBe('standalone');
  });
});

describe('mapComponentModel', () => {
  it('should normalize model fields and map attributes', () => {
    const props = [
      createMockProperty({ name: 'label', attribute: 'label', type: FigmaPropertyType.String }),
      createMockProperty({ name: 'disabled', attribute: 'disabled', type: FigmaPropertyType.Boolean }),
    ];
    const events = [createMockEvent({ name: 'ready' })];

    const model = mapComponentModel({
      className: 'Button',
      tagName: 'my-button',
      filePath: '/repo/packages/components/src/components/button/button.component.ts',
      componentDir: '/repo/packages/components/src/components/button',
      props,
      events,
    });

    expect(model.className).toBe('Button');
    expect(model.tagName).toBe('my-button');
    expect(model.importPath).toBe('components/button');
    expect(model.attributes.map((attr) => attr.name)).toEqual(['label', 'disabled']);
    expect(model.events).toEqual(events);
  });

  it('should default missing class names to UnknownComponent', () => {
    const model = mapComponentModel({
      className: '   ',
      tagName: 'my-unknown',
      filePath: '/tmp/unknown.component.ts',
      componentDir: '/tmp',
      props: [],
      events: [],
    });

    expect(model.className).toBe('UnknownComponent');
  });
});
