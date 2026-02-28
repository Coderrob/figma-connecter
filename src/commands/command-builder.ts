/**
 * Fluent CommandStages builder
 */
import type { CommandStages } from "../types/cli";

export class CommandBuilder<Context, Result> {
  private _validate!: () => Context;
  private _execute!: (context: Context) => Promise<Result> | Result;
  private _report!: (context: Context, result: Result) => void;
  private _onError?: (context: Context, error: unknown) => void;

  validate(fn: () => Context): this {
    this._validate = fn;
    return this;
  }

  execute(fn: (context: Context) => Promise<Result> | Result): this {
    this._execute = fn;
    return this;
  }

  report(fn: (context: Context, result: Result) => void): this {
    this._report = fn;
    return this;
  }

  onError(fn: (context: Context, error: unknown) => void): this {
    this._onError = fn;
    return this;
  }

  build(): CommandStages<Context, Result> {
    const stages: CommandStages<Context, Result> = {
      validate: () => this._validate(),
      execute: (context: Context) =>
        Promise.resolve(this._execute(context) as unknown as Result),
      report: (context: Context, result: Result) =>
        this._report(context, result),
      ...(this._onError
        ? {
            onError: (context: Context, error: unknown) =>
              this._onError!(context, error),
          }
        : {}),
    };

    return stages;
  }
}

export default CommandBuilder;
