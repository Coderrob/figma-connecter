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
 * Core Constants Module
 *
 * Shared constants used across the CLI tool.
 *
 * @module core/constants
 */

import type { GeneratedSectionMarkers, GeneratedSectionName } from './types';

/**
 * Canonical marker pair for generated sections.
 */
export const GENERATED_SECTION_MARKERS: GeneratedSectionMarkers = {
  start: '// BEGIN GENERATED',
  end: '// END GENERATED',
};

/**
 * Default configuration values for the connect command.
 */
export const DEFAULT_CONNECT_OPTIONS = {
  recursive: false,
  dryRun: false,
  emit: 'all',
  strict: true,
  continueOnError: true,
  force: false,
} as const;

/**
 * Default base import path for generated component imports.
 */
export const DEFAULT_IMPORT_BASE = '@momentum-design/components';

/**
 * Builds named markers for a specific generated section.
 *
 * @param name - The generated section name to embed in markers.
 * @returns The named start/end marker pair.
 */
export const buildGeneratedSectionMarkers = (name: GeneratedSectionName): GeneratedSectionMarkers => ({
  start: `${GENERATED_SECTION_MARKERS.start}: ${name}`,
  end: `${GENERATED_SECTION_MARKERS.end}: ${name}`,
});
