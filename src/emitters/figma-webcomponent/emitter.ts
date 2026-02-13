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

import path from 'node:path';

import { buildGeneratedSectionMarkers } from '../../core/constants';
import { type EmitResult, EmitterTarget, GeneratedSectionName } from '../../core/types';
import type { Emitter, EmitterContext } from '../types';
import {
  buildExampleTemplate,
  buildFilePayload,
  buildPropsSection,
  createFilePayload,
  getComponentBaseName,
  indent,
  withExample,
  withImports,
  withProps,
  withSections,
  withWarnings,
} from '../utils';

import { buildImportsLine } from './helpers';

/**
 * Emitter for generating Figma Code Connect files for Web Components.
 * Produces `*.webcomponent.figma.ts` files using `@figma/code-connect/html`.
 */
export class FigmaWebComponentEmitter implements Emitter {
  readonly target = EmitterTarget.WebComponent;

  /**
   * Emits a Figma Code Connect file for a Web Component.
   *
   * @param emitterContext - Context containing model and emitter options.
   * @returns Emit result containing file content and metadata.
   */
  emit(emitterContext: EmitterContext): EmitResult {
    const { model, options } = emitterContext;
    const componentName = getComponentBaseName(model);
    const fileName = `${componentName}.webcomponent.figma.ts`;
    const filePath = path.join(model.componentDir, 'code-connect', fileName);
    const figmaUrl = `<FIGMA_${componentName.toUpperCase()}_URL>`;

    // Build props section with warning collection
    const { lines: propsLines, warnings } = buildPropsSection(model.props, 0);

    // Build example template
    const example = buildExampleTemplate(model.tagName, model.attributes);
    const importsLine = buildImportsLine(model, options);

    // Compose generated section content
    const propsSection = propsLines.join('\n');
    const exampleSection = `example: ${example.example},`;
    const propsMarkers = buildGeneratedSectionMarkers(GeneratedSectionName.Props);
    const exampleMarkers = buildGeneratedSectionMarkers(GeneratedSectionName.Example);
    return buildFilePayload(
      createFilePayload(filePath, 'created'),
      withImports(['// @ts-ignore', "import figma, { html } from '@figma/code-connect/html';", '']),
      withSections({ lines: [`figma.connect('${figmaUrl}', {`] }),
      withProps({ content: propsSection, markers: propsMarkers, name: GeneratedSectionName.Props, depth: 1 }),
      withExample({ content: exampleSection, markers: exampleMarkers, name: GeneratedSectionName.Example, depth: 1 }),
      withSections({ lines: [`${indent(1)}${importsLine}`, '});', ''] }),
      withWarnings(warnings),
    );
  }
}
