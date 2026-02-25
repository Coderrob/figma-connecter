/**
 * CLI-related shared types
 */

import type { Logger } from "../core/logger";

export interface GlobalCliOptions {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
  readonly dryRun?: boolean;
  readonly config?: string;
}

export interface ProgressIndicator {
  start(label: string): void;
  update(label: string): void;
  stop(label?: string, status?: ProgressStatus): void;
}

export enum ProgressStatus {
  Success = "success",
  Error = "error",
}

export interface ProgressIndicatorOptions {
  readonly enabled?: boolean;
  readonly intervalMs?: number;
  readonly stream?: NodeJS.WriteStream;
}

export type CommandContext<Options, Resolved = Record<string, unknown>> = {
  readonly options: Options;
  readonly globalOptions: GlobalCliOptions;
  readonly logger: Logger;
  readonly progress: ProgressIndicator;
} & Resolved;

export interface CommandStages<Context, Result> {
  readonly validate: () => Context;
  readonly execute: (context: Context) => Promise<Result>;
  readonly report: (context: Context, result: Result) => void;
  readonly onError?: (context: Context, error: unknown) => void;
}
