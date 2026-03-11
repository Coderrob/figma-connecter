/**
 * Command Builder Module
 *
 * Provides a fluent builder for constructing {@link CommandStages} objects
 * that define the lifecycle of a CLI command.
 *
 * @module commands/command-builder
 */
import type { ICommandStages } from "@/src/types/cli";

/**
 * Fluent builder for constructing a {@link CommandStages} pipeline.
 *
 * Use this builder to define the validate, execute, report, and optional
 * onError stages of a CLI command in a readable, chainable API.
 *
 * @template Context - The validated context object produced by the validate stage.
 * @template Result - The result object produced by the execute stage.
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
export class CommandBuilder<Context, Result> {
  private _validate!: () => Context;
  private _execute!: (context: Context) => Promise<Result> | Result;
  private _report!: (context: Context, result: Result) => void;
  private _onError?: (context: Context, error: unknown) => void;

  /**
   * Sets the validate stage function.
   *
   * The validate function is responsible for parsing and validating
   * CLI options, returning a typed {@link Context} object on success.
   *
   * @param fn - Function that validates inputs and returns a context object.
   * @returns This builder instance for chaining.
   */
  validate(fn: () => Context): this {
    this._validate = fn;
    return this;
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
  execute(fn: (context: Context) => Promise<Result> | Result): this {
    this._execute = fn;
    return this;
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
  report(fn: (context: Context, result: Result) => void): this {
    this._report = fn;
    return this;
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
  onError(fn: (context: Context, error: unknown) => void): this {
    this._onError = fn;
    return this;
  }

  /**
   * Builds and returns the {@link CommandStages} object.
   *
   * Assembles all registered stage functions into a single immutable
   * {@link CommandStages} pipeline ready for execution by the command runner.
   *
   * @returns A {@link CommandStages} object containing the configured pipeline stages.
   */
  build(): ICommandStages<Context, Result> {
    const stages: ICommandStages<Context, Result> = {
      /**
       * Validation stage wrapper.
       *
       * @returns {Context} Validated context
       */
      validate: () => this._validate(),
      /**
       * Execution stage wrapper.
       *
       * @param {Context} context - Validated context
       * @returns {Promise<Result>} Execution result
       */
      execute: (context: Context) =>
        Promise.resolve(this._execute(context) as unknown as Result),
      /**
       * Report stage wrapper.
       *
       * @param {Context} context - Validated context
       * @param {Result} result - Execution result
       * @returns {void}
       */
      report: (context: Context, result: Result) =>
        this._report(context, result),
      ...(this._onError
        ? {
            /**
             * Error handling stage wrapper.
             *
             * @param {Context} context - Validated context
             * @param {unknown} error - Error encountered
             * @returns {void}
             */
            onError: (context: Context, error: unknown) =>
              this._onError!(context, error),
          }
        : {}),
    };

    return stages;
  }
}

export default CommandBuilder;
