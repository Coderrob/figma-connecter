import type { Logger } from "@/src/core/logger";

import type { IEmitter } from "@/src/emitters/types";
import type { IParser } from "@/src/parsers/types";
import type { IIoAdapter } from "@/src/types/io";
import type ts from "typescript";

/**
 * Shared execution context for the connect pipeline.
 */
export interface IPipelineContext {
  // TypeScript program context
  readonly checker: ts.TypeChecker;
  readonly sourceFileMap: ReadonlyMap<string, ts.SourceFile>;

  // Pipeline components
  readonly emitters: readonly IEmitter[];
  readonly parser: IParser;

  // Execution options
  readonly dryRun: boolean;
  readonly strict: boolean;
  readonly continueOnError?: boolean;
  readonly force: boolean;

  // Code generation options
  readonly baseImportPath?: string;

  // Runtime services
  readonly logger?: Logger;
  readonly io: IIoAdapter;
}

type DerivedPipelineProps = {
  readonly checker: ts.TypeChecker;
  readonly sourceFileMap: ReadonlyMap<string, ts.SourceFile>;
};

export type PipelineContextSeed = Omit<
  IPipelineContext,
  keyof DerivedPipelineProps
> &
  Partial<DerivedPipelineProps>;
