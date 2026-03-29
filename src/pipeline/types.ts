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
 * Pipeline Types
 *
 * Shared execution context contracts for connect pipeline orchestration.
 *
 * @module pipeline/types
 */

import type { Logger } from "@/src/core/logger";
import type { IEmitter } from "@/src/emitters/types";
import type { IIoAdapter } from "@/src/io/types";
import type { IParser } from "@/src/parsers/types";
import type ts from "typescript";

export interface IPipelineContext {
  readonly checker: ts.TypeChecker;
  readonly sourceFileMap: ReadonlyMap<string, ts.SourceFile>;
  readonly emitters: readonly IEmitter[];
  readonly parser: IParser;
  readonly dryRun: boolean;
  readonly strict: boolean;
  readonly continueOnError?: boolean;
  readonly force: boolean;
  readonly baseImportPath?: string;
  readonly logger?: Readonly<Logger>;
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

export type PipelineContext = IPipelineContext;
