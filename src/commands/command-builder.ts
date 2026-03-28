/**
 * Command Builder Module
 *
 * Provides a fluent builder for constructing {@link CommandStages} objects
 * that define the lifecycle of a CLI command.
 *
 * @module commands/command-builder
 */
import assert from "node:assert/strict";
import type { ICommandStages } from "@/src/types/cli";

interface ICommandBuilderConfig<Context, IResult> {
  readonly validate?: () => Context;
  readonly execute?: (context: Readonly<Context>) => Promise<IResult> | IResult;
  readonly report?: (
    context: Readonly<Context>,
    result: Readonly<IResult>,
  ) => void;
  readonly onError?: (context: Readonly<Context>, error: unknown) => void;
}

/**
 * Fluent builder for constructing a {@link CommandStages} pipeline.
 *
 * Use this builder to define the validate, execute, report, and optional
 * onError stages of a CLI command in a readable, chainable API.
 *
 * @template Context - The validated context object produced by the validate stage.
 * @template IResult - The result object produced by the execute stage.
 *
 * @example
 * ```typescript
 * const stages = new CommandBuilder<MyContext, MyResult>()
 *   .validate(() => validateOptions(options))
 *   .execute(async (ctx) => runCommand(ctx))
 *   .report((ctx, result) => printReport(ctx, result))
 *   .onError((ctx, err) => logger.error(err))
 *   .build();
 * ```
 */
export class CommandBuilder<Context, IResult> {
  /**
   * Creates a new command builder.
   *
   * @param config - Builder configuration accumulated across fluent calls.
   */
  constructor(
    private readonly config: Readonly<
      ICommandBuilderConfig<Context, IResult>
    > = {},
  ) {}

  /**
   * Sets the validate stage function.
   *
   * The validate function is responsible for parsing and validating
   * CLI options, returning a typed {@link Context} object on success.
   *
   * @param fn - Function that validates inputs and returns a context object.
   * @returns This builder instance for chaining.
   */
  validate(fn: () => Context): CommandBuilder<Context, IResult> {
    return new CommandBuilder({
      ...this.config,
      validate: fn,
    });
  }

  /**
   * Sets the execute stage function.
   *
   * The execute function receives the validated context and performs
   * the core command logic, returning a result synchronously or as a Promise.
   *
   * @param fn - Function that executes the command and returns a result.
   * @returns This builder instance for chaining.
   */
  execute(
    fn: (context: Readonly<Context>) => Promise<IResult> | IResult,
  ): CommandBuilder<Context, IResult> {
    return new CommandBuilder({
      ...this.config,
      execute: fn,
    });
  }

  /**
   * Sets the report stage function.
   *
   * The report function receives the validated context and execution result,
   * and is responsible for presenting output to the user.
   *
   * @param fn - Function that reports the result of the command execution.
   * @returns This builder instance for chaining.
   */
  report(
    fn: (context: Readonly<Context>, result: Readonly<IResult>) => void,
  ): CommandBuilder<Context, IResult> {
    return new CommandBuilder({
      ...this.config,
      report: fn,
    });
  }

  /**
   * Sets the optional error handler stage function.
   *
   * When provided, this function is called if an error is thrown during
   * command execution, allowing for custom error reporting or recovery.
   *
   * @param fn - Function that handles errors thrown during execution.
   * @returns This builder instance for chaining.
   */
  onError(
    fn: (context: Readonly<Context>, error: unknown) => void,
  ): CommandBuilder<Context, IResult> {
    return new CommandBuilder({
      ...this.config,
      onError: fn,
    });
  }

  /**
   * Builds and returns the {@link CommandStages} object.
   *
   * Assembles all registered stage functions into a single immutable
   * {@link CommandStages} pipeline ready for execution by the command runner.
   *
   * @returns A {@link CommandStages} object containing the configured pipeline stages.
   * @throws Error when required stages have not been configured.
   */
  build(): ICommandStages<Context, IResult> {
    const { execute, onError, report, validate } = this.config;
    assert(
      validate && execute && report,
      "CommandBuilder requires validate, execute, and report stages before build().",
    );
    const executeStageFn = execute;
    const reportStageFn = report;
    const validateStageFn = validate;
    /**
     * Runs the configured execute stage and normalizes sync returns to a promise.
     *
     * @param context - Validated command context.
     * @returns Execution result as a promise.
     */
    async function executeStage(context: Readonly<Context>): Promise<IResult> {
      return executeStageFn(context);
    }

    const stages: ICommandStages<Context, IResult> = {
      validate: validateStageFn,
      execute: executeStage,
      report: reportStageFn,
    };
    return onError ? { ...stages, onError } : stages;
  }
}

export default CommandBuilder;
