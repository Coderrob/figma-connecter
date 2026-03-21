/**
 * CLI-related shared types
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

export interface ICommandStages<Context, Result> {
  readonly validate: () => Context;
  readonly execute: (context: Context) => Promise<Result>;
  readonly report: (context: Context, result: Result) => void;
  readonly onError?: (context: Context, error: unknown) => void;
}

export type GlobalCliOptions = IGlobalCliOptions;
export type ProgressIndicator = IProgressIndicator;
export type ProgressIndicatorOptions = IProgressIndicatorOptions;
export type CommandStages<Context, Result> = ICommandStages<Context, Result>;
