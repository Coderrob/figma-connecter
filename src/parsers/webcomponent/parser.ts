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
 * Web Component Parser Module
 *
 * Parses Web Component source files into ComponentModel representations.
 *
 * @module parsers/webcomponent/parser
 */

import { createResult, mergeDiagnostics, type Result } from "../../core/result";
import type {
  ClassSource,
  ComponentModel,
  TagNameResult,
} from "../../core/types";
import type { WebComponentParseResult } from "../../types/parsers-webcomponent";
import { mapComponentModel } from "../../mappers/component-model";
import type { ParseContext, Parser } from "../types";
import { ParserTarget } from "../types";

import { visitSourceFile } from "./ast-visitor";
import { discoverComponentClass } from "./component-discovery";
import { extractPropertyDecorators } from "./decorator-extractor";
import { extractEventsFromChain } from "./event-extractor";
import { resolveInheritanceChain } from "./inheritance-resolver";
import { resolveTagName } from "./tagname-resolver";

// WebComponent parse result type is defined in `src/types/parsers-webcomponent`.

/**
 * Parses a Web Component source file into a ComponentModel.
 *
 * @param parseContext - Parse context for the current source file.
 * @returns Parse result with component model, warnings, and errors.
 */
export const parseWebComponent = (
  parseContext: ParseContext,
): WebComponentParseResult => {
  // Single AST traversal for all extractors
  const astData = visitSourceFile(parseContext.sourceFile);

  const discovery = discoverComponentClass(astData);
  if (!discovery) {
    return mergeDiagnostics(
      createResult<ComponentModel | undefined>(undefined),
      {
        errors: ["No class declaration found in component source file."],
      },
    );
  }

  const { classDeclaration, source } = discovery;
  const className = classDeclaration.name?.text;
  const tagNameResolution = resolveTagName({
    classDeclaration,
    componentDir: parseContext.componentDir,
    componentFilePath: parseContext.filePath,
    className,
    astData,
  });

  const inheritance = resolveInheritanceChain(classDeclaration, {
    checker: parseContext.checker,
    strict: parseContext.strict,
  });

  const properties = extractPropertyDecorators(inheritance.chain, {
    checker: parseContext.checker,
  });

  const eventsExtraction = extractEventsFromChain(inheritance.chain, {
    astData,
  });

  const model: ComponentModel = mapComponentModel({
    className,
    tagName: tagNameResolution.tagName,
    filePath: parseContext.filePath,
    componentDir: parseContext.componentDir,
    props: properties.items,
    events: eventsExtraction.items,
  });

  const strictErrors =
    parseContext.strict && inheritance.unresolved.length > 0
      ? [
          `Unable to resolve base classes for: ${inheritance.unresolved.join(", ")}`,
        ]
      : [];

  const result = mergeDiagnostics(
    createResult<ComponentModel | undefined>(model),
    tagNameResolution,
    inheritance,
    properties,
    eventsExtraction,
    { errors: strictErrors },
  );

  return {
    ...result,
    classSource: source,
    tagNameResult: {
      tagName: tagNameResolution.tagName,
      source: tagNameResolution.source,
    },
  };
};

/**
 * Parser strategy for Web Components.
 */
export class WebComponentParser implements Parser {
  readonly target = ParserTarget.WebComponent;

  /**
   * Parses a component using the WebComponent strategy.
   *
   * @param parseContext - Parse context for the source file.
   * @returns Parse result for the component.
   */
  parse(parseContext: ParseContext): WebComponentParseResult {
    return parseWebComponent(parseContext);
  }
}
