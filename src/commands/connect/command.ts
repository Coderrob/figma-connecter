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

import { Command } from 'commander';

import { DEFAULT_CONNECT_OPTIONS } from '../../core/constants';

import { EMIT_TARGET_OPTIONS } from './constants';
import { runConnectCommand } from './handler';

/**
 * Connect Command
 *
 * Generates or updates Figma Code Connect files for Web Components.
 */
export const connectCommand = new Command('connect')
  .description('Generate Figma Code Connect files for Web Components')
  .requiredOption('-p, --path <path>', 'Path to component file or directory')
  .option('-r, --recursive', 'Recursively scan subdirectories for components', DEFAULT_CONNECT_OPTIONS.recursive)
  .option('-d, --dry-run', 'Preview changes without writing files')
  .option('-e, --emit <targets>', `Emit targets: ${EMIT_TARGET_OPTIONS}`, DEFAULT_CONNECT_OPTIONS.emit)
  .option('--strict', 'Fail on unresolved base classes', DEFAULT_CONNECT_OPTIONS.strict)
  .option('--no-strict', 'Allow unresolved base classes')
  .option(
    '--continue-on-error',
    'Continue processing components when errors occur',
    DEFAULT_CONNECT_OPTIONS.continueOnError,
  )
  .option('--no-continue-on-error', 'Stop processing on first error')
  .option('--base-import-path <path>', 'Override base import path for generated imports')
  .option('--force', 'Force replacement of files instead of updating', DEFAULT_CONNECT_OPTIONS.force)
  .action(runConnectCommand);
