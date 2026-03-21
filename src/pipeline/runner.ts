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
 * Pipeline Runner
 *
 * Orchestrates the complete connect pipeline execution.
 *
 * @module pipeline/runner
 */
import type { Logger } from "../core/logger";
import {
  createEmptyComponentResult,
  createEmptyReport,
  createReportTimer,
  reportReducer,
  type ReportTimer,
} from "../core/report";
import {
  applyAggregateDiagnostics,
  applyDiagnostics,
  createResult,
  createResultWithDiagnostics,
  type Diagnostics,
  map as mapResult,
  type Result,
} from "../core/result";
import type {
  ComponentResult,
  ConnectOptions,
  GenerationReport,
} from "../core/types";
import { createEmitters } from "../emitters/factory";
import type { Emitter } from "../emitters/types";
import { nodeIoAdapter } from "../io/adapter";
import { discoverComponentFiles } from "../io/file-discovery";
import { loadSourceProgram } from "../io/source-loader";
import { createDefaultParser } from "../parsers/factory";
import type { Parser } from "../parsers/types";
import type { DiscoveredFile, SourceLoadResult } from "../types/io";

import type { PipelineContextSeed } from "../types/pipeline";
import { processComponentBatch } from "./batch";

interface RunnerContext {
  readonly options: ConnectOptions;
  readonly logger: Logger;
  readonly timer: ReportTimer;
  readonly discovered: readonly DiscoveredFile[];
  readonly emitters: readonly Emitter[];
  readonly parser?: Parser;
  readonly pipelineSeed?: PipelineContextSeed;
  readonly sourceLoad?: SourceLoadResult;
  readonly results: readonly ComponentResult[];
  readonly componentResults: readonly ComponentResult[];
  readonly stopEarly: boolean;
  readonly report?: GenerationReport;
}

type RunnerStep = (state: Result<RunnerContext>) => Result<RunnerContext>;

const buildReport = (
  results: readonly ComponentResult[],
  timer: ReportTimer,
  includeComponents: boolean,
  componentResults: readonly ComponentResult[],
): GenerationReport => {
  const report = {
    ...results.reduce(
      (accumulator, element) => reportReducer(accumulator, element),
      createEmptyReport(),
    ),
    durationMs: timer.stop(),
  };

  return includeComponents ? { ...report, componentResults } : report;
};

/**
 * Appends diagnostics to the runner results collection.
 *
 * @param state - Current runner state.
 * @param diagnostics - Diagnostics to append.
 * @returns Updated runner state.
 */
const appendDiagnosticResult = (
  state: Result<RunnerContext>,
  diagnostics: Diagnostics,
): Result<RunnerContext> => {
  const diagnosticResult = applyDiagnostics(
    createResultWithDiagnostics(createEmptyComponentResult(), diagnostics),
  );
  return mapResult(state, (context) => ({
    ...context,
    results: [...context.results, diagnosticResult],
  }));
};

/**
 * Runs each pipeline step in order.
 *
 * @param state - Current runner state.
 * @param steps - Steps to execute.
 * @returns Updated runner state.
 */
const discoverComponentsStep: RunnerStep = (state) => {
  const { logger, options } = state.value;
  logger.info("Discovering component files...", {
    inputPath: options.inputPath,
    recursive: options.recursive,
  });
  const discovered = discoverComponentFiles(options.inputPath, {
    recursive: options.recursive,
  });

  if (discovered.length === 0) {
    const next = appendDiagnosticResult(state, {
      warnings: [`No component files found at: ${options.inputPath}`],
    });
    return mapResult(next, (context) => ({
      ...context,
      discovered,
      stopEarly: true,
    }));
  }

  logger.info("Component files discovered.", {
    count: discovered.length,
  });

  return mapResult(state, (context) => ({
    ...context,
    discovered,
  }));
};

/**
 * Discovers component files to process.
 *
 * @param state - Current runner state.
 * @param steps
 * @returns Updated runner state.
 */
const finalizeReportStep: RunnerStep = (state) => {
  const { componentResults, discovered, results, timer } = state.value;
  const reportWithComponents = buildReport(
    results,
    timer,
    discovered.length > 0,
    componentResults,
  );

  return mapResult(state, (context) => ({
    ...context,
    report: reportWithComponents,
  }));
};

/**
 * Initializes the pipeline context and defaults.
 *
 * @param state - Current runner state.
 * @param steps
 * @returns Updated runner state.
 */
const initializePipelineStep: RunnerStep = (state) => {
  if (state.value.stopEarly) {
    return state;
  }

  const { options, logger } = state.value;
  const emitters = createEmitters({ targets: options.emitTargets });
  const parser = createDefaultParser();
  const pipelineSeed: PipelineContextSeed = {
    emitters,
    parser,
    dryRun: options.dryRun,
    strict: options.strict,
    logger,
    continueOnError: options.continueOnError,
    baseImportPath: options.baseImportPath,
    force: options.force ?? false,
    io: nodeIoAdapter,
  };

  return mapResult(state, (context) => ({
    ...context,
    emitters,
    parser,
    pipelineSeed,
  }));
};

/**
 * Loads TypeScript sources into the pipeline context.
 *
 * @param state - Current runner state.
 * @param steps
 * @returns Updated runner state.
 */
const loadSourcesStep: RunnerStep = (state) => {
  if (state.value.stopEarly) {
    return state;
  }

  const { discovered, logger, options, pipelineSeed } = state.value;
  if (!pipelineSeed) {
    return state;
  }

  const sourceLoad = loadSourceProgram(
    discovered.map((file) => file.filePath),
    {
      context: pipelineSeed,
      tsconfigPath: options.tsconfigPath,
      searchPath: options.inputPath,
    },
  );

  if (sourceLoad.configPath) {
    logger.debug("Using tsconfig for TypeScript program.", {
      configPath: sourceLoad.configPath,
    });
  }

  let next: Result<RunnerContext> = mapResult(state, (context) => ({
    ...context,
    sourceLoad,
  }));

  if (sourceLoad.errors.length > 0) {
    next = appendDiagnosticResult(next, { errors: sourceLoad.errors });
  }

  return next;
};

/**
 * Warns when no emitters are configured.
 *
 * @param state - Current runner state.
 * @param steps
 * @returns Updated runner state.
 */
const runBatchStep: RunnerStep = (state) => {
  if (state.value.stopEarly) {
    return state;
  }

  const { discovered, sourceLoad } = state.value;
  if (!sourceLoad) {
    return state;
  }

  const aggregate = processComponentBatch(discovered, sourceLoad.context);
  const componentResults: ComponentResult[] =
    applyAggregateDiagnostics(aggregate);
  return mapResult(state, (context) => ({
    ...context,
    componentResults,
    results: [...context.results, ...componentResults],
  }));
};

/**
 * Runs the batch processor over discovered files.
 *
 * @param state - Current runner state.
 * @param steps
 * @param options
 * @param logger
 * @returns Updated runner state.
 */
export function runConnectPipeline(
  options: ConnectOptions,
  logger: Logger,
): Promise<GenerationReport> {
  const initialContext: RunnerContext = {
    options,
    logger,
    timer: createReportTimer(),
    discovered: [],
    emitters: [],
    parser: undefined,
    pipelineSeed: undefined,
    sourceLoad: undefined,
    results: [],
    componentResults: [],
    stopEarly: false,
    report: undefined,
  };

  const finalState = runSteps(createResult(initialContext), [
    discoverComponentsStep,
    initializePipelineStep,
    loadSourcesStep,
    warnOnMissingEmittersStep,
    runBatchStep,
    finalizeReportStep,
  ]);

  if (finalState.value.report) {
    return Promise.resolve(finalState.value.report);
  }

  return Promise.resolve(
    buildReport(
      finalState.value.results,
      finalState.value.timer,
      finalState.value.discovered.length > 0,
      finalState.value.componentResults,
    ),
  );
}

/**
 * Finalizes the generation report.
 *
 * @param state - Current runner state.
 * @param options
 * @param logger
 * @param steps
 * @returns Updated runner state.
 */
const runSteps = (
  state: Result<RunnerContext>,
  steps: readonly RunnerStep[],
): Result<RunnerContext> =>
  steps.reduce((current, step) => step(current), state);

/**
 * Runs the connect pipeline for a set of component files.
 *
 * @param options - Connect pipeline options.
 * @param logger - Logger instance for pipeline output.
 * @param state
 * @returns Generation report for the pipeline run.
 */
const warnOnMissingEmittersStep: RunnerStep = (state) => {
  if (state.value.stopEarly) {
    return state;
  }

  if (state.value.emitters.length === 0) {
    return appendDiagnosticResult(state, {
      warnings: ["No emitters selected. Use --emit to specify targets."],
    });
  }

  return state;
};
