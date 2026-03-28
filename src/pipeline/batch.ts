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

import { DEFAULT_CONNECT_OPTIONS } from "@/src/core/constants";

import {
  addCreatedFile,
  addUnchangedFile,
  addUpdatedFile,
  createEmptyComponentResult,
} from "@/src/core/report";
import {
  addDiagnostics,
  addError,
  addWarnings,
  type IAggregateResult,
  aggregateResults,
  createResult,
  map as mapResult,
  type IResult,
} from "@/src/core/result";
import type {
  IComponentModel,
  IComponentResult,
  IEmitResult,
  IFileChangeDetail,
  IGeneratedSectionPayload,
} from "@/src/core/types";
import { FileChangeReason, FileChangeStatus } from "@/src/core/types";
import { nodeIoAdapter } from "@/src/io/adapter";
import { writeFile } from "@/src/io/file-writer";
import { applyGeneratedSectionUpdates } from "@/src/io/section-updater";
import type { IParseContext } from "@/src/parsers/types";
import type {
  IIoAdapter,
  IDiscoveredFile,
  IFileWriteResult,
} from "@/src/types/io";
import { WriteStatus } from "@/src/types/io";
import type { IPipelineContext } from "@/src/types/pipeline";

import type ts from "typescript";

type WriteFileResult = IFileWriteResult;
type GeneratedSections = readonly IGeneratedSectionPayload[];

type FileStep = (state: IResult<IFileContext>) => IResult<IFileContext>;
type ComponentUpdater = (
  component: Readonly<IComponentResult>,
) => IComponentResult;

interface IFileContext {
  readonly file: IDiscoveredFile;
  readonly pipeline: IPipelineContext;
  readonly continueOnError: boolean;
  readonly sourceFile?: ts.SourceFile;
  readonly model?: IComponentModel;
  readonly component: IComponentResult;
  readonly shouldContinue: boolean;
}

interface IFileProcessOutcome {
  readonly result: IResult<IComponentResult>;
  readonly shouldContinue: boolean;
}

interface IWriteOutcome {
  readonly result: WriteFileResult;
  readonly warning?: string;
  readonly change?: IFileChangeDetail;
}

interface IWriteContext {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly io: IIoAdapter;
}

interface IWriteRequest {
  readonly filePath: string;
  readonly content: string;
  readonly exists: boolean;
  readonly reason: FileChangeReason;
}

interface IFileExistenceRecord {
  readonly exists: boolean;
}

/**
 * Appends a file-change record to a component result.
 * @param result - Component result to update.
 * @param change - File change metadata to append.
 * @returns Updated component result including the file-change record.
 */
function addFileChange(
  result: Readonly<IComponentResult>,
  change: Readonly<IFileChangeDetail>,
): IComponentResult {
  return {
    ...result,
    fileChanges: [...(result.fileChanges ?? []), change],
  };
}

/**
 * Applies a component updater to the current file-processing state.
 * @param state - Current file-processing state.
 * @param updater - Component updater to apply.
 * @returns Updated file-processing state.
 */
function applyComponentUpdate(
  state: Readonly<IResult<IFileContext>>,
  updater: ComponentUpdater,
): IResult<IFileContext> {
  return setFileValue(state, {
    ...state.value,
    component: updater(state.value.component),
  });
}

/**
 * Applies emitter output, write results, and warnings to file-processing state.
 * @param state - Current file-processing state.
 * @param emission - Emitter output for the current component.
 * @param writeContext - Write-time configuration and IO dependencies.
 * @returns Updated file-processing state after emission handling.
 */
function applyEmissionOutcome(
  state: Readonly<IResult<IFileContext>>,
  emission: Readonly<IEmitResult>,
  writeContext: Readonly<IWriteContext>,
): IResult<IFileContext> {
  const writeOutcome = writeEmission(emission, writeContext);
  const emissionWarnings = emission.warnings ?? [];
  const writeWarnings = writeOutcome.warning ? [writeOutcome.warning] : [];
  let next = addWarnings(state, [...emissionWarnings, ...writeWarnings]);

  const { change } = writeOutcome;
  if (change) {
    const appendChange = applyFileChange.bind(undefined, change);
    next = updateComponent(next, appendChange);
  }

  const applyResult = applyWriteResultToComponent.bind(
    undefined,
    writeOutcome.result,
  );
  return updateComponent(next, applyResult);
}

/**
 * Applies a file change to a component result.
 * @param change - File change metadata to append.
 * @param component - Component result to update.
 * @returns Updated component result.
 */
function applyFileChange(
  change: Readonly<IFileChangeDetail>,
  component: Readonly<IComponentResult>,
): IComponentResult {
  return addFileChange(component, change);
}

/**
 * Applies generated section updates to an existing file and writes it when needed.
 * @param filePath Target file path to update.
 * @param sections Generated sections keyed by marker name.
 * @param writeContext Write-time dependencies and dry-run mode.
 * @returns The write outcome and any warning or file-change metadata.
 */
function applySectionUpdate(
  filePath: string,
  sections: Readonly<GeneratedSections>,
  writeContext: Readonly<IWriteContext>,
): IWriteOutcome {
  const { io } = writeContext;
  const exists = io.exists(filePath);
  const existingContent = io.readFile(filePath);
  const updatedContent = applyGeneratedSectionUpdates(
    existingContent,
    sections,
  );

  if (!updatedContent) {
    return createMissingSectionOutcome(filePath, { exists });
  }

  return writeFileWithChange(
    {
      filePath,
      content: updatedContent,
      exists,
      reason: FileChangeReason.SectionUpdated,
    },
    writeContext,
  );
}

/**
 * Applies a file write result to a component result summary.
 * @param component - Component result to update.
 * @param writeResult - File write result to record.
 * @returns Updated component result with created/updated/unchanged tracking.
 */
function applyWriteResult(
  component: Readonly<IComponentResult>,
  writeResult: Readonly<WriteFileResult>,
): IComponentResult {
  if (writeResult.status === WriteStatus.Created) {
    return addCreatedFile(component, writeResult.filePath);
  }
  if (writeResult.status === WriteStatus.Updated) {
    return addUpdatedFile(component, writeResult.filePath);
  }
  return addUnchangedFile(component, writeResult.filePath);
}

/**
 * Applies a write result summary to a component result.
 * @param writeResult - File write result to record.
 * @param component - Component result to update.
 * @returns Updated component result.
 */
function applyWriteResultToComponent(
  writeResult: Readonly<WriteFileResult>,
  component: Readonly<IComponentResult>,
): IComponentResult {
  return applyWriteResult(component, writeResult);
}

/**
 * Builds normalized file-change metadata from a write status.
 * @param status - Final write status for the file.
 * @param fileRecord - Existing-file metadata used to interpret updates.
 * @param fileRecord.existed - Whether the file existed before writing.
 * @param updateReason - Reason the file was updated.
 * @param filePath - Path to the affected file.
 * @returns File change detail for reporting.
 */
function buildFileChange(
  status: Readonly<WriteStatus>,
  fileRecord: { readonly existed: boolean },
  updateReason: Readonly<FileChangeReason>,
  filePath: string,
): IFileChangeDetail {
  const { existed } = fileRecord;
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

  return createUpdatedFileChange(filePath, { existed }, updateReason);
}

/**
 * Creates the initial processing context for a discovered component file.
 * @param file - Discovered component file metadata.
 * @param pipeline - Shared pipeline context for parsing and emission.
 * @returns Initial file-processing result state.
 */
const createFileContext = (
  file: Readonly<IDiscoveredFile>,
  pipeline: Readonly<IPipelineContext>,
): IResult<IFileContext> => {
  const continueOnError =
    pipeline.continueOnError ?? DEFAULT_CONNECT_OPTIONS.continueOnError;
  return createResult({
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
};

/**
 * Creates the write outcome used when section markers are missing.
 * @param filePath - Target file path for the attempted update.
 * @param fileRecord - Existing-file metadata for the attempted update.
 * @param fileRecord.exists - Whether the file existed before the attempted update.
 * @returns Warning outcome preserving the existing file.
 */
function createMissingSectionOutcome(
  filePath: string,
  fileRecord: Readonly<IFileExistenceRecord>,
): IWriteOutcome {
  const result: WriteFileResult = {
    filePath,
    status: WriteStatus.Unchanged,
  };
  return {
    result,
    warning: `Generated section markers not found in ${filePath}. Skipping update to preserve manual edits.`,
    change: buildFileChange(
      result.status,
      { existed: fileRecord.exists },
      FileChangeReason.SectionUpdated,
      filePath,
    ),
  };
}

/**
 * Builds parse context for a discovered component source file.
 * @param file - Discovered file metadata.
 * @param pipeline - Shared pipeline context.
 * @param sourceFile - Resolved TypeScript source file.
 * @returns Parse context for the parser.
 */
function createParseContext(
  file: Readonly<IDiscoveredFile>,
  pipeline: Readonly<IPipelineContext>,
  sourceFile: Readonly<ts.SourceFile>,
): IParseContext {
  return {
    sourceFile,
    filePath: file.filePath,
    componentDir: file.dirPath,
    checker: pipeline.checker,
    strict: pipeline.strict,
  };
}

/**
 * Creates file-change details for an updated file.
 * @param filePath - Path to the affected file.
 * @param fileRecord - Existing-file metadata for the write operation.
 * @param fileRecord.existed - Whether the file existed before writing.
 * @param updateReason - Reason the file was updated.
 * @returns Updated file-change detail.
 */
function createUpdatedFileChange(
  filePath: string,
  fileRecord: { readonly existed: boolean },
  updateReason: Readonly<FileChangeReason>,
): IFileChangeDetail {
  if (!fileRecord.existed) {
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
 * Emits connect files for a parsed component model.
 * @param state - Current file-processing state.
 * @returns Updated file-processing state after emission and writing.
 */
const emitComponentStep: FileStep = (state) => {
  const { model, pipeline } = state.value;
  if (!model) {
    return state;
  }

  const writeContext: IWriteContext = {
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
 * Maps file-processing state to its component result.
 * @param context - File-processing context.
 * @returns Component result carried by the state.
 */
function extractComponentResult(
  context: Readonly<IFileContext>,
): IComponentResult {
  return context.component;
}

/**
 * Finalizes file-processing state into a batch outcome.
 * @param state - Final file-processing state.
 * @returns Result payload and continuation flag for batch iteration.
 */
const finalizeFileOutcome = (
  state: Readonly<IResult<IFileContext>>,
): IFileProcessOutcome => ({
  result: mapResult(state, extractComponentResult),
  shouldContinue: state.value.shouldContinue,
});

/**
 * Parses a source file into a component model and merges diagnostics.
 * @param state - Current file-processing state.
 * @returns Updated file-processing state after parsing.
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

  const parseResult = pipeline.parser.parse(
    createParseContext(file, pipeline, sourceFile),
  );
  let next = addDiagnostics(state, parseResult);

  if (!parseResult.value) {
    return continueOnError ? setCanContinue(next) : setCannotContinue(next);
  }

  const model = parseResult.value;
  next = setParsedModel(next, model);

  return next;
};

/**
 * Processes a batch of discovered component files through parse and emit steps.
 * @param discovered - Discovered component files to process.
 * @param context - Shared pipeline context for the batch.
 * @returns Aggregate result for all processed component files.
 */
export function processComponentBatch(
  discovered: readonly IDiscoveredFile[],
  context: Readonly<IPipelineContext>,
): IAggregateResult<IComponentResult> {
  const steps: FileStep[] = [
    resolveSourceFileStep,
    parseComponentStep,
    emitComponentStep,
  ];

  let results: IResult<IComponentResult>[] = [];
  let shouldContinue = true;

  for (const file of discovered) {
    if (!shouldContinue) {
      break;
    }

    const initialState = createFileContext(file, context);
    const finalState = runSteps(initialState, steps);
    const outcome = finalizeFileOutcome(finalState);

    results = [...results, outcome.result];
    shouldContinue = outcome.shouldContinue;
  }

  return aggregateResults(results);
}

/**
 * Resolves the current discovered file to a TypeScript source file.
 * @param state - Current file-processing state.
 * @returns Updated file-processing state with the resolved source file.
 */
function resolveSourceFileStep(
  state: Readonly<IResult<IFileContext>>,
): IResult<IFileContext> {
  const { file, pipeline, continueOnError } = state.value;
  const sourceFile = pipeline.sourceFileMap.get(path.resolve(file.filePath));

  if (!sourceFile) {
    const next = addError(
      state,
      `Source file not found in program: ${file.filePath}`,
    );
    return continueOnError ? setCanContinue(next) : setCannotContinue(next);
  }

  return setResolvedSourceFile(state, sourceFile);
}

/**
 * Executes a single file-processing step within `Array.prototype.reduce`.
 * @param state - Accumulated file-processing state.
 * @param step - Step to execute.
 * @returns Updated file-processing state.
 */
function runFileStep(
  state: Readonly<IResult<IFileContext>>,
  step: FileStep,
): IResult<IFileContext> {
  return step(state);
}

/**
 * Runs the configured file-processing steps in sequence.
 * @param state - Initial file-processing state.
 * @param steps - Steps to execute.
 * @returns Final file-processing state after all steps run.
 */
function runSteps(
  state: Readonly<IResult<IFileContext>>,
  steps: readonly FileStep[],
): IResult<IFileContext> {
  return steps.reduce(runFileStep, state);
}

/**
 * Marks the current file-processing state as eligible to continue.
 * @param state - Current file-processing state.
 * @returns Updated state with `shouldContinue` set to true.
 */
function setCanContinue(
  state: Readonly<IResult<IFileContext>>,
): IResult<IFileContext> {
  return setFileValue(state, {
    ...state.value,
    shouldContinue: true,
  });
}

/**
 * Marks the current file-processing state as terminal for the batch.
 * @param state - Current file-processing state.
 * @returns Updated state with `shouldContinue` set to false.
 */
function setCannotContinue(
  state: Readonly<IResult<IFileContext>>,
): IResult<IFileContext> {
  return setFileValue(state, {
    ...state.value,
    shouldContinue: false,
  });
}

/**
 * Replaces the file-processing context value while preserving diagnostics.
 * @param state - Current file-processing state.
 * @param value - Next file-processing context value.
 * @returns Updated file-processing state.
 */
function setFileValue(
  state: Readonly<IResult<IFileContext>>,
  value: Readonly<IFileContext>,
): IResult<IFileContext> {
  return {
    ...state,
    value,
  };
}

/**
 * Stores the parsed component model on file-processing state.
 * @param state - Current file-processing state.
 * @param model - Parsed component model.
 * @returns Updated state with the parsed model attached.
 */
function setParsedModel(
  state: Readonly<IResult<IFileContext>>,
  model: Readonly<IComponentModel>,
): IResult<IFileContext> {
  return setFileValue(state, {
    ...state.value,
    model,
    component: {
      ...state.value.component,
      model,
    },
  });
}

/**
 * Stores a resolved TypeScript source file on file-processing state.
 * @param state - Current file-processing state.
 * @param sourceFile - Source file resolved from the program.
 * @returns Updated state with the source file attached.
 */
function setResolvedSourceFile(
  state: Readonly<IResult<IFileContext>>,
  sourceFile: Readonly<ts.SourceFile>,
): IResult<IFileContext> {
  return setFileValue(state, {
    ...state.value,
    sourceFile,
  });
}

/**
 * Returns true when an emission should overwrite the full file content.
 * @param emission - Emitter output describing target content.
 * @param writeContext - Write-time configuration and IO dependencies.
 * @param fileRecord - Existing-file metadata for the destination path.
 * @param fileRecord.exists - Whether the destination file already exists.
 * @returns True when the emission should bypass section updates.
 */
function shouldWriteFullContent(
  emission: Readonly<IEmitResult>,
  writeContext: Readonly<IWriteContext>,
  fileRecord: Readonly<IFileExistenceRecord>,
): boolean {
  return (writeContext.force && fileRecord.exists) || !emission.sections;
}

/**
 * Updates the component result stored inside file-processing state.
 * @param state - Current file-processing state.
 * @param updater - Function that maps the current component result to a new one.
 * @returns Updated file-processing state with the new component result.
 */
function updateComponent(
  state: Readonly<IResult<IFileContext>>,
  updater: ComponentUpdater,
): IResult<IFileContext> {
  return applyComponentUpdate(state, updater);
}

/**
 * Writes an emitted file directly, choosing the appropriate change reason from file existence.
 * @param emission - Emitter output describing the target file and content.
 * @param writeContext - Write-time configuration and IO dependencies.
 * @param fileRecord - Existing-file metadata for the destination path.
 * @returns Write outcome for the emitted file.
 */
function writeDirectEmission(
  emission: Readonly<IEmitResult>,
  writeContext: Readonly<IWriteContext>,
  fileRecord: Readonly<IFileExistenceRecord>,
): IWriteOutcome {
  const reason = fileRecord.exists
    ? FileChangeReason.ContentUpdated
    : FileChangeReason.NewFile;

  return writeFullEmission(emission, writeContext, fileRecord, reason);
}

/**
 * Chooses the appropriate write strategy for an emitter output.
 * @param emission - Emitter output describing the target file and content.
 * @param writeContext - Write-time configuration and IO dependencies.
 * @returns Normalized write outcome for the emitted file.
 */
function writeEmission(
  emission: Readonly<IEmitResult>,
  writeContext: Readonly<IWriteContext>,
): IWriteOutcome {
  const { io } = writeContext;
  const sections = emission.sections;
  const exists = io.exists(emission.filePath);
  const fileRecord: IFileExistenceRecord = { exists };

  if (shouldWriteFullContent(emission, writeContext, fileRecord)) {
    return writeDirectEmission(emission, writeContext, fileRecord);
  }

  if (!exists) {
    return writeDirectEmission(emission, writeContext, fileRecord);
  }

  if (!sections) {
    return writeDirectEmission(emission, writeContext, fileRecord);
  }

  return applySectionUpdate(emission.filePath, sections, writeContext);
}

/**
 * Writes output content and builds a normalized file-change record.
 * @param request File write payload and change reason metadata.
 * @param writeContext Write-time dependencies and dry-run mode.
 * @returns The write outcome and associated file-change entry.
 */
function writeFileWithChange(
  request: Readonly<IWriteRequest>,
  writeContext: Readonly<IWriteContext>,
): IWriteOutcome {
  const { dryRun, io } = writeContext;
  const { filePath, content, exists, reason } = request;
  const result = writeFile(filePath, content, { dryRun, io });
  return {
    result,
    change: buildFileChange(
      result.status,
      { existed: exists },
      reason,
      filePath,
    ),
  };
}

/**
 * Writes full emitter output directly to the destination path.
 * @param emission - Emitter output describing the target file and content.
 * @param writeContext - Write-time configuration and IO dependencies.
 * @param fileRecord - Existing-file metadata for the destination path.
 * @param fileRecord.exists - Whether the target file already exists.
 * @param reason - File change reason to record.
 * @returns Write outcome for the emitted file.
 */
function writeFullEmission(
  emission: Readonly<IEmitResult>,
  writeContext: Readonly<IWriteContext>,
  fileRecord: Readonly<IFileExistenceRecord>,
  reason: Readonly<FileChangeReason>,
): IWriteOutcome {
  return writeFileWithChange(
    {
      filePath: emission.filePath,
      content: emission.content,
      exists: fileRecord.exists,
      reason,
    },
    writeContext,
  );
}
