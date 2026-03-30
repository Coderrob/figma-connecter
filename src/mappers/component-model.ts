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
 * Component Model Mapper
 *
 * Normalizes parser output into a IComponentModel for downstream emitters.
 *
 * @module mappers/component-model
 */

import type {
  IComponentModel,
  IEventDescriptor,
  IPropertyDescriptor,
} from "@/src/core/types";
import { normalizedBasename, normalizePath } from "@/src/utils/paths";

import { mapPropertiesToAttributes } from "./attribute-mapper";

/**
 * Input payload for normalizing a component model.
 */
export interface IComponentModelInput {
  readonly className?: string;
  readonly tagName: string;
  readonly filePath: string;
  readonly componentDir: string;
  readonly props: readonly IPropertyDescriptor[];
  readonly events: readonly IEventDescriptor[];
}

/**
 * Derives the import path relative to the components source root.
 *
 * @param componentDir - Component directory path.
 * @returns Normalized import path fragment.
 */
export function deriveImportPath(componentDir: string): string {
  const marker = "/packages/components/src/";
  const normalized = normalizePath(componentDir);
  const index = normalized.lastIndexOf(marker);
  if (index >= 0) {
    return normalized.slice(index + marker.length);
  }
  return normalizedBasename(componentDir);
}

/**
 * Normalizes a component model for downstream emitters.
 *
 * @param input - Raw parser output to normalize.
 * @returns Normalized IComponentModel.
 */
export function mapComponentModel(input: Readonly<IComponentModelInput>): IComponentModel {
  const className = input.className?.trim() || "UnknownComponent";
  const props = input.props ?? [];
  const events = input.events ?? [];

  return {
    className,
    tagName: input.tagName,
    filePath: input.filePath,
    componentDir: input.componentDir,
    props,
    attributes: mapPropertiesToAttributes(props),
    events,
    importPath: deriveImportPath(input.componentDir),
  };
}
