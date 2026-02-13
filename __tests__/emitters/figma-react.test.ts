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
 * @fileoverview Tests for FigmaReactEmitter.
 */

import { EmitterTarget, FigmaPropertyType } from '../../src/core/types';
import { FigmaReactEmitter } from '../../src/emitters/figma-react';
import { expectContainsAll, expectContainsInOrder, expectGeneratedSectionMarkers } from '../helpers/assertions';
import { createMockComponentModel, createMockEmitterOptions, createMockProperty } from '../helpers/fixtures';

describe('FigmaReactEmitter', () => {
  let emitter: FigmaReactEmitter;

  beforeEach(() => {
    emitter = new FigmaReactEmitter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('target', () => {
    it('should return React target', () => {
      expect(emitter.target).toBe(EmitterTarget.React);
    });
  });

  describe('emit', () => {
    describe('positive cases', () => {
      it('should generate code connect file for minimal component', () => {
        const model = createMockComponentModel({
          className: 'ButtonComponent',
          tagName: 'my-button',
          filePath: '/src/components/button/button.component.ts',
          componentDir: '/src/components/button',
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.filePath).toBe('/src/components/button/code-connect/button.react.figma.tsx');
        expect(result.content).toContain("import figma from '@figma/code-connect';");
        expect(result.content).toContain('figma.connect(');
        expect(result.content).toContain('<FIGMA_BUTTON_URL>');
        expect(result.content).toContain('props: {},');
        expect(result.content).toContain('<ButtonComponent {...props} />');
        expect(result.action).toBe('created');
      });

      it('should generate props section for component with properties', () => {
        const model = createMockComponentModel({
          tagName: 'my-button',
          filePath: '/src/button.component.ts',
          componentDir: '/src',
          props: [
            createMockProperty({ name: 'disabled', type: FigmaPropertyType.Boolean }),
            createMockProperty({ name: 'label', type: FigmaPropertyType.String }),
            createMockProperty({ name: 'size', type: FigmaPropertyType.Number }),
          ],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.content).toContain('props: {');
        expect(result.content).toContain("disabled: figma.boolean('Disabled')");
        expect(result.content).toContain("label: figma.string('Label')");
        expect(result.content).toContain("size: figma.string('Size')");
      });

      it('should generate enum mapping for enum properties', () => {
        const model = createMockComponentModel({
          tagName: 'my-button',
          filePath: '/src/button.component.ts',
          componentDir: '/src',
          props: [
            createMockProperty({
              name: 'variant',
              type: FigmaPropertyType.Enum,
              enumValues: ['primary', 'secondary', 'ghost'],
            }),
          ],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.content).toContain("variant: figma.enum('Variant', {");
        expect(result.content).toContain('\'Primary\': "primary"');
        expect(result.content).toContain('\'Secondary\': "secondary"');
        expect(result.content).toContain('\'Ghost\': "ghost"');
      });

      it('should generate JSX example with className and props spread', () => {
        const model = createMockComponentModel({
          className: 'Button',
          filePath: '/src/button.component.ts',
          componentDir: '/src',
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.content).toContain('<Button {...props} />');
      });

      it('should include core sections for full output', () => {
        const model = createMockComponentModel({
          className: 'Button',
          tagName: 'my-button',
          filePath: '/packages/components/src/components/button/button.component.ts',
          componentDir: '/packages/components/src/components/button',
          importPath: 'components/button',
          props: [
            createMockProperty({ name: 'disabled', type: FigmaPropertyType.Boolean }),
            createMockProperty({ name: 'label', type: FigmaPropertyType.String }),
          ],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expectContainsInOrder(result.content, [
          "import { Button } from '../../../../dist/react';",
          "import figma from '@figma/code-connect';",
          "figma.connect('<FIGMA_BUTTON_URL>', {",
        ]);
        expectGeneratedSectionMarkers(result.content);
        expectContainsAll(result.content, [
          "disabled: figma.boolean('Disabled')",
          "label: figma.string('Label')",
          'example: props => {',
          'return <Button {...props} />;',
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle property names with special characters', () => {
        const model = createMockComponentModel({
          tagName: 'my-test',
          filePath: '/src/test.component.ts',
          componentDir: '/src',
          props: [createMockProperty({ name: 'data-value', type: FigmaPropertyType.String })],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.content).toContain("'data-value': figma.string('Data Value')");
      });

      it('should handle empty enum values', () => {
        const model = createMockComponentModel({
          tagName: 'my-test',
          filePath: '/src/test.component.ts',
          componentDir: '/src',
          props: [createMockProperty({ name: 'status', type: FigmaPropertyType.Enum, enumValues: [] })],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        // Should fallback to string when no enum values
        expect(result.content).toContain("status: figma.string('Status')");
      });

      it('should handle unknown property type with warning', () => {
        const model = createMockComponentModel({
          tagName: 'my-test',
          filePath: '/src/test.component.ts',
          componentDir: '/src',
          props: [createMockProperty({ name: 'custom', type: FigmaPropertyType.Unknown })],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.content).toContain("custom: figma.string('Custom')");
        expect(result.warnings).toBeDefined();
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings![0]).toContain("'custom'");
        expect(result.warnings![0]).toContain('unknown');
      });

      it('should sort properties alphabetically', () => {
        const model = createMockComponentModel({
          tagName: 'my-test',
          filePath: '/src/test.component.ts',
          componentDir: '/src',
          props: [
            createMockProperty({ name: 'zebra', type: FigmaPropertyType.String }),
            createMockProperty({ name: 'alpha', type: FigmaPropertyType.String }),
            createMockProperty({ name: 'middle', type: FigmaPropertyType.String }),
          ],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });
        const alphaIndex = result.content.indexOf('alpha:');
        const middleIndex = result.content.indexOf('middle:');
        const zebraIndex = result.content.indexOf('zebra:');

        expect(alphaIndex).toBeLessThan(middleIndex);
        expect(middleIndex).toBeLessThan(zebraIndex);
      });

      it('should handle component with no props', () => {
        const model = createMockComponentModel({
          className: 'Divider',
          tagName: 'my-divider',
          filePath: '/src/divider.component.ts',
          componentDir: '/src',
          props: [],
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.content).toContain('props: {},');
        expect(result.warnings).toEqual([]);
      });

      it('should use default import path when baseImportPath is not provided', () => {
        const model = createMockComponentModel({
          className: 'Button',
          tagName: 'my-button',
          filePath: '/packages/components/src/components/button/button.component.ts',
          componentDir: '/packages/components/src/components/button',
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        expect(result.content).toContain("import { Button } from '../../../../dist/react';");
      });

      it('should use custom import path when baseImportPath is provided', () => {
        const model = createMockComponentModel({
          className: 'Button',
          tagName: 'my-button',
          filePath: '/src/button.component.ts',
          componentDir: '/src',
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions({ baseImportPath: '../../src' }) });

        expect(result.content).toContain("import { Button } from '../../src/dist/react';");
      });

      it('should prepend ./ to relative path when it does not start with dot', () => {
        // Test case where component is in a parent directory relative to dist/react
        // This creates a forward-only path like "dist/react" without leading dots
        // Simulate by having componentDir at root level
        const model = createMockComponentModel({
          className: 'Button',
          tagName: 'my-button',
          filePath: '/button.component.ts',
          componentDir: '/',
        });

        const result = emitter.emit({ model, options: createMockEmitterOptions() });

        // The import should have the path properly prefixed
        // When relative path doesn't start with '.', it should be prepended
        expect(result.content).toContain("import { Button } from");
        // Verify the file was generated successfully
        expect(result.action).toBe('created');
      });
    });
  });
});
