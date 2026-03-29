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
 * IResult Helper Module
 *
 * Provides immutable IResult helpers for value + diagnostics handling.
 *
 * @module core/result
 */

/**
 * A generic result container for warnings and errors.
 */
export interface IResult<T> {
  readonly value: T;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Diagnostic payload used for merging warnings and errors.
 */
export interface IDiagnostics {
  readonly warnings?: readonly string[];
  readonly errors?: readonly string[];
}

/**
 * Aggregate result composed of multiple IResult items.
 */
export interface IAggregateResult<T> {
  readonly items: readonly IResult<T>[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly ok: boolean;
}

/**
 * Merges warning and error diagnostics into an existing result.
 * @param result - Result value to extend with diagnostics.
 * @param diagnostics - Warning and error collections to append.
 * @returns Result containing the original value plus merged diagnostics.
 */
export function addDiagnostics<T>(
  result: Readonly<IResult<T>>,
  diagnostics: Readonly<IDiagnostics>,
): IResult<T> {
  return mergeDiagnostics(result, diagnostics);
}

/**
 * Appends a single error message to a result.
 * @param result - Result value to update.
 * @param error - Error message to append.
 * @returns Result containing the original value plus the appended error.
 */
export function addError<T>(
  result: Readonly<IResult<T>>,
  error: string,
): IResult<T> {
  return mergeErrors(result, [error]);
}

/**
 * Appends multiple error messages to a result.
 * @param result - Result value to update.
 * @param errors - Error messages to append.
 * @returns Result containing the original value plus the appended errors.
 */
export function addErrors<T>(
  result: Readonly<IResult<T>>,
  errors: readonly string[],
): IResult<T> {
  return mergeErrors(result, errors);
}

/**
 * Appends a single warning message to a result.
 * @param result - Result value to update.
 * @param warning - Warning message to append.
 * @returns Result containing the original value plus the appended warning.
 */
export function addWarning<T>(
  result: Readonly<IResult<T>>,
  warning: string,
): IResult<T> {
  return mergeWarnings(result, [warning]);
}

/**
 * Appends multiple warning messages to a result.
 * @param result - Result value to update.
 * @param warnings - Warning messages to append.
 * @returns Result containing the original value plus the appended warnings.
 */
export function addWarnings<T>(
  result: Readonly<IResult<T>>,
  warnings: readonly string[],
): IResult<T> {
  return mergeWarnings(result, warnings);
}

/**
 * Aggregates a collection of results into a single summary object.
 * @param items - Result items to aggregate.
 * @returns Aggregate summary with flattened warnings, errors, and success state.
 */
export function aggregateResults<T>(
  items: readonly IResult<T>[],
): IAggregateResult<T> {
  const warnings = items.flatMap(extractWarnings);
  const errors = items.flatMap(extractErrors);
  return {
    items: [...items],
    warnings,
    errors,
    ok: errors.length === 0,
  };
}

/**
 * Applies aggregate diagnostics back onto each aggregated item value.
 * @param aggregate - Aggregate result containing per-item diagnostics.
 * @returns Item values with their warnings and errors merged into each value.
 */
export function applyAggregateDiagnostics<
  T extends { warnings: readonly string[]; errors: readonly string[] },
>(aggregate: Readonly<IAggregateResult<T>>): T[] {
  return aggregate.items.map(applyDiagnostics);
}

/**
 * Merges a result's diagnostics into its value object.
 * @param result - Result whose value supports `warnings` and `errors` arrays.
 * @returns Value with diagnostics appended to its `warnings` and `errors`.
 */
export function applyDiagnostics<
  T extends { warnings: readonly string[]; errors: readonly string[] },
>(result: Readonly<IResult<T>>): T {
  if (result.warnings.length === 0 && result.errors.length === 0) {
    return result.value;
  }

  return {
    ...result.value,
    warnings: [...result.value.warnings, ...result.warnings],
    errors: [...result.value.errors, ...result.errors],
  };
}

/**
 * Chains two result-producing operations while preserving diagnostics.
 * @param result - Source result to transform.
 * @param mapper - Function that maps the source value to the next result.
 * @returns Result from the mapper with source diagnostics merged in.
 */
export function chain<T, U>(
  result: Readonly<IResult<T>>,
  mapper: (value: T) => IResult<U>,
): IResult<U> {
  const next = mapper(result.value);
  return {
    value: next.value,
    warnings: [...result.warnings, ...next.warnings],
    errors: [...result.errors, ...next.errors],
  };
}

/**
 * Creates a result object from a value and optional diagnostics.
 * @param value - Value carried by the result.
 * @param warnings - Optional warning messages to initialize with.
 * @param errors - Optional error messages to initialize with.
 * @returns New immutable result object.
 */
export function createResult<T>(
  value: Readonly<T>,
  warnings: readonly string[] = [],
  errors: readonly string[] = [],
): IResult<T> {
  return {
    value,
    warnings: [...warnings],
    errors: [...errors],
  };
}

/**
 * Creates a result object and immediately merges diagnostics into it.
 * @param value - Value carried by the result.
 * @param diagnostics - Warning and error collections to attach.
 * @returns Result initialized with the supplied value and diagnostics.
 */
export function createResultWithDiagnostics<T>(
  value: Readonly<T>,
  diagnostics: Readonly<IDiagnostics>,
): IResult<T> {
  return addDiagnostics(createResult(value), diagnostics);
}

/**
 * Extracts errors from a result value.
 *
 * @param item - Result item to inspect.
 * @returns Error list from the result.
 */
function extractErrors<T>(item: Readonly<IResult<T>>): readonly string[] {
  return item.errors;
}

/**
 * Extracts warnings from a result value.
 *
 * @param item - Result item to inspect.
 * @returns Warning list from the result.
 */
function extractWarnings<T>(item: Readonly<IResult<T>>): readonly string[] {
  return item.warnings;
}

/**
 * Returns true when a diagnostics object contains warnings or errors.
 * @param diagnostics - Diagnostics payload to inspect.
 * @returns True when at least one warning or error is present.
 */
export function hasDiagnostics(diagnostics: Readonly<IDiagnostics>): boolean {
  return hasWarnings(diagnostics) || hasErrors(diagnostics);
}

/**
 * Returns true when a diagnostics object contains errors.
 * @param diagnostics - Diagnostics payload to inspect.
 * @returns True when at least one error is present.
 */
export function hasErrors(diagnostics: Readonly<IDiagnostics>): boolean {
  return (diagnostics.errors ?? []).length > 0;
}

/**
 * Returns true when a diagnostics object contains warnings.
 * @param diagnostics - Diagnostics payload to inspect.
 * @returns True when at least one warning is present.
 */
export function hasWarnings(diagnostics: Readonly<IDiagnostics>): boolean {
  return (diagnostics.warnings ?? []).length > 0;
}

/**
 * Maps a result value while preserving its diagnostics.
 * @param result - Source result to transform.
 * @param mapper - Function that maps the source value to a new value.
 * @returns Result containing the mapped value and original diagnostics.
 */
export function map<T, U>(
  result: Readonly<IResult<T>>,
  mapper: (value: T) => U,
): IResult<U> {
  return {
    value: mapper(result.value),
    warnings: result.warnings,
    errors: result.errors,
  };
}

/**
 * Merges a single diagnostics entry into an accumulated result.
 *
 * @param acc - Accumulated result value.
 * @param diagnostic - Diagnostics to merge into the result.
 * @returns Updated result including warnings and errors.
 */
function mergeDiagnosticEntry<T>(
  acc: Readonly<IResult<T>>,
  diagnostic: Readonly<IDiagnostics>,
): IResult<T> {
  const warnings = diagnostic.warnings ?? [];
  const errors = diagnostic.errors ?? [];
  let next = acc;

  if (warnings.length > 0) {
    next = mergeWarnings(next, warnings);
  }

  if (errors.length > 0) {
    next = mergeErrors(next, errors);
  }

  return next;
}

/**
 * Merges one or more diagnostics payloads into a result.
 * @param result - Result to update.
 * @param diagnostics - Diagnostics payloads to merge in order.
 * @returns Result containing the original value plus merged diagnostics.
 */
export function mergeDiagnostics<T>(
  result: Readonly<IResult<T>>,
  ...diagnostics: readonly IDiagnostics[]
): IResult<T> {
  if (diagnostics.length === 0) {
    return result;
  }

  return diagnostics.reduce<IResult<T>>(mergeDiagnosticEntry, result);
}

/**
 * Merges multiple error messages into a result.
 * @param result - Result to update.
 * @param errors - Error messages to append.
 * @returns Result containing the original value plus merged errors.
 */
export function mergeErrors<T>(
  result: Readonly<IResult<T>>,
  errors: readonly string[],
): IResult<T> {
  if (errors.length === 0) {
    return result;
  }
  return {
    ...result,
    errors: [...result.errors, ...errors],
  };
}

/**
 * Merges multiple warning messages into a result.
 * @param result - Result to update.
 * @param warnings - Warning messages to append.
 * @returns Result containing the original value plus merged warnings.
 */
export function mergeWarnings<T>(
  result: Readonly<IResult<T>>,
  warnings: readonly string[],
): IResult<T> {
  if (warnings.length === 0) {
    return result;
  }
  return {
    ...result,
    warnings: [...result.warnings, ...warnings],
  };
}
