import type ts from "typescript";

import type { Logger } from "../core/logger";
import type { Emitter } from "../emitters/types";
import type { IoAdapter } from "../types/io";
import type { Parser } from "../parsers/types";

/**
 * Shared execution context for the connect pipeline.
 */
export interface PipelineContext {
  // TypeScript program context
  readonly checker: ts.TypeChecker;
  readonly sourceFileMap: ReadonlyMap<string, ts.SourceFile>;

  // Pipeline components
  readonly emitters: readonly Emitter[];
  readonly parser: Parser;

  // Execution options
  readonly dryRun: boolean;
  readonly strict: boolean;
  readonly continueOnError?: boolean;
  readonly force: boolean;

  // Code generation options
  readonly baseImportPath?: string;

  // Runtime services
  readonly logger?: Logger;
  readonly io: IoAdapter;
}

export type PipelineContextSeed = Omit<
  PipelineContext,
  "checker" | "sourceFileMap"
> &
  Partial<Pick<PipelineContext, "checker" | "sourceFileMap">>;
