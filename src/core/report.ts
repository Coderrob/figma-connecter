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
 * Report Builder Module
 *
 * Provides immutable builders for constructing generation reports.
 * Follows functional patterns with no mutation of input data.
 *
 * @module core/report
 */

import type { IComponentResult, IGenerationReport } from "./types";
import { GenerationStatus } from "./types";

/**
 * Timer helper for duration tracking.
 */
export interface IReportTimer {
  /** Time when the timer started. */
  readonly startTime: number;
  /** Stops the timer and returns elapsed milliseconds. */
  stop: () => number;
}

/**
 * Appends a created file path to a component result.
 * @param result - Component result to update.
 * @param filePath - File path recorded as created.
 * @returns Updated component result including the created file path.
 */
export function addCreatedFile(
  result: Readonly<IComponentResult>,
  filePath: string,
): IComponentResult {
  return {
    ...result,
    created: [...result.created, filePath],
  };
}

/**
 * Appends an error message to a component result.
 * @param result - Component result to update.
 * @param error - Error message to append.
 * @returns Updated component result including the error.
 */
export function addError(
  result: Readonly<IComponentResult>,
  error: string,
): IComponentResult {
  return {
    ...result,
    errors: [...result.errors, error],
  };
}

/**
 * Appends an unchanged file path to a component result.
 * @param result - Component result to update.
 * @param filePath - File path recorded as unchanged.
 * @returns Updated component result including the unchanged file path.
 */
export function addUnchangedFile(
  result: Readonly<IComponentResult>,
  filePath: string,
): IComponentResult {
  return {
    ...result,
    unchanged: [...result.unchanged, filePath],
  };
}

/**
 * Appends an updated file path to a component result.
 * @param result - Component result to update.
 * @param filePath - File path recorded as updated.
 * @returns Updated component result including the updated file path.
 */
export function addUpdatedFile(
  result: Readonly<IComponentResult>,
  filePath: string,
): IComponentResult {
  return {
    ...result,
    updated: [...result.updated, filePath],
  };
}

/**
 * Appends a warning message to a component result.
 * @param result - Component result to update.
 * @param warning - Warning message to append.
 * @returns Updated component result including the warning.
 */
export function addWarning(
  result: Readonly<IComponentResult>,
  warning: string,
): IComponentResult {
  return {
    ...result,
    warnings: [...result.warnings, warning],
  };
}

/**
 * Creates an empty component result shell for parsing and emission.
 * @returns New component result with empty file and diagnostic collections.
 */
export function createEmptyComponentResult(): IComponentResult {
  return {
    model: undefined,
    componentName: undefined,
    created: [],
    updated: [],
    unchanged: [],
    fileChanges: [],
    warnings: [],
    errors: [],
  };
}

/**
 * Creates an empty generation report with success status.
 * @returns New report initialized with empty counters and diagnostics.
 */
export function createEmptyReport(): IGenerationReport {
  return {
    status: GenerationStatus.Success,
    created: [],
    updated: [],
    unchanged: [],
    warnings: [],
    errors: [],
    durationMs: 0,
  };
}

/**
 * Creates a timer used to measure report duration.
 * @param clockNow - Clock function used to read the current timestamp.
 * @returns Timer containing the start time and a stop function.
 */
export function createReportTimer(
  clockNow: () => number = Date.now,
): IReportTimer {
  const startTime = clockNow();
  /**
   * Returns elapsed time in milliseconds since timer creation.
   * @returns Elapsed duration in milliseconds.
   */
  const stop = (): number => clockNow() - startTime;
  return {
    startTime,
    stop,
  };
}

/**
 * Derives the overall generation status from warning and error counts.
 * @param errorCount - Number of errors accumulated in the report.
 * @param warningCount - Number of warnings accumulated in the report.
 * @returns Status enum representing success, warning, or error.
 */
function determineStatus(
  errorCount: number,
  warningCount: number,
): GenerationStatus {
  if (errorCount > 0) {
    return GenerationStatus.Error;
  }
  if (warningCount > 0) {
    return GenerationStatus.Warning;
  }
  return GenerationStatus.Success;
}

/**
 * Formats a generation report as a human-readable summary block.
 * @param report - Generation report to summarize.
 * @returns Multiline summary string for CLI output.
 */
export function formatReportSummary(
  report: Readonly<IGenerationReport>,
): string {
  const lines = [
    `Status: ${report.status}`,
    `Duration: ${report.durationMs}ms`,
    `Created: ${report.created.length}`,
    `Updated: ${report.updated.length}`,
    `Unchanged: ${report.unchanged.length}`,
    ...(report.warnings.length > 0
      ? [`Warnings: ${report.warnings.length}`]
      : []),
    ...(report.errors.length > 0 ? [`Errors: ${report.errors.length}`] : []),
  ];

  return lines.join("\n");
}

/**
 * Merges component results into a single generation report.
 * @param results - Component results to aggregate.
 * @param durationMs - Total generation duration in milliseconds.
 * @returns Aggregated generation report.
 */
export function mergeResults(
  results: readonly IComponentResult[],
  durationMs: number,
): IGenerationReport {
  const report = results.reduce(reportReducer, createEmptyReport());
  return {
    ...report,
    durationMs,
  };
}

/**
 * Reduces a component result into an accumulated generation report.
 * @param report - Current accumulated generation report.
 * @param result - Component result to merge into the report.
 * @returns Updated generation report including the component result.
 */
export function reportReducer(
  report: Readonly<IGenerationReport>,
  result: Readonly<IComponentResult>,
): IGenerationReport {
  const warnings = [...report.warnings, ...result.warnings];
  const errors = [...report.errors, ...result.errors];
  const created = [...report.created, ...result.created];
  const updated = [...report.updated, ...result.updated];
  const unchanged = [...report.unchanged, ...result.unchanged];
  const status = determineStatus(errors.length, warnings.length);

  return {
    ...report,
    status,
    created,
    updated,
    unchanged,
    warnings,
    errors,
  };
}
