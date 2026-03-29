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
 * CLI Progress Module
 *
 * Provides terminal progress indicator functionality for long-running operations.
 *
 * @module cli/progress
 */

import type {
  IProgressIndicator,
  IProgressIndicatorOptions,
} from "@/src/cli/types";
import { ProgressStatus } from "@/src/cli/types";

/** Animation frames for the spinner. */
const SPINNER_FRAMES = ["-", String.raw`\\`, "|", "/"];

/** Default animation interval in milliseconds. */
const DEFAULT_INTERVAL_MS = 100;

/**
 * Creates a no-op progress indicator for non-TTY environments.
 *
 * @returns A progress indicator that does nothing.
 */
function createNoOpIndicator(): IProgressIndicator {
  return {
    /**
     * Starts the no-op indicator.
     *
     * @returns Nothing.
     */
    start: () => undefined,
    /**
     * Updates the no-op indicator label.
     *
     * @returns Nothing.
     */
    update: () => undefined,
    /**
     * Stops the no-op indicator.
     *
     * @returns Nothing.
     */
    stop: () => undefined,
  };
}

/**
 * Creates a simple terminal progress indicator with a spinner animation.
 *
 * The indicator automatically detects TTY and disables animation for non-interactive
 * environments. When enabled, it displays a spinning animation with a label that
 * can be updated during long-running operations.
 *
 * @param options - Configuration options for the progress indicator.
 * @returns A progress indicator instance.
 *
 * @example
 * ```typescript
 * const progress = createProgressIndicator();
 * progress.start('Processing files...');
 * // ... do work ...
 * progress.update('Processing file 5 of 10...');
 * // ... do more work ...
 * progress.stop('Complete!', 'success');
 * ```
 */
export function createProgressIndicator(
  options: Readonly<IProgressIndicatorOptions> = {},
): IProgressIndicator {
  const stream = options.stream ?? process.stdout;
  const enabled = options.enabled ?? stream.isTTY;

  if (!enabled) {
    return createNoOpIndicator();
  }

  return createActiveProgressIndicator(
    stream,
    options.intervalMs ?? DEFAULT_INTERVAL_MS,
  );
}

/**
 * Creates a live terminal progress indicator.
 *
 * @param stream - Output stream receiving spinner updates.
 * @param intervalMs - Spinner animation interval in milliseconds.
 * @returns Progress indicator backed by closure state.
 */
function createActiveProgressIndicator(
  stream: Readonly<NodeJS.WriteStream>,
  intervalMs: number,
): IProgressIndicator {
  let timer: NodeJS.Timeout | number | undefined;
  let frameIndex = 0;
  let label = "";

  /**
   * Renders the next spinner frame.
   *
   * @returns Nothing.
   */
  const render = (): void => {
    frameIndex = renderProgressFrame(stream, label, frameIndex);
  };

  return {
    /**
     * Starts the spinner with a label.
     *
     * @param nextLabel - Label to display while running.
     * @returns Nothing.
     */
    start(nextLabel: string): void {
      label = nextLabel;
      if (timer) {
        return;
      }
      render();
      timer = setInterval(render, intervalMs);
    },
    /**
     * Updates the label for the running indicator.
     *
     * @param nextLabel - Updated label to display.
     * @returns Nothing.
     */
    update(nextLabel: string): void {
      label = nextLabel;
      if (!timer) {
        render();
      }
    },
    /**
     * Stops the spinner with an optional final label and status.
     *
     * @param finalLabel - Final label to display.
     * @param status - Final status label.
     * @returns Nothing.
     */
    stop(finalLabel?: string, status: Readonly<ProgressStatus> = ProgressStatus.Success): void {
      if (timer) {
        clearInterval(timer);
      }
      timer = undefined;
      if (finalLabel) {
        label = finalLabel;
      }
      stream.write(`\r${getStatusPrefix(status)} ${label}\n`);
    },
  };
}

/**
 * Returns the printable prefix for a final progress status.
 *
 * @param status - Final status value.
 * @returns Status prefix.
 */
function getStatusPrefix(status: Readonly<ProgressStatus>): string {
  return status === ProgressStatus.Error ? "x" : "ok";
}

/**
 * Renders the current spinner frame and returns the next frame index.
 *
 * @param stream - Output stream receiving spinner updates.
 * @param label - Current label text.
 * @param frameIndex - Current frame index.
 * @returns Next frame index after rendering.
 */
function renderProgressFrame(
  stream: Readonly<NodeJS.WriteStream>,
  label: string,
  frameIndex: number,
): number {
  const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
  stream.write(`\r${frame} ${label}`);
  stream.write("\x1b[0K");
  return frameIndex + 1;
}
