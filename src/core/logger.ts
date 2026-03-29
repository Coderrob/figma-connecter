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
 * Logger Module
 *
 * Provides structured logging for the CLI tool with support for
 * different log levels and formatted output.
 *
 * @module core/logger
 */

/**
 * Log levels in order of verbosity.
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Structured context attached to log entries.
 */
export interface ILogContext {
  /** Stage name for pipeline logging. */
  readonly stage?: string;
  /** Component name or identifier. */
  readonly component?: string;
  /** Duration in milliseconds. */
  readonly durationMs?: number;
  /** Additional context fields. */
  readonly [key: string]: unknown;
}

/**
 * Logger configuration options.
 */
export interface ILoggerOptions {
  /** Explicit log level override. */
  readonly level?: LogLevel;
  /** Enable verbose (debug) output. */
  readonly verbose?: boolean;
  /** Suppress non-error output. */
  readonly quiet?: boolean;
  /** Enable ANSI colors in output. */
  readonly useColors?: boolean;
  /** Base context to apply to every log line. */
  readonly baseContext?: ILogContext;
}

/**
 * Known keys in the ILogContext object.
 */
export enum LogContextKey {
  Stage = "stage",
  Component = "component",
  DurationMs = "durationMs",
}

const DURATION_CONTEXT_KEY = "durationMs";

/**
 * Logger methods that support scoped message prefixing.
 */
enum ScopedLogMethodName {
  Debug = "debug",
  Error = "error",
  Info = "info",
  Success = "success",
  Warn = "warn",
}

const SCOPED_LOG_METHOD_NAMES: readonly string[] = Object.values(
  ScopedLogMethodName,
);

/**
 * Keys given priority in context output ordering.
 */
const PRIORITY_CONTEXT_KEYS: readonly LogContextKey[] = [
  LogContextKey.Stage,
  LogContextKey.Component,
  LogContextKey.DurationMs,
];

/**
 * Suffix appended to duration values in log output.
 */
const DURATION_UNIT_SUFFIX = "ms";

/**
 * Indicator prefix for success log messages.
 */
const SUCCESS_INDICATOR = "✓";

/**
 * Log level names for output formatting.
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN",
  [LogLevel.INFO]: "INFO",
  [LogLevel.DEBUG]: "DEBUG",
};

/**
 * ANSI color codes for terminal output.
 */
const COLORS: Readonly<Record<string, string>> = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

/**
 * Logger class for structured CLI output.
 *
 * Supports multiple log levels and can be configured for verbose
 * or quiet operation. Messages are formatted with timestamps and
 * level indicators.
 *
 * @example
 * ```typescript
 * const logger = new Logger(LogLevel.DEBUG);
 * logger.info('Processing component');
 * logger.debug('Detailed info', { component: 'Button' });
 * ```
 */
export class Logger {
  /** Optional mutable color override used by tests and runtime adapters. */
  useColors?: boolean;
  /**
   * Creates a new Logger instance.
   *
   * @param level - The minimum log level to output.
   * @param useColors - Whether to use ANSI colors in output.
   */
  constructor(level?: LogLevel, useColors?: boolean);

  /**
   * Creates a new Logger instance from options.
   *
   * @param options - Logger options object.
   */
  constructor(options?: ILoggerOptions);

  /**
   * Creates a new Logger instance.
   *
   * @param levelOrOptions - Log level or options object.
   * @param useColorsOption - Whether to enable ANSI colors.
   */
  constructor(
    private readonly levelOrOptions: LogLevel | ILoggerOptions = LogLevel.INFO,
    private readonly useColorsOption?: boolean,
  ) {
    this.useColors =
      typeof levelOrOptions === "object"
        ? levelOrOptions.useColors
        : useColorsOption;
  }

  /**
   * Resolves logger options from constructor inputs.
   *
   * @returns Normalized logger options.
   */
  private get options(): ILoggerOptions {
    return typeof this.levelOrOptions === "object"
      ? this.levelOrOptions
      : this.useColorsOption === undefined
        ? { level: this.levelOrOptions }
        : { level: this.levelOrOptions, useColors: this.useColorsOption };
  }

  /**
   * Resolves the active logger level.
   *
   * @returns Active log level.
   */
  private get level(): LogLevel {
    return resolveLogLevel(this.options);
  }

  /**
   * Determines whether colors should be used for output.
   *
   * @returns True when ANSI colors are enabled.
   */
  private get isColorOutputEnabled(): boolean {
    const explicit = this.useColors ?? this.options.useColors;
    return explicit ?? Boolean(process.stdout.isTTY);
  }

  /**
   * Returns the base logging context.
   *
   * @returns Base context object.
   */
  private get baseContext(): ILogContext {
    return this.options.baseContext ?? {};
  }

  /**
   * Logs an error message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  error(message: string, context?: Readonly<ILogContext>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Logs a warning message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  warn(message: string, context?: Readonly<ILogContext>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Logs an info message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  info(message: string, context?: Readonly<ILogContext>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Logs a debug message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  debug(message: string, context?: Readonly<ILogContext>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Logs a success message (info level with green color).
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  success(message: string, context?: Readonly<ILogContext>): void {
    if (this.level >= LogLevel.INFO) {
      const prefix = this.isColorOutputEnabled
        ? `${COLORS.green}${SUCCESS_INDICATOR}${COLORS.reset}`
        : SUCCESS_INDICATOR;
      console.log(
        `${prefix} ${message}${this.formatContext(this.mergeContext(context))}`,
      );
    }
  }

  /**
   * Internal log method.
   *
   * @param level - Log level for the entry.
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  private log(
    level: Readonly<LogLevel>,
    message: string,
    context?: Readonly<ILogContext>,
  ): void {
    if (this.level < level) {
      return;
    }

    const levelName = LOG_LEVEL_NAMES[level];
    const coloredLevel = this.colorize(levelName, level);
    const contextStr = this.formatContext(this.mergeContext(context));

    const output = `${coloredLevel} ${message}${contextStr}`;

    if (level === LogLevel.ERROR) {
      console.error(output);
    } else if (level === LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Applies color to a string based on log level.
   *
   * @param text - Text to colorize.
   * @param level - Log level used for color selection.
   * @returns Colorized text.
   */
  private colorize(text: string, level: Readonly<LogLevel>): string {
    if (!this.isColorOutputEnabled) {
      return `[${text}]`;
    }

    const colorMap: Record<LogLevel, string> = {
      [LogLevel.ERROR]: COLORS.red,
      [LogLevel.WARN]: COLORS.yellow,
      [LogLevel.INFO]: COLORS.cyan,
      [LogLevel.DEBUG]: COLORS.dim,
    };

    const color = colorMap[level];
    return `${color}[${text}]${COLORS.reset}`;
  }

  /**
   * Formats context object for output.
   *
   * @param context - Context data to format.
   * @returns Formatted context string.
   */
  private formatContext(context?: Readonly<ILogContext>): string {
    if (!context || Object.keys(context).length === 0) {
      return "";
    }

    const orderedPairs = this.orderContextEntries(context);
    if (orderedPairs.length === 0) {
      return "";
    }

    const pairs = orderedPairs.map(formatContextEntry).join(" ");

    return this.isColorOutputEnabled
      ? ` ${COLORS.dim}(${pairs})${COLORS.reset}`
      : ` (${pairs})`;
  }

  /**
   * Orders context entries to keep stage/component/duration first.
   *
   * @param context - Context data to order.
   * @returns Ordered key-value entries.
   */
  private orderContextEntries(
    context: Readonly<ILogContext>,
  ): [string, unknown][] {
    const priorityEntries = PRIORITY_CONTEXT_KEYS.filter(
      isDefinedContextKey(context),
    ).map(toContextEntry(context));

    const priorityKeys = PRIORITY_CONTEXT_KEYS.map(getContextKeyName);
    const otherEntries = Object.entries(context).filter(
      filterDefinedNonPriorityEntries(priorityKeys),
    );

    return [...priorityEntries, ...otherEntries];
  }

  /**
   * Merges base context with a per-call context.
   *
   * @param context - Context data to merge.
   * @returns Merged context or undefined when empty.
   */
  private mergeContext(
    context?: Readonly<ILogContext>,
  ): ILogContext | undefined {
    if (!context || Object.keys(context).length === 0) {
      return Object.keys(this.baseContext).length > 0
        ? this.baseContext
        : undefined;
    }
    if (Object.keys(this.baseContext).length === 0) {
      return context;
    }
    return { ...this.baseContext, ...context };
  }

  /**
   * Creates a new logger with additional base context merged in.
   *
   * @param context - Context data to merge.
   * @returns New logger instance with merged context.
   */
  withContext(context: Readonly<ILogContext>): Logger {
    const merged = { ...this.baseContext, ...context };
    return new Logger({
      level: this.level,
      useColors: this.useColors ?? this.options.useColors,
      baseContext: merged,
    });
  }
}

/**
 * Creates a child logger with a prefix.
 * Useful for scoping logs to a specific component or phase.
 *
 * @param logger - Base logger instance.
 * @param scope - Prefix label to apply to messages.
 * @returns Scoped logger proxy.
 */
export function createScopedLogger(
  logger: Readonly<Logger>,
  scope: string,
): Readonly<Logger> {
  return new Proxy(logger, createScopedLoggerHandler(scope));
}

/**
 * Creates the proxy handler used by scoped loggers.
 *
 * @param scope - Scope label to prepend to log messages.
 * @returns Proxy handler for a logger instance.
 */
function createScopedLoggerHandler(
  scope: string,
): ProxyHandler<Readonly<Logger>> {
  return {
    get: handleScopedLoggerProxyGet.bind(undefined, scope),
  };
}

/**
 * Creates a scoped log method that prefixes the message label.
 *
 * @param target - Underlying logger instance.
 * @param value - Original logger method.
 * @param scope - Scope label to prepend to log messages.
 * @returns Scoped logger method.
 */
function createScopedLogMethod(
  target: Readonly<Logger>,
  value: (message: string, context?: Readonly<ILogContext>) => void,
  scope: string,
): (message: string, context?: Readonly<ILogContext>) => void {
  return (message: string, context?: Readonly<ILogContext>): void => {
    Reflect.apply(value, target, [`[${scope}] ${message}`, context]);
  };
}

/**
 * Filters non-priority context entries that still have values.
 *
 * @param priorityKeys - Set of keys already emitted.
 * @returns Predicate for filtering `Object.entries()` output.
 */
function filterDefinedNonPriorityEntries(
  priorityKeys: readonly string[],
): (entry: readonly [string, unknown]) => boolean {
  return isDefinedNonPriorityEntry.bind(undefined, priorityKeys);
}

/**
 * Formats a context entry for log output.
 *
 * @param entry - Context entry tuple.
 * @returns Formatted key/value segment.
 */
function formatContextEntry(entry: readonly [string, unknown]): string {
  const [key, value] = entry;
  if (key === DURATION_CONTEXT_KEY && typeof value === "number") {
    return `${key}=${value}${DURATION_UNIT_SUFFIX}`;
  }
  const formatted = typeof value === "string" ? value : JSON.stringify(value);
  return `${key}=${formatted}`;
}

/**
 * Returns the string representation of a log context key.
 *
 * @param key - Context key enum value.
 * @returns Key name as used in output.
 */
function getContextKeyName(key: Readonly<LogContextKey>): string {
  return key;
}

/**
 * Returns a scoped property value from the underlying logger.
 *
 * @param target - Underlying logger instance.
 * @param prop - Property being accessed.
 * @param scope - Scope label to prepend to log messages.
 * @returns Wrapped logger method or original property value.
 */
function getScopedLoggerProperty(
  target: Readonly<Logger>,
  prop: keyof Logger,
  scope: string,
): unknown {
  if (isScopedLogMethod(prop)) {
    return createScopedLogMethod(target, target[prop], scope);
  }
  return target[prop];
}

/**
 * Resolves a proxied property read for a scoped logger.
 *
 * @param scope - Scope label to prepend to log messages.
 * @param target - Underlying logger instance.
 * @param prop - Property being accessed.
 * @returns Wrapped logger method or original property value.
 */
function handleScopedLoggerProxyGet(
  scope: string,
  target: Readonly<Logger>,
  prop: keyof Logger,
): unknown {
  return getScopedLoggerProperty(target, prop, scope);
}

/**
 * Returns true when a logger property is a scopeable log method.
 *
 * @param prop - Logger property name.
 * @returns True when the property is a log method that accepts message/context.
 */
function isScopedLogMethod(prop: keyof Logger): prop is ScopedLogMethodName {
  return SCOPED_LOG_METHOD_NAMES.includes(prop);
}

/**
 * Returns true when a prioritized context key has a defined value.
 *
 * @param context - Context to inspect.
 * @param key - Candidate prioritized context key.
 * @returns True when the key has a defined value.
 */
function hasDefinedContextKey(
  context: Readonly<ILogContext>,
  key: Readonly<LogContextKey>,
): boolean {
  return context[key] !== undefined;
}

/**
 * Filters prioritized context keys that have a defined value.
 *
 * @param context - Context to inspect.
 * @returns Predicate for filtering defined priority keys.
 */
function isDefinedContextKey(
  context: Readonly<ILogContext>,
): (key: LogContextKey) => boolean {
  return hasDefinedContextKey.bind(undefined, context);
}

/**
 * Returns true when a context entry is defined and not already prioritized.
 *
 * @param priorityKeys - Keys already emitted in priority order.
 * @param entry - Context entry tuple.
 * @returns True when the entry should be included in non-priority output.
 */
function isDefinedNonPriorityEntry(
  priorityKeys: readonly string[],
  entry: readonly [string, unknown],
): boolean {
  const [key, value] = entry;
  return value !== undefined && !priorityKeys.includes(key);
}

/**
 * Converts a prioritized context key into a key/value tuple.
 *
 * @param context - Context providing the values.
 * @param key - Prioritized context key to convert.
 * @returns Context entry tuple.
 */
function mapContextEntry(
  context: Readonly<ILogContext>,
  key: Readonly<LogContextKey>,
): [string, unknown] {
  return [getContextKeyName(key), context[key]];
}

/**
 * Resolves a log level from a set of options.
 *
 * @param options - Logger options to evaluate.
 * @returns Resolved log level.
 */
export function resolveLogLevel(
  options: Readonly<ILoggerOptions> = {},
): LogLevel {
  if (options.quiet) {
    return LogLevel.ERROR;
  }
  if (options.level !== undefined) {
    return options.level;
  }
  if (options.verbose) {
    return LogLevel.DEBUG;
  }
  return LogLevel.INFO;
}

/**
 * Converts prioritized context keys into key/value tuples.
 *
 * @param context - Context providing the values.
 * @returns Mapper that produces context entries.
 */
function toContextEntry(
  context: Readonly<ILogContext>,
): (key: LogContextKey) => [string, unknown] {
  return mapContextEntry.bind(undefined, context);
}
