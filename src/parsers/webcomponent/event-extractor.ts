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

import type { IEventDescriptor } from "@/src/core/types";

import type {
  EventExtractionResult,
  IEventExtractionContext,
} from "@/src/parsers/webcomponent/types";
import { mergeByKey } from "@/src/utils/merge-by-key";
import { toPascalCase } from "@/src/utils/strings";
import { getJSDocTagText } from "@/src/utils/ts";
import ts from "typescript";

import type {
  IASTVisitorResult,
  IDispatchEventCall,
} from "./shared/ast-visitor";
import { extractFromChain } from "./shared/chain-extractor";

const JSDOC_EVENT_TAG = "event";
const JSDOC_EVENT_NAME_PATTERN = /^([A-Za-z0-9-:_]+)/;

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
 * Extracts event descriptors from a single class declaration.
 *
 * Events are collected from both class-level JSDoc `@event` tags and
 * `dispatchEvent(...)` calls discovered during AST visitation.
 *
 * @param classDeclaration - Class declaration to inspect.
 * @param context - Event extraction context with pre-collected AST data.
 * @returns Extracted events and any warnings.
 */
export const extractEvents = (
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
  context: Readonly<IEventExtractionContext>,
): EventExtractionResult => {
  return createEventExtractionResult(
    extractEventsForClass(context, classDeclaration).items,
  );
};

/**
 * Builds extraction result for a class within an inheritance chain.
 * @param context - Event extraction context.
 * @param classDecl - Class declaration to process.
 * @returns Event extraction result for the class declaration.
 */
function extractEventsForClass(
  context: Readonly<IEventExtractionContext>,
  classDecl: Readonly<ts.ClassLikeDeclaration>,
): EventExtractionResult {
  return createEventExtractionResult(
    collectEventsForClass(classDecl, context.astData),
  );
}

/**
 * Extracts and merges event descriptors across an inheritance chain.
 *
 * @param classChain - Ordered class chain to inspect.
 * @param context - Event extraction context with pre-collected AST data.
 * @returns Deduplicated events and merged warnings for the class chain.
 */
export const extractEventsFromChain = (
  classChain: readonly ts.ClassLikeDeclaration[],
  context: Readonly<IEventExtractionContext>,
): EventExtractionResult => {
  const extracted = extractFromChain(classChain, {
    extract: extractEventsForClass.bind(undefined, context),
    getKey: getEventKey,
  });

  return {
    items: extracted.items,
    warnings: extracted.warnings,
  };
};

/**
 * Collects raw event descriptors for a single class declaration.
 *
 * @param classDeclaration - Class declaration to inspect.
 * @param astData - Pre-collected AST data containing dispatch event calls.
 * @returns Event descriptors collected from JSDoc and dispatch calls.
 */
function collectEventsForClass(
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
  astData: Readonly<IASTVisitorResult>,
): readonly IEventDescriptor[] {
  return [
    ...extractEventsFromJSDoc(classDeclaration),
    ...extractEventsFromDispatch(classDeclaration, astData),
  ];
}

/**
 * Creates a normalized event extraction result with deduplicated items.
 *
 * @param events - Event descriptors to normalize.
 * @returns Extraction result with de-duplicated events and no warnings.
 */
function createEventExtractionResult(
  events: readonly IEventDescriptor[],
): EventExtractionResult {
  return {
    items: dedupeEvents(events),
    warnings: [],
  };
}

/**
 * Extracts events from `dispatchEvent(...)` calls belonging to a class.
 *
 * @param classDeclaration - Class declaration whose dispatch calls should be considered.
 * @param astData - Pre-collected AST data containing dispatch call records.
 * @returns Deduplicated dispatch-derived event descriptors.
 */
function extractEventsFromDispatch(
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
  astData: Readonly<IASTVisitorResult>,
): IEventDescriptor[] {
  const events = astData.dispatchEventCalls
    .filter(isDispatchCallForClass.bind(undefined, classDeclaration))
    .map(mapDispatchCallToEvent);
  return dedupeEvents(events);
}

/**
 * Extracts event descriptors from class-level JSDoc `@event` tags.
 *
 * @param classDeclaration - Class declaration to inspect.
 * @returns Event descriptors derived from matching JSDoc tags.
 */
function extractEventsFromJSDoc(
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
): IEventDescriptor[] {
  const tags = ts.getJSDocTags(classDeclaration).filter(isEventTag);
  return tags.flatMap(mapJSDocTagToEvents);
}

/**
 * De-duplicates event descriptors by event name.
 *
 * @param events - Event descriptors to normalize.
 * @returns De-duplicated event descriptors in insertion order.
 */
function dedupeEvents(
  events: readonly IEventDescriptor[],
): IEventDescriptor[] {
  if (events.length === 0) {
    return [];
  }

  const unique = mergeByKey(events, {
    getKey: getEventKey,
  });
  return Array.from(unique.values());
}

/**
 * Returns the merge key for an event descriptor.
 * @param event - Event descriptor.
 * @returns Event name.
 */
function getEventKey(event: Readonly<IEventDescriptor>): string {
  return event.name;
}

/**
 * Checks whether a dispatch call belongs to the target class declaration.
 * @param classDeclaration - Class declaration to match.
 * @param call - Dispatch event call candidate.
 * @returns True when the call belongs to the class declaration.
 */
function isDispatchCallForClass(
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
  call: Readonly<IDispatchEventCall>,
): boolean {
  return call.containingClass === classDeclaration;
}

/**
 * Narrows JSDoc tags to event tags.
 * @param tag - JSDoc tag candidate.
 * @returns True when the tag is an event tag.
 */
function isEventTag(tag: Readonly<ts.JSDocTag>): boolean {
  return tag.tagName.text === JSDOC_EVENT_TAG;
}

/**
 * Converts a dispatch call record to an event descriptor.
 * @param call - Dispatch event call record.
 * @returns Event descriptor.
 */
function mapDispatchCallToEvent(
  call: Readonly<IDispatchEventCall>,
): IEventDescriptor {
  return {
    name: call.eventName,
    reactHandler: deriveReactHandler(call.eventName),
    detailType: null,
  };
}

/**
 * Converts a JSDoc event tag to zero-or-one event descriptors.
 * @param tag - JSDoc event tag.
 * @returns Event descriptor list derived from the tag.
 */
function mapJSDocTagToEvents(tag: Readonly<ts.JSDocTag>): IEventDescriptor[] {
  const parsedEvent = parseJSDocEventTag(tag);
  if (!parsedEvent) {
    return [];
  }

  const { eventName, text } = parsedEvent;
  return [createEventDescriptor(eventName, text)];
}

/**
 * Parses an event name and raw text payload from a JSDoc `@event` tag.
 *
 * @param tag - JSDoc event tag to inspect.
 * @returns Parsed tag payload or `null` when the tag does not declare an event name.
 */
function parseJSDocEventTag(
  tag: Readonly<ts.JSDocTag>,
): { readonly eventName: string; readonly text: string } | null {
  const text = getJSDocTagText(tag);
  if (!text) {
    return null;
  }

  const nameMatch = text.match(JSDOC_EVENT_NAME_PATTERN);
  const eventName = nameMatch?.[1];
  if (!eventName) {
    return null;
  }

  return { eventName, text };
}

/**
 * Creates a normalized event descriptor.
 *
 * @param eventName - Event name to represent.
 * @param comment - Optional raw source text used for handler overrides.
 * @returns Normalized event descriptor.
 */
function createEventDescriptor(
  eventName: string,
  comment?: string,
): IEventDescriptor {
  return {
    name: eventName,
    reactHandler: deriveReactHandler(eventName, comment),
    detailType: null,
  };
}
