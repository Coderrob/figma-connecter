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
  FIGMA_PACKAGE_HTML,
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
} from "@/src/emitters/shared/utils";
import { buildCodeConnectFilePath } from "@/src/utils/paths";

import { buildImportsLine } from "./helpers";

/**
 * IEmitter for generating Figma Code Connect files for Web Components.
 * Produces `*.webcomponent.figma.ts` files using `@figma/code-connect/html`.
 */
export class FigmaWebComponentEmitter implements IEmitter {
  readonly target = EmitterTarget.WebComponent;

  /**
   * Builds generated props/example section content and markers.
   *
   * @param emitterContext - Context containing model and emitter options.
   * @returns Section payload and warnings for output generation.
   */
  private buildSectionPayload(emitterContext: Readonly<IEmitterContext>): {
    readonly exampleMarkers: IGeneratedSectionMarkers;
    readonly exampleSection: string;
    readonly importsLine: string;
    readonly propsMarkers: IGeneratedSectionMarkers;
    readonly propsSection: string;
    readonly warnings: readonly string[];
  } {
    const { model, options } = emitterContext;
    const { lines: propsLines, warnings } = buildPropsSection(model.props, 0);
    const example = buildExampleTemplate(model.tagName, model.attributes);
    return {
      propsSection: propsLines.join("\n"),
      exampleSection: `example: ${example.example},`,
      importsLine: buildImportsLine(model, options),
      propsMarkers: buildGeneratedSectionMarkers(GeneratedSectionName.Props),
      exampleMarkers: buildGeneratedSectionMarkers(
        GeneratedSectionName.Example,
      ),
      warnings,
    };
  }

  /**
   * Emits a Figma Code Connect file for a Web Component.
   *
   * @param emitterContext - Context containing model and emitter options.
   * @returns Emit result containing file content and metadata.
   */
  emit(emitterContext: Readonly<IEmitterContext>): IEmitResult {
    const { model } = emitterContext;
    const componentName = getComponentBaseName(model);
    const fileName = `${componentName}.webcomponent.figma.ts`;
    const filePath = buildCodeConnectFilePath(model.componentDir, fileName);
    const figmaUrl = `<FIGMA_${componentName.toUpperCase()}_URL>`;
    const {
      propsSection,
      exampleSection,
      importsLine,
      propsMarkers,
      exampleMarkers,
      warnings,
    } = this.buildSectionPayload(emitterContext);
    return this.buildEmitResult({
      filePath,
      figmaUrl,
      propsSection,
      propsMarkers,
      exampleSection,
      exampleMarkers,
      importsLine,
      warnings,
    });
  }

  /**
   * Builds the final file payload for Web Component Code Connect output.
   *
   * @param emitOptions - Precomputed content and metadata for result construction.
   * @returns Emit result with generated file payload and warnings.
   */
  private buildEmitResult(
    emitOptions: Readonly<{
      exampleMarkers: Readonly<IGeneratedSectionMarkers>;
      exampleSection: string;
      figmaUrl: string;
      filePath: string;
      importsLine: string;
      propsMarkers: Readonly<IGeneratedSectionMarkers>;
      propsSection: string;
      warnings: readonly string[];
    }>,
  ): IEmitResult {
    const { filePath, figmaUrl, propsSection, propsMarkers, exampleSection } =
      emitOptions;
    const { exampleMarkers, importsLine, warnings } = emitOptions;
    return buildFilePayload(
      createFilePayload(filePath, FileChangeStatus.Created),
      withImports([
        "// @ts-ignore",
        `import figma, { html } from '${FIGMA_PACKAGE_HTML}';`,
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
      withSections({ lines: [`${indent(1)}${importsLine}`, "});", ""] }),
      withWarnings(warnings),
    );
  }
}
