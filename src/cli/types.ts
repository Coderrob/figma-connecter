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
 * CLI Types Module
 *
 * Defines interfaces and types for CLI options and utilities.
 *
 * @module cli/types
 */

/**
 * Global CLI options available across all commands.
 */
export interface GlobalCliOptions {
  /** Enable verbose/debug logging. */
  readonly verbose?: boolean;
  /** Suppress non-error output. */
  readonly quiet?: boolean;
  /** Preview changes without writing files. */
  readonly dryRun?: boolean;
  /** Path to a configuration file. */
  readonly config?: string;
}

/**
 * Interface for terminal progress indicators.
 */
export interface ProgressIndicator {
  /**
   * Starts the progress indicator with a label.
   * @param label - The label to display.
   */
  start(label: string): void;

  /**
   * Updates the progress indicator label.
   * @param label - The new label to display.
   */
  update(label: string): void;

  /**
   * Stops the progress indicator.
   * @param label - Optional final label to display.
   * @param status - The completion status ('success' or 'error').
   */
  stop(label?: string, status?: 'success' | 'error'): void;
}

/**
 * Configuration options for creating a progress indicator.
 */
export interface ProgressIndicatorOptions {
  /** Whether the progress indicator is enabled. Defaults to TTY detection. */
  readonly enabled?: boolean;
  /** Animation frame interval in milliseconds. Defaults to 100. */
  readonly intervalMs?: number;
  /** Output stream for the progress indicator. Defaults to stdout. */
  readonly stream?: NodeJS.WriteStream;
}
