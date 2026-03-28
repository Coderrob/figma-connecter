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
} from "@/src/types/parsers-webcomponent";
import { mergeByKey } from "@/src/utils/merge-by-key";
import { toPascalCase } from "@/src/utils/strings";
import { getJSDocTagText } from "@/src/utils/ts";
import ts from "typescript";

import type { IASTVisitorResult, IDispatchEventCall } from "./ast-visitor";
import { extractFromChain } from "./chain-extractor";

const JSDOC_EVENT_TAG = "event";

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
 * extractEvents TODO: describe.
 * @param classDeclaration TODO: describe parameter
 * @param context TODO: describe parameter
 * @returns TODO: describe return value
 */
export const extractEvents = (
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
  context: Readonly<IEventExtractionContext>,
): EventExtractionResult => {
  const warnings: string[] = [];
  const events = [
    ...extractEventsFromJSDoc(classDeclaration),
    ...extractEventsFromDispatch(classDeclaration, context.astData),
  ];
  const unique = mergeByKey(events, {
    getKey: getEventKey,
  });

  return {
    items: Array.from(unique.values()),
    warnings,
  };
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
  const jsdocEvents = extractEventsFromJSDoc(classDecl);
  const dispatchEvents = extractEventsFromDispatch(classDecl, context.astData);
  return {
    items: [...jsdocEvents, ...dispatchEvents],
    warnings: [],
  };
}

/**
 * extractEventsFromChain TODO: describe.
 * @param classChain TODO: describe parameter
 * @param context TODO: describe parameter
 * @returns TODO: describe return value
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
 * extractEventsFromDispatch TODO: describe.
 * @param classDeclaration TODO: describe parameter
 * @param astData TODO: describe parameter
 * @returns TODO: describe return value
 */
function extractEventsFromDispatch(
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
  astData: Readonly<IASTVisitorResult>,
): IEventDescriptor[] {
  // Use pre-collected dispatchEvent calls
  const events = astData.dispatchEventCalls
    .filter(isDispatchCallForClass.bind(undefined, classDeclaration))
    .map(mapDispatchCallToEvent);

  if (events.length === 0) {
    return [];
  }

  const unique = mergeByKey(events, {
    getKey: getEventKey,
  });

  return Array.from(unique.values());
}

/**
 * extractEventsFromJSDoc TODO: describe.
 * @param classDeclaration TODO: describe parameter
 * @returns TODO: describe return value
 */
function extractEventsFromJSDoc(
  classDeclaration: Readonly<ts.ClassLikeDeclaration>,
): IEventDescriptor[] {
  const tags = ts.getJSDocTags(classDeclaration).filter(isEventTag);
  return tags.flatMap(mapJSDocTagToEvents);
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
}
