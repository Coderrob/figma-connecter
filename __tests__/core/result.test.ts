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
 * @fileoverview Tests for Result helpers.
 */

import {
  aggregateResults,
  applyAggregateDiagnostics,
  applyDiagnostics,
  chain,
  createResult,
  mapResult,
  mergeDiagnostics,
  mergeErrors,
  mergeWarnings,
} from '../../src/core';

describe('Result helpers', () => {
  it('should create a result with default diagnostics', () => {
    const result = createResult('value');
    expect(result.value).toBe('value');
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should merge warnings immutably', () => {
    const base = createResult('value', ['warn-1']);
    const merged = mergeWarnings(base, ['warn-2']);

    expect(base.warnings).toEqual(['warn-1']);
    expect(merged.warnings).toEqual(['warn-1', 'warn-2']);
  });

  it('should merge errors immutably', () => {
    const base = createResult('value', [], ['error-1']);
    const merged = mergeErrors(base, ['error-2']);

    expect(base.errors).toEqual(['error-1']);
    expect(merged.errors).toEqual(['error-1', 'error-2']);
  });

  it('should merge diagnostics payloads', () => {
    const base = createResult('value');
    const merged = mergeDiagnostics(base, { warnings: ['warn-1'] }, { errors: ['error-1'], warnings: ['warn-2'] });

    expect(merged.warnings).toEqual(['warn-1', 'warn-2']);
    expect(merged.errors).toEqual(['error-1']);
  });

  it('should return the original result when no diagnostics are provided', () => {
    const base = createResult('value');
    const merged = mergeDiagnostics(base);

    expect(merged).toBe(base);
  });

  it('should apply diagnostics onto result values', () => {
    const base = createResult({ warnings: [], errors: [], value: 1 }, ['warn'], ['err']);
    const applied = applyDiagnostics(base);

    expect(applied.warnings).toEqual(['warn']);
    expect(applied.errors).toEqual(['err']);
  });

  it('should map values while preserving diagnostics', () => {
    const base = createResult(2, ['warn'], ['err']);
    const mapped = mapResult(base, (value) => value * 2);

    expect(mapped.value).toBe(4);
    expect(mapped.warnings).toEqual(['warn']);
    expect(mapped.errors).toEqual(['err']);
  });

  it('should chains results and aggregates diagnostics', () => {
    const base = createResult(1, ['warn-1'], ['err-1']);
    const chained = chain(base, (value) => createResult(value + 1, ['warn-2'], ['err-2']));

    expect(chained.value).toBe(2);
    expect(chained.warnings).toEqual(['warn-1', 'warn-2']);
    expect(chained.errors).toEqual(['err-1', 'err-2']);
  });

  it('should aggregate results into a single summary', () => {
    const first = createResult('a', ['warn-1']);
    const second = createResult('b', [], ['err-1']);
    const aggregate = aggregateResults([first, second]);

    expect(aggregate.items).toHaveLength(2);
    expect(aggregate.warnings).toEqual(['warn-1']);
    expect(aggregate.errors).toEqual(['err-1']);
    expect(aggregate.ok).toBe(false);
  });

  it('should apply diagnostics across an aggregate', () => {
    const first = createResult({ warnings: [], errors: [], value: 1 }, ['warn-1']);
    const second = createResult({ warnings: [], errors: [], value: 2 }, [], ['err-1']);
    const aggregate = aggregateResults([first, second]);
    const applied = applyAggregateDiagnostics(aggregate);

    expect(applied[0].warnings).toEqual(['warn-1']);
    expect(applied[1].errors).toEqual(['err-1']);
  });
});
