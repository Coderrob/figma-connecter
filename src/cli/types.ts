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
 * CLI Types
 *
 * Shared CLI contracts for option handling, staged command execution,
 * and progress reporting.
 *
 * @module cli/types
 */

import type { Logger } from "@/src/core/logger";

export interface IGlobalCliOptions {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
  readonly dryRun?: boolean;
  readonly config?: string;
}

export interface IProgressIndicator {
  start(label: string): void;
  update(label: string): void;
  stop(label?: string, status?: ProgressStatus): void;
}

export enum ProgressStatus {
  Success = "success",
  Error = "error",
}

export interface IProgressIndicatorOptions {
  readonly enabled?: boolean;
  readonly intervalMs?: number;
  readonly stream?: NodeJS.WriteStream;
}

export type CommandContext<Options, Resolved = Record<string, unknown>> = {
  readonly options: Options;
  readonly globalOptions: IGlobalCliOptions;
  readonly logger: Logger;
  readonly progress: IProgressIndicator;
} & Resolved;

export interface ICommandStages<Context, IResult> {
  readonly validate: () => Context;
  readonly execute: (context: Context) => Promise<IResult>;
  readonly report: (context: Context, result: IResult) => void;
  readonly onError?: (context: Context, error: unknown) => void;
}

export type GlobalCliOptions = IGlobalCliOptions;
export type ProgressIndicator = IProgressIndicator;
export type ProgressIndicatorOptions = IProgressIndicatorOptions;
export type CommandStages<Context, IResult> = ICommandStages<Context, IResult>;
