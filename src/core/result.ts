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
 * Result Helper Module
 *
 * Provides immutable Result helpers for value + diagnostics handling.
 *
 * @module core/result
 */

/**
 * A generic result container for warnings and errors.
 */
export interface Result<T> {
  readonly value: T;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Diagnostic payload used for merging warnings and errors.
 */
export interface Diagnostics {
  readonly warnings?: readonly string[];
  readonly errors?: readonly string[];
}

/**
 * Aggregate result composed of multiple Result items.
 */
export interface AggregateResult<T> {
  readonly items: readonly Result<T>[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly ok: boolean;
}

/**
 * Creates a new Result instance with default diagnostics.
 *
 * @param value - Result value to wrap.
 * @param warnings - Initial warnings to include.
 * @param errors - Initial errors to include.
 * @returns New result object.
 */
export function createResult<T>(value: T, warnings: readonly string[] = [], errors: readonly string[] = []): Result<T> {
  return {
    value,
    warnings: [...warnings],
    errors: [...errors],
  };
}

/**
 * Returns a new Result with warnings merged in.
 *
 * @param result - Existing result to merge into.
 * @param warnings - Warnings to append.
 * @returns Result with merged warnings.
 */
export function mergeWarnings<T>(result: Result<T>, warnings: readonly string[]): Result<T> {
  if (warnings.length === 0) {
    return result;
  }
  return {
    ...result,
    warnings: [...result.warnings, ...warnings],
  };
}

/**
 * Returns a new Result with errors merged in.
 *
 * @param result - Existing result to merge into.
 * @param errors - Errors to append.
 * @returns Result with merged errors.
 */
export function mergeErrors<T>(result: Result<T>, errors: readonly string[]): Result<T> {
  if (errors.length === 0) {
    return result;
  }
  return {
    ...result,
    errors: [...result.errors, ...errors],
  };
}

/**
 * Merges warnings and errors from diagnostic payloads into a Result.
 *
 * @param result - Existing result to merge into.
 * @param diagnostics - Diagnostic payloads to append.
 * @returns Result with merged diagnostics.
 */
export function mergeDiagnostics<T>(result: Result<T>, ...diagnostics: readonly Diagnostics[]): Result<T> {
  if (diagnostics.length === 0) {
    return result;
  }

  return diagnostics.reduce<Result<T>>((acc, diagnostic) => {
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
  }, result);
}

/**
 * Adds a single warning to a Result.
 *
 * @param result - Existing result to merge into.
 * @param warning - Warning to append.
 * @returns Result with warning appended.
 */
export function addWarning<T>(result: Result<T>, warning: string): Result<T> {
  return mergeWarnings(result, [warning]);
}

/**
 * Adds multiple warnings to a Result.
 *
 * @param result - Existing result to merge into.
 * @param warnings - Warnings to append.
 * @returns Result with warnings appended.
 */
export function addWarnings<T>(result: Result<T>, warnings: readonly string[]): Result<T> {
  return mergeWarnings(result, warnings);
}

/**
 * Adds a single error to a Result.
 *
 * @param result - Existing result to merge into.
 * @param error - Error to append.
 * @returns Result with error appended.
 */
export function addError<T>(result: Result<T>, error: string): Result<T> {
  return mergeErrors(result, [error]);
}

/**
 * Adds multiple errors to a Result.
 *
 * @param result - Existing result to merge into.
 * @param errors - Errors to append.
 * @returns Result with errors appended.
 */
export function addErrors<T>(result: Result<T>, errors: readonly string[]): Result<T> {
  return mergeErrors(result, errors);
}

/**
 * Adds diagnostics to a Result.
 *
 * @param result - Existing result to merge into.
 * @param diagnostics - Diagnostic payload to append.
 * @returns Result with merged diagnostics.
 */
export function addDiagnostics<T>(result: Result<T>, diagnostics: Diagnostics): Result<T> {
  return mergeDiagnostics(result, diagnostics);
}

/**
 * Creates a Result with diagnostics applied.
 *
 * @param value - Result value to wrap.
 * @param diagnostics - Diagnostic payload to append.
 * @returns Result with merged diagnostics.
 */
export function createResultWithDiagnostics<T>(value: T, diagnostics: Diagnostics): Result<T> {
  return addDiagnostics(createResult(value), diagnostics);
}

/**
 * Checks if a diagnostics payload has warnings.
 *
 * @param diagnostics - Diagnostics to inspect.
 * @returns True when warnings exist.
 */
export function hasWarnings(diagnostics: Diagnostics): boolean {
  return (diagnostics.warnings ?? []).length > 0;
}

/**
 * Checks if a diagnostics payload has errors.
 *
 * @param diagnostics - Diagnostics to inspect.
 * @returns True when errors exist.
 */
export function hasErrors(diagnostics: Diagnostics): boolean {
  return (diagnostics.errors ?? []).length > 0;
}

/**
 * Checks if a diagnostics payload has warnings or errors.
 *
 * @param diagnostics - Diagnostics to inspect.
 * @returns True when warnings or errors exist.
 */
export function hasDiagnostics(diagnostics: Diagnostics): boolean {
  return hasWarnings(diagnostics) || hasErrors(diagnostics);
}

/**
 * Applies a Result's diagnostics onto its value.
 *
 * @param result - Result containing diagnostics to apply.
 * @returns Value with diagnostics merged in.
 */
export function applyDiagnostics<T extends { warnings: readonly string[]; errors: readonly string[] }>(
  result: Result<T>,
): T {
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
 * Maps a Result value while preserving diagnostics.
 *
 * @param result - Result to map.
 * @param mapper - Mapping function for the value.
 * @returns Mapped result with original diagnostics.
 */
export function map<T, U>(result: Result<T>, mapper: (value: T) => U): Result<U> {
  return {
    value: mapper(result.value),
    warnings: result.warnings,
    errors: result.errors,
  };
}

/**
 * Chains a Result through another Result-producing mapper.
 *
 * @param result - Result to chain.
 * @param mapper - Mapper that returns a new result.
 * @returns Chained result with merged diagnostics.
 */
export function chain<T, U>(result: Result<T>, mapper: (value: T) => Result<U>): Result<U> {
  const next = mapper(result.value);
  return {
    value: next.value,
    warnings: [...result.warnings, ...next.warnings],
    errors: [...result.errors, ...next.errors],
  };
}

/**
 * Aggregates a collection of Result items into a single summary.
 *
 * @param items - Result items to aggregate.
 * @returns Aggregate summary with ok status.
 */
export function aggregateResults<T>(items: readonly Result<T>[]): AggregateResult<T> {
  const warnings = items.flatMap((item) => item.warnings);
  const errors = items.flatMap((item) => item.errors);
  return {
    items: [...items],
    warnings,
    errors,
    ok: errors.length === 0,
  };
}

/**
 * Applies diagnostics for each Result in an aggregate.
 *
 * @param aggregate - Aggregate result to apply.
 * @returns Array of values with diagnostics applied.
 */
export function applyAggregateDiagnostics<T extends { warnings: readonly string[]; errors: readonly string[] }>(
  aggregate: AggregateResult<T>,
): T[] {
  return aggregate.items.map((item) => applyDiagnostics(item));
}
