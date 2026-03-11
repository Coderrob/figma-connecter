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

import path from "node:path";

import type ts from "typescript";

import { DEFAULT_CONNECT_OPTIONS } from "../core/constants";
import {
  addCreatedFile,
  addUnchangedFile,
  addUpdatedFile,
  createEmptyComponentResult,
} from "../core/report";
import {
  addDiagnostics,
  addError,
  addWarnings,
  type AggregateResult,
  aggregateResults,
  createResult,
  map as mapResult,
  type Result,
} from "../core/result";
import type {
  ComponentModel,
  ComponentResult,
  EmitResult,
  FileChangeDetail,
} from "../core/types";
import { FileChangeReason, FileChangeStatus } from "../core/types";
import { nodeIoAdapter } from "../io/adapter";
import { writeFile } from "../io/file-writer";
import { applyGeneratedSectionUpdates } from "../io/section-updater";
import type { ParseContext } from "../parsers/types";
import type { IoAdapter , DiscoveredFile, FileWriteResult } from "../types/io";
import { WriteStatus } from "../types/io";

import type { PipelineContext } from "../types/pipeline";

type WriteFileResult = FileWriteResult;

type FileStep = (state: Result<FileContext>) => Result<FileContext>;

interface FileContext {
  readonly file: DiscoveredFile;
  readonly pipeline: PipelineContext;
  readonly continueOnError: boolean;
  readonly sourceFile?: ts.SourceFile;
  readonly model?: ComponentModel;
  readonly component: ComponentResult;
  readonly shouldContinue: boolean;
}

interface FileProcessOutcome {
  readonly result: Result<ComponentResult>;
  readonly shouldContinue: boolean;
}

interface WriteOutcome {
  readonly result: WriteFileResult;
  readonly warning?: string;
  readonly change?: FileChangeDetail;
}

interface WriteContext {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly io: IoAdapter;
}

/**
 * Runs each file step against the current state.
 *
 * @param state - Current file processing state.
 * @param steps - Steps to execute in order.
 * @param file
 * @param pipeline
 * @param continueOnError
 * @returns Updated file context state.
 */
function applyEmissionOutcome(
  state: Result<FileContext>,
  emission: EmitResult,
  writeContext: WriteContext,
): Result<FileContext> {
  const writeOutcome = writeEmission(emission, writeContext);
  const emissionWarnings = emission.warnings ?? [];
  const writeWarnings = writeOutcome.warning ? [writeOutcome.warning] : [];
  let next = addWarnings(state, [...emissionWarnings, ...writeWarnings]);

  const { change } = writeOutcome;
  if (change) {
    next = updateComponent(next, (component) =>
      addFileChange(component, change),
    );
  }

  return updateComponent(next, (component) =>
    applyWriteResult(component, writeOutcome.result),
  );
}

/**
 * Updates the component result inside the file context.
 *
 * @param state - Current file processing state.
 * @param updater - Component updater function.
 * @param shouldContinue
 * @param steps
 * @returns Updated file context state.
 */
const createFileContext = (
  file: DiscoveredFile,
  pipeline: PipelineContext,
  continueOnError: boolean,
): Result<FileContext> =>
  createResult({
    file,
    pipeline,
    continueOnError,
    sourceFile: undefined,
    model: undefined,
    component: {
      ...createEmptyComponentResult(),
      componentName: file.componentName,
    },
    shouldContinue: true,
  });

/**
 * Updates the shouldContinue flag for processing.
 *
 * @param state - Current file processing state.
 * @param shouldContinue - Whether processing should continue.
 * @param updater
 * @param steps
 * @returns Updated file context state.
 */
function applyWriteResult(
  component: ComponentResult,
  writeResult: WriteFileResult,
): ComponentResult {
  if (writeResult.status === WriteStatus.Created) {
    return addCreatedFile(component, writeResult.filePath);
  }
  if (writeResult.status === WriteStatus.Updated) {
    return addUpdatedFile(component, writeResult.filePath);
  }
  return addUnchangedFile(component, writeResult.filePath);
}

/**
 * Resolves the source file for a discovered component.
 *
 * @param state - Current file processing state.
 * @param updater
 * @param shouldContinue
 * @param steps
 * @returns Updated file context state.
 */
const emitComponentStep: FileStep = (state) => {
  const { model, pipeline } = state.value;
  if (!model) {
    return state;
  }

  const writeContext: WriteContext = {
    dryRun: pipeline.dryRun,
    force: pipeline.force,
    io: pipeline.io ?? nodeIoAdapter,
  };
  const emitterOptions = {
    dryRun: pipeline.dryRun,
    baseImportPath: pipeline.baseImportPath,
  };

  let next = state;
  for (const emitter of pipeline.emitters) {
    const emission = emitter.emit({ model, options: emitterOptions });
    next = applyEmissionOutcome(next, emission, writeContext);
  }

  return next;
};

/**
 * Parses a component source file into a component model.
 *
 * @param state - Current file processing state.
 * @param updater
 * @param shouldContinue
 * @param steps
 * @returns Updated file context state.
 */
function applySectionUpdate(
  filePath: string,
  sections: NonNullable<EmitResult["sections"]>,
  dryRun: boolean,
  io: IoAdapter,
  exists: boolean,
): WriteOutcome {
  const existingContent = io.readFile(filePath);
  const updatedContent = applyGeneratedSectionUpdates(
    existingContent,
    sections,
  );

  if (!updatedContent) {
    const result = { filePath, status: WriteStatus.Unchanged } as const;
    return {
      result,
      warning: `Generated section markers not found in ${filePath}. Skipping update to preserve manual edits.`,
      change: buildFileChange(
        result.status,
        exists,
        FileChangeReason.SectionUpdated,
        filePath,
      ),
    };
  }

  return writeFileWithChange(
    filePath,
    updatedContent,
    dryRun,
    io,
    exists,
    FileChangeReason.SectionUpdated,
  );
}

/**
 * Runs configured emitters for a parsed component model.
 *
 * @param state - Current file processing state.
 * @param updater
 * @param shouldContinue
 * @param steps
 * @returns Updated file context state.
 */
const parseComponentStep: FileStep = (state) => {
  const { continueOnError, file, pipeline, sourceFile } = state.value;
  if (!sourceFile) {
    return state;
  }

  pipeline.logger?.debug("Parsing component source.", {
    component: file.componentName,
    filePath: file.filePath,
  });

  const parseContext: ParseContext = {
    sourceFile,
    filePath: file.filePath,
    componentDir: file.dirPath,
    checker: pipeline.checker,
    strict: pipeline.strict,
  };

  const parseResult = pipeline.parser.parse(parseContext);
  let next = addDiagnostics(state, parseResult);

  if (!parseResult.value) {
    return setShouldContinue(next, continueOnError);
  }

  const model = parseResult.value;
  next = mapResult(next, (context) => ({
    ...context,
    model,
    component: {
      ...context.component,
      model,
    },
  }));

  return next;
};

/**
 * Creates the final processing outcome for a file.
 *
 * @param state - Final file processing state.
 * @param file
 * @param pipeline
 * @param continueOnError
 * @param updater
 * @param shouldContinue
 * @param steps
 * @returns File processing outcome.
 */
function addFileChange(
  result: ComponentResult,
  change: FileChangeDetail,
): ComponentResult {
  return {
    ...result,
    fileChanges: [...(result.fileChanges ?? []), change],
  };
}

/**
 * Creates the initial file context for processing.
 *
 * @param file - Discovered file metadata.
 * @param pipeline - Pipeline context.
 * @param continueOnError - Whether processing should continue on errors.
 * @param state
 * @param emission
 * @param writeContext
 * @param updater
 * @param shouldContinue
 * @returns Initial file processing state.
 */
const runSteps = (
  state: Result<FileContext>,
  steps: readonly FileStep[],
): Result<FileContext> => steps.reduce((current, step) => step(current), state);

/**
 * Processes a batch of discovered component files.
 *
 * @param discovered - Discovered component files to process.
 * @param context - Pipeline context for parsing and emitting.
 * @param state
 * @param component
 * @param writeResult
 * @param updater
 * @param shouldContinue
 * @returns Component results for each processed file.
 */
function buildFileChange(
  status: WriteStatus,
  existed: boolean,
  updateReason: FileChangeReason,
  filePath: string,
): FileChangeDetail {
  if (status === WriteStatus.Created) {
    return {
      filePath,
      status: FileChangeStatus.Created,
      reason: FileChangeReason.NewFile,
    };
  }

  if (status === WriteStatus.Unchanged) {
    return {
      filePath,
      status: FileChangeStatus.Unchanged,
      reason: FileChangeReason.Unchanged,
    };
  }

  if (!existed) {
    return {
      filePath,
      status: FileChangeStatus.Updated,
      reason: FileChangeReason.NewFile,
    };
  }

  return {
    filePath,
    status: FileChangeStatus.Updated,
    reason: updateReason,
  };
}

/**
 * Applies emission output, warnings, and file changes to the component result.
 *
 * @param state - Result wrapper for the component context.
 * @param emission - Emitter output to write.
 * @param writeContext - Write configuration values.
 * @param discovered
 * @param context
 * @param filePath
 * @param sections
 * @param dryRun
 * @param io
 * @param exists
 * @param updater
 * @returns Updated result with merged diagnostics and file changes.
 */
const setShouldContinue = (
  state: Result<FileContext>,
  shouldContinue: boolean,
): Result<FileContext> =>
  mapResult(state, (context) => ({
    ...context,
    shouldContinue,
  }));

/**
 * Applies write status updates to a component result.
 *
 * @param component - Component result to update.
 * @param writeResult - Write result payload.
 * @param discovered
 * @param context
 * @param state
 * @param result
 * @param change
 * @param updater
 * @returns Updated component result.
 */
const finalizeFileOutcome = (
  state: Result<FileContext>,
): FileProcessOutcome => ({
  result: mapResult(state, (context) => context.component),
  shouldContinue: state.value.shouldContinue,
});

/**
 * Writes content to a file and builds the corresponding file change detail.
 *
 * @param status
 * @param existed
 * @param updateReason
 * @param filePath - Destination file path.
 * @param content - Content to write.
 * @param sections
 * @param dryRun - Whether to skip the actual write.
 * @param io - IO adapter to use.
 * @param exists - Whether the file already exists.
 * @param reason - Reason for the file change.
 * @param discovered
 * @param context
 * @param state
 * @returns Write outcome with result and change detail.
 */
const updateComponent = (
  state: Result<FileContext>,
  updater: (component: ComponentResult) => ComponentResult,
): Result<FileContext> =>
  mapResult(state, (context) => ({
    ...context,
    component: updater(context.component),
  }));

/**
 * Applies generated section updates to an existing file.
 *
 * @param filePath - Destination file path.
 * @param sections - Generated section payloads.
 * @param content
 * @param dryRun - Whether to skip the actual write.
 * @param io - IO adapter to use.
 * @param exists - Whether the file already exists.
 * @param reason
 * @param result
 * @param change
 * @param discovered
 * @param context
 * @param state
 * @returns Write outcome with result, optional warning, and change detail.
 */
export function processComponentBatch(
  discovered: readonly DiscoveredFile[],
  context: PipelineContext,
): AggregateResult<ComponentResult> {
  const continueOnError =
    context.continueOnError ?? DEFAULT_CONNECT_OPTIONS.continueOnError;
  const steps: FileStep[] = [
    resolveSourceFileStep,
    parseComponentStep,
    emitComponentStep,
  ];

  const batchState = discovered.reduce(
    /**
     * <anonymous> TODO: describe
     * @param acc TODO: describe parameter
     * @param file TODO: describe parameter
     * @returns TODO: describe return value
     */
    (acc, file) => {
      if (!acc.shouldContinue) {
        return acc;
      }

      const initialState = createFileContext(file, context, continueOnError);
      const finalState = runSteps(initialState, steps);
      const outcome = finalizeFileOutcome(finalState);

      return {
        results: [...acc.results, outcome.result],
        shouldContinue: outcome.shouldContinue,
      };
    },
    { results: [] as Result<ComponentResult>[], shouldContinue: true },
  );

  return aggregateResults(batchState.results);
}

/**
 * Writes an emission to disk, respecting generated section markers.
 *
 * @param emission - Emitter result to write.
 * @param writeContext - Write configuration values.
 * @param status
 * @param existed
 * @param updateReason
 * @param filePath
 * @param content
 * @param dryRun
 * @param io
 * @param exists
 * @param reason
 * @param discovered
 * @param context
 * @returns Write outcome including warnings and change details.
 */
const resolveSourceFileStep: FileStep = (state) => {
  const { file, pipeline, continueOnError } = state.value;
  const sourceFile = pipeline.sourceFileMap.get(path.resolve(file.filePath));

  if (!sourceFile) {
    const next = addError(
      state,
      `Source file not found in program: ${file.filePath}`,
    );
    return setShouldContinue(next, continueOnError);
  }

  return mapResult(state, (context) => ({
    ...context,
    sourceFile,
  }));
};

/**
 * Adds a file change detail to a component result.
 *
 * @param result - Component result to update.
 * @param change - File change detail to append.
 * @param emission
 * @param writeContext
 * @param filePath
 * @param content
 * @param dryRun
 * @param io
 * @param exists
 * @param reason
 * @returns Updated component result.
 */
function writeEmission(
  emission: EmitResult,
  writeContext: WriteContext,
): WriteOutcome {
  const { dryRun, force, io } = writeContext;
  const sections = emission.sections ?? null;
  const exists = io.exists(emission.filePath);

  if ((force && exists) || !sections) {
    return writeFileWithChange(
      emission.filePath,
      emission.content,
      dryRun,
      io,
      exists,
      FileChangeReason.ContentUpdated,
    );
  }

  if (!exists) {
    return writeFileWithChange(
      emission.filePath,
      emission.content,
      dryRun,
      io,
      exists,
      FileChangeReason.NewFile,
    );
  }

  return applySectionUpdate(emission.filePath, sections, dryRun, io, exists);
}

/**
 * Builds a file change detail for a write outcome.
 *
 * @param status - Write status returned by the file writer.
 * @param existed - Whether the file existed before the write.
 * @param updateReason - Reason string for the change.
 * @param filePath - File path being written.
 * @param emission
 * @param writeContext
 * @param content
 * @param dryRun
 * @param io
 * @param exists
 * @param reason
 * @returns File change detail entry.
 */
function writeFileWithChange(
  filePath: string,
  content: string,
  dryRun: boolean,
  io: IoAdapter,
  exists: boolean,
  reason: FileChangeReason,
): WriteOutcome {
  const result = writeFile(filePath, content, { dryRun, io });
  return {
    result,
    change: buildFileChange(result.status, exists, reason, filePath),
  };
}
