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

import type { ComponentResult, GenerationReport } from './types';
import { GenerationStatus } from './types';

/**
 * Timer helper for duration tracking.
 */
export interface ReportTimer {
  /** Time when the timer started. */
  readonly startTime: number;
  /** Stops the timer and returns elapsed milliseconds. */
  stop: () => number;
}

/**
 * Creates an empty generation report.
 *
 * @param result
 * @param warning
 * @param filePath
 * @returns Empty report with success status.
 */
export function addCreatedFile(result: ComponentResult, filePath: string): ComponentResult {
  return {
    ...result,
    created: [...result.created, filePath],
  };
}

/**
 * Creates a timer for measuring report duration.
 *
 * @param result
 * @param warning
 * @returns Report timer with a stop function.
 */
export function addError(result: ComponentResult, error: string): ComponentResult {
  return {
    ...result,
    errors: [...result.errors, error],
  };
}

/**
 * Creates an empty component result.
 *
 * @returns Empty component result object.
 */
export function addWarning(result: ComponentResult, warning: string): ComponentResult {
  return {
    ...result,
    warnings: [...result.warnings, warning],
  };
}

/**
 * Formats a human-readable summary string for a report.
 *
 * @param report - Report to summarize.
 * @returns Summary string for display.
 */
export function addUnchangedFile(result: ComponentResult, filePath: string): ComponentResult {
  return {
    ...result,
    unchanged: [...result.unchanged, filePath],
  };
}

/**
 * Reducer that aggregates a component result into the report.
 *
 * @param report - Current report accumulator.
 * @param result - Component result to merge.
 * @param results
 * @param durationMs
 * @returns Updated report accumulator.
 */
export function createEmptyComponentResult(): ComponentResult {
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
 * Merges multiple component results into a single generation report.
 *
 * @param results - Array of component processing results.
 * @param durationMs - Total duration of the generation process.
 * @param report
 * @param result
 * @returns A merged generation report.
 */
export function addUpdatedFile(result: ComponentResult, filePath: string): ComponentResult {
  return {
    ...result,
    updated: [...result.updated, filePath],
  };
}

/**
 * Determines the overall status based on error and warning counts.
 *
 * @param errorCount - Number of errors in the report.
 * @param warningCount - Number of warnings in the report.
 * @param report
 * @param result
 * @param results
 * @param durationMs
 * @returns Computed report status.
 */
export function createEmptyReport(): GenerationReport {
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
 * Adds a warning to a component result.
 *
 * @param report
 * @param result - Component result to update.
 * @param warning - Warning message to append.
 * @param errorCount
 * @param warningCount
 * @param results
 * @param durationMs
 * @returns Updated component result.
 */
export function createReportTimer(): ReportTimer {
  const startTime = Date.now();
  return {
    startTime,
    /**
     * Stops the timer and returns elapsed time.
     *
     * @returns Elapsed time in milliseconds.
     */
    stop: () => Date.now() - startTime,
  };
}

/**
 * Adds an error to a component result.
 *
 * @param report
 * @param result - Component result to update.
 * @param error - Error message to append.
 * @param errorCount
 * @param warningCount
 * @param results
 * @param durationMs
 * @returns Updated component result.
 */
function determineStatus(errorCount: number, warningCount: number): GenerationStatus {
  if (errorCount > 0) {
    return GenerationStatus.Error;
  }
  if (warningCount > 0) {
    return GenerationStatus.Warning;
  }
  return GenerationStatus.Success;
}

/**
 * Adds a created file to a component result.
 *
 * @param report
 * @param result - Component result to update.
 * @param filePath - Created file path.
 * @param error
 * @param errorCount
 * @param warningCount
 * @param results
 * @param durationMs
 * @returns Updated component result.
 */
export function formatReportSummary(report: GenerationReport): string {
  const lines = [
    `Status: ${report.status}`,
    `Duration: ${report.durationMs}ms`,
    `Created: ${report.created.length}`,
    `Updated: ${report.updated.length}`,
    `Unchanged: ${report.unchanged.length}`,
  ];

  if (report.warnings.length > 0) {
    lines.push(`Warnings: ${report.warnings.length}`);
  }

  if (report.errors.length > 0) {
    lines.push(`Errors: ${report.errors.length}`);
  }

  return lines.join('\n');
}

/**
 * Adds an updated file to a component result.
 *
 * @param report
 * @param result - Component result to update.
 * @param filePath - Updated file path.
 * @param errorCount
 * @param warningCount
 * @param results
 * @param durationMs
 * @returns Updated component result.
 */
export function mergeResults(results: readonly ComponentResult[], durationMs: number): GenerationReport {
  const report = results.reduce(reportReducer, createEmptyReport());
  return {
    ...report,
    durationMs,
  };
}

/**
 * Adds an unchanged file to a component result.
 *
 * @param report
 * @param result - Component result to update.
 * @param filePath - Unchanged file path.
 * @param errorCount
 * @param warningCount
 * @returns Updated component result.
 */
export function reportReducer(report: GenerationReport, result: ComponentResult): GenerationReport {
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
