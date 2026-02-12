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

import ts from 'typescript';

import type { EventDescriptor } from '../../core/types';
import type { EventDescriptor } from '../../core/types';
import { type ExtractionResult } from '../../core/types';
import { mergeByKey } from '../../utils/merge-by-key';
import { toPascalCase } from '../../utils/strings';
import { getJSDocTagText } from '../../utils/ts';

import type { ASTVisitorResult } from './ast-visitor';
import { extractFromChain } from './chain-extractor';

/**
 * Result of event extraction containing events and warnings.
 */
export type EventExtractionResult = ExtractionResult<EventDescriptor>;

/**
 * Context for event extraction operations.
 */
export interface EventExtractionContext {
  readonly astData: ASTVisitorResult;
}

/**
 * Derives a React handler name from an event name and optional comment.
 *
 * @param eventName - Event name to transform.
 * @param comment - Optional JSDoc comment text for overrides.
 * @returns Derived React handler name.
 */
const deriveReactHandler = (eventName: string, comment?: string): string => {
  if (comment) {
    const reactMatch = comment.match(/React:\s*([A-Za-z0-9_]+)/i);
    if (reactMatch?.[1]) {
      return reactMatch[1];
    }
  }
  return `on${toPascalCase(eventName)}`;
};

/**
 * Extracts events from JSDoc `@event` tags on a class.
 *
 * @param classDeclaration - Class node to inspect.
 * @returns Extracted event descriptors.
 */
const extractEventsFromJSDoc = (classDeclaration: ts.ClassLikeDeclaration): EventDescriptor[] => {
  const tags = ts.getJSDocTags(classDeclaration).filter((tag) => tag.tagName.text === 'event');
  return tags.flatMap((tag) => {
    const text = getJSDocTagText(tag);
    if (!text) {
      return [];
    }
    const nameMatch = text.match(/^([A-Za-z0-9-:_]+)/);
    const eventName = nameMatch?.[1];
    if (!eventName) {
      return [];
    }
    return [
      {
        name: eventName,
        reactHandler: deriveReactHandler(eventName, text),
        detailType: null,
      },
    ];
  });
};

/**
 * Extracts events from dispatchEvent calls using pre-collected AST data.
 *
 * @param classDeclaration - Class node to inspect.
 * @param astData - Pre-collected AST data.
 * @returns Extracted event descriptors.
 */
const extractEventsFromDispatch = (
  classDeclaration: ts.ClassLikeDeclaration,
  astData: ASTVisitorResult,
): EventDescriptor[] => {
  // Use pre-collected dispatchEvent calls
  const events = astData.dispatchEventCalls
    .filter((call) => call.containingClass === classDeclaration)
    .map((call) => ({
      name: call.eventName,
      reactHandler: deriveReactHandler(call.eventName),
      detailType: null,
    }));

  if (events.length === 0) {
    return [];
  }

  const unique = mergeByKey(events, {
    /**
     * Provides the merge key for an event descriptor.
     *
     * @param event - Event descriptor to key.
     * @returns Event name for deduplication.
     */
    getKey: (event) => event.name,
  });

  return Array.from(unique.values());
};

/**
 * Extracts event descriptors from a class declaration.
 *
 * @param classDeclaration - Class node to inspect.
 * @param context - Event extraction context.
 * @returns Extracted events and warnings.
 */
export const extractEvents = (
  classDeclaration: ts.ClassLikeDeclaration,
  context: EventExtractionContext,
): EventExtractionResult => {
  const warnings: string[] = [];
  const events = [
    ...extractEventsFromJSDoc(classDeclaration),
    ...extractEventsFromDispatch(classDeclaration, context.astData),
  ];
  const unique = mergeByKey(events, {
    /**
     * Provides the merge key for an event descriptor.
     *
     * @param event - Event descriptor to key.
     * @returns Event name for deduplication.
     */
    getKey: (event) => event.name,
  });

  return {
    items: Array.from(unique.values()),
    warnings,
  };
};

/**
 * Extracts event descriptors across an inheritance chain.
 *
 * @param classChain - Ordered class chain to inspect.
 * @param context - Event extraction context.
 * @returns Extracted events and warnings for the chain.
 */
export const extractEventsFromChain = (
  classChain: readonly ts.ClassLikeDeclaration[],
  context: EventExtractionContext,
): EventExtractionResult => {
  const extracted = extractFromChain(classChain, {
    /**
     * Extracts events and warnings for a class node.
     *
     * @param classDecl - Class declaration to process.
     * @returns Extracted events and warnings.
     */
    extract: (classDecl) => {
      const jsdocEvents = extractEventsFromJSDoc(classDecl);
      const dispatchEvents = extractEventsFromDispatch(classDecl, context.astData);
      return {
        items: [...jsdocEvents, ...dispatchEvents],
        warnings: [],
      };
    },
    /**
     * Provides the merge key for an event descriptor.
     *
     * @param event - Event descriptor to key.
     * @returns Event name for deduplication.
     */
    getKey: (event) => event.name,
  });

  return {
    items: extracted.items,
    warnings: extracted.warnings,
  };
};
