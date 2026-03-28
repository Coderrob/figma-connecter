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

import {
  buildGeneratedSectionMarkers,
  FIGMA_PACKAGE_REACT,
} from "@/src/core/constants";
import {
  type IGeneratedSectionMarkers,
  type IEmitResult,
  EmitterTarget,
  FileChangeStatus,
  GeneratedSectionName,
} from "@/src/core/types";
import type { IEmitter, IEmitterContext } from "@/src/emitters/types";
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
} from "@/src/emitters/utils";
import {
  buildCodeConnectFilePath,
  resolveDistReactImportPath,
} from "@/src/utils/paths";

/**
 * IEmitter for generating Figma Code Connect files for React components.
 * Produces `*.react.figma.tsx` files using `@figma/code-connect`.
 */
export class FigmaReactEmitter implements IEmitter {
  readonly target = EmitterTarget.React;

  /**
   * Builds generated props/example section content and markers.
   *
   * @param emitterContext - Context containing model and emitter options.
   * @returns Section payload and warnings for output generation.
   */
  private buildSectionPayload(emitterContext: Readonly<IEmitterContext>): {
    readonly exampleMarkers: IGeneratedSectionMarkers;
    readonly exampleSection: string;
    readonly propsMarkers: IGeneratedSectionMarkers;
    readonly propsSection: string;
    readonly warnings: readonly string[];
  } {
    const { model } = emitterContext;
    const { lines: propsLines, warnings } = buildPropsSection(model.props, 0);
    return {
      propsSection: propsLines.join("\n"),
      exampleSection: buildReactExampleSection(model.className),
      propsMarkers: buildGeneratedSectionMarkers(GeneratedSectionName.Props),
      exampleMarkers: buildGeneratedSectionMarkers(
        GeneratedSectionName.Example,
      ),
      warnings,
    };
  }

  /**
   * Resolves the component import path for React Code Connect output.
   *
   * @param componentDir - Absolute component directory path.
   * @param baseImportPath - Optional override for component import base.
   * @returns Import path string for the React component.
   */
  private resolveReactImportPath(
    componentDir: string,
    baseImportPath?: string,
  ): string {
    if (baseImportPath) {
      return `${baseImportPath}/dist/react`;
    }
    return resolveDistReactImportPath(componentDir);
  }

  /**
   * Emits a Figma Code Connect file for a React component.
   *
   * @param emitterContext - Context containing model and emitter options.
   * @returns Emit result containing file content and metadata.
   */
  emit(emitterContext: Readonly<IEmitterContext>): IEmitResult {
    const { model, options } = emitterContext;
    const componentName = getComponentBaseName(model);
    const fileName = `${componentName}.react.figma.tsx`;
    const filePath = buildCodeConnectFilePath(model.componentDir, fileName);
    const figmaUrl = `<FIGMA_${componentName.toUpperCase()}_URL>`;
    const importPath = this.resolveReactImportPath(
      model.componentDir,
      options.baseImportPath,
    );
    const {
      propsSection,
      exampleSection,
      propsMarkers,
      exampleMarkers,
      warnings,
    } = this.buildSectionPayload(emitterContext);
    return this.buildEmitResult({
      filePath,
      className: model.className,
      importPath,
      figmaUrl,
      propsSection,
      propsMarkers,
      exampleSection,
      exampleMarkers,
      warnings,
    });
  }

  /**
   * Builds the final file payload for React Code Connect output.
   *
   * @param emitOptions - Precomputed content and metadata for result construction.
   * @returns Emit result with generated file payload and warnings.
   */
  private buildEmitResult(
    emitOptions: Readonly<{
      className: string;
      exampleMarkers: Readonly<IGeneratedSectionMarkers>;
      exampleSection: string;
      figmaUrl: string;
      filePath: string;
      importPath: string;
      propsMarkers: Readonly<IGeneratedSectionMarkers>;
      propsSection: string;
      warnings: readonly string[];
    }>,
  ): IEmitResult {
    const {
      filePath,
      className,
      importPath,
      figmaUrl,
      propsSection,
      propsMarkers,
    } = emitOptions;
    const { exampleSection, exampleMarkers, warnings } = emitOptions;
    return buildFilePayload(
      createFilePayload(filePath, FileChangeStatus.Created),
      withImports([
        `import { ${className} } from '${importPath}';`,
        `import figma from '${FIGMA_PACKAGE_REACT}';`,
        "",
      ]),
      withSections({ lines: [`figma.connect('${figmaUrl}', {`] }),
      withProps({
        content: propsSection,
        markers: propsMarkers,
        name: GeneratedSectionName.Props,
        depth: 1,
      }),
      withExample({
        content: exampleSection,
        markers: exampleMarkers,
        name: GeneratedSectionName.Example,
        depth: 1,
      }),
      withSections({ lines: ["});", ""] }),
      withWarnings(warnings),
    );
  }
}
