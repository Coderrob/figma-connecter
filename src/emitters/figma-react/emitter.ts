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

import { buildGeneratedSectionMarkers, FIGMA_PACKAGE_REACT } from '../../core/constants';
import { type EmitResult, EmitterTarget, FileChangeStatus, GeneratedSectionName } from '../../core/types';
import { normalizePath } from '../../utils/paths';
import type { Emitter, EmitterContext } from '../types';
import {
  buildFilePayload,
  buildPropsSection,
  buildReactExampleSection,
  createFilePayload,
  getComponentBaseName,
  withExample,
  withImports,
  withProps,
  withSections,
  withWarnings,
} from '../utils';

/**
 * Emitter for generating Figma Code Connect files for React components.
 * Produces `*.react.figma.tsx` files using `@figma/code-connect`.
 */
export class FigmaReactEmitter implements Emitter {
  readonly target = EmitterTarget.React;

  /**
   * Resolves the component import path for React Code Connect output.
   *
   * @param componentDir - Absolute component directory path.
   * @param baseImportPath - Optional override for component import base.
   * @returns Import path string for the React component.
   */
  private resolveReactImportPath(componentDir: string, baseImportPath?: string): string {
    if (baseImportPath) {
      return `${baseImportPath}/dist/react`;
    }

    const normalizedComponentDir = normalizePath(componentDir);
    const srcMarker = '/src/';
    const markerIndex = normalizedComponentDir.lastIndexOf(srcMarker);
    let rootCandidate = path.posix.dirname(normalizedComponentDir);
    if (markerIndex >= 0) {
      rootCandidate = normalizedComponentDir.slice(0, markerIndex);
    }
    const packageRoot = rootCandidate || path.posix.parse(normalizedComponentDir).root;
    const distReactPath = path.posix.join(packageRoot, 'dist', 'react');
    const codeConnectDir = path.posix.join(normalizedComponentDir, 'code-connect');
    let relativePath = path.posix.relative(codeConnectDir, distReactPath);
    if (!relativePath.startsWith('.')) {
      relativePath = `./${relativePath}`;
    }
    return relativePath;
  }

  /**
   * Emits a Figma Code Connect file for a React component.
   *
   * @param emitterContext - Context containing model and emitter options.
   * @returns Emit result containing file content and metadata.
   */
  emit(emitterContext: EmitterContext): EmitResult {
    const { model, options } = emitterContext;
    const componentName = getComponentBaseName(model);
    const fileName = `${componentName}.react.figma.tsx`;
    const filePath = path.join(model.componentDir, 'code-connect', fileName);
    const figmaUrl = `<FIGMA_${componentName.toUpperCase()}_URL>`;

    const importPath = this.resolveReactImportPath(model.componentDir, options.baseImportPath);

    const { lines: propsLines, warnings } = buildPropsSection(model.props, 0);
    const propsSection = propsLines.join('\n');
    const exampleSection = buildReactExampleSection(model.className);
    const propsMarkers = buildGeneratedSectionMarkers(GeneratedSectionName.Props);
    const exampleMarkers = buildGeneratedSectionMarkers(GeneratedSectionName.Example);

    return buildFilePayload(
      createFilePayload(filePath, FileChangeStatus.Created),
      withImports([
        `import { ${model.className} } from '${importPath}';`,
        `import figma from '${FIGMA_PACKAGE_REACT}';`,
        '',
      ]),
      withSections({ lines: [`figma.connect('${figmaUrl}', {`] }),
      withProps({ content: propsSection, markers: propsMarkers, name: GeneratedSectionName.Props, depth: 1 }),
      withExample({ content: exampleSection, markers: exampleMarkers, name: GeneratedSectionName.Example, depth: 1 }),
      withSections({ lines: ['});', ''] }),
      withWarnings(warnings),
    );
  }
}
