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
 * Figma WebComponent Emitter - Helper Functions
 *
 * @module emitters/figma-webcomponent/helpers
 */
import { DEFAULT_IMPORT_BASE } from '../../core/constants';
import type { ComponentModel, EmitterOptions } from '../../core/types';

/**
 * Builds the imports line for the figma.connect call.
 *
 * @param model - The component model.
 * @param options - The emitter options.
 * @returns The imports line.
 */
export const buildImportsLine = (model: ComponentModel, options: EmitterOptions): string => {
  const baseImportPath = options.baseImportPath ?? DEFAULT_IMPORT_BASE;
  const importPath = `${baseImportPath}/${model.importPath}`;
  return `imports: ["import '${importPath}';"],`;
};
