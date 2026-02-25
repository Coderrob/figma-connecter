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
export interface LogContext {
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
export interface LoggerOptions {
  /** Explicit log level override. */
  readonly level?: LogLevel;
  /** Enable verbose (debug) output. */
  readonly verbose?: boolean;
  /** Suppress non-error output. */
  readonly quiet?: boolean;
  /** Enable ANSI colors in output. */
  readonly useColors?: boolean;
  /** Base context to apply to every log line. */
  readonly baseContext?: LogContext;
}

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
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
} as const;

/**
 * Type guard for string values.
 *
 * @param value - Value to check.
 * @returns True if value is a string.
 */
const isString = (value: unknown): value is string => typeof value === "string";

/**
 * Type guard for number values.
 *
 * @param value - Value to check.
 * @returns True if value is a number.
 */
const isNumber = (value: unknown): value is number => typeof value === "number";

/**
 * Type guard for object values.
 *
 * @param value - Value to check.
 * @returns True if value is an object.
 */
const isObject = (value: unknown): value is object => typeof value === "object";

/**
 * Type guard for function values.
 *
 * @param value - Value to check.
 * @returns True if value is a function.
 */
const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

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
  private readonly level: LogLevel;

  private readonly useColors: boolean;

  private readonly baseContext: LogContext;

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
  constructor(options?: LoggerOptions);

  /**
   * Creates a new Logger instance.
   *
   * @param levelOrOptions - Log level or options object.
   * @param useColors - Whether to enable ANSI colors.
   */
  constructor(
    levelOrOptions: LogLevel | LoggerOptions = LogLevel.INFO,
    useColors = false,
  ) {
    const options: LoggerOptions =
      isObject(levelOrOptions)
        ? (levelOrOptions as LoggerOptions)
        : { level: levelOrOptions, useColors };

    this.level = resolveLogLevel(options);
    this.useColors = Boolean(options.useColors) && process.stdout.isTTY;
    this.baseContext = options.baseContext ?? {};
  }

  /**
   * Logs an error message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Logs a warning message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Logs an info message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Logs a debug message.
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Logs a success message (info level with green color).
   *
   * @param message - Message to log.
   * @param context - Optional context data.
   * @returns Nothing.
   */
  success(message: string, context?: LogContext): void {
    if (this.level >= LogLevel.INFO) {
      const prefix = this.useColors ? `${COLORS.green}✓${COLORS.reset}` : "✓";
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
  private log(level: LogLevel, message: string, context?: LogContext): void {
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
  private colorize(text: string, level: LogLevel): string {
    if (!this.useColors) {
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
  private formatContext(context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return "";
    }

    const orderedPairs = this.orderContextEntries(context);
    if (orderedPairs.length === 0) {
      return "";
    }

    const pairs = orderedPairs
      .map(([key, value]) => {
        if (key === "durationMs" && isNumber(value)) {
          return `${key}=${value}ms`;
        }
        const formatted = isString(value) ? value : JSON.stringify(value);
        return `${key}=${formatted}`;
      })
      .join(" ");

    return this.useColors
      ? ` ${COLORS.dim}(${pairs})${COLORS.reset}`
      : ` (${pairs})`;
  }

  /**
   * Orders context entries to keep stage/component/duration first.
   *
   * @param context - Context data to order.
   * @returns Ordered key-value entries.
   */
  private orderContextEntries(context: LogContext): [string, unknown][] {
    const priorityKeys: (keyof LogContext)[] = [
      "stage",
      "component",
      "durationMs",
    ];
    const used = new Set<string>();
    const entries: [string, unknown][] = [];

    for (const key of priorityKeys) {
      const value = context[key];
      if (value !== undefined) {
        entries.push([key as string, value]);
        used.add(key as string);
      }
    }

    for (const [key, value] of Object.entries(context)) {
      if (value === undefined || used.has(key)) {
        continue;
      }
      entries.push([key, value]);
    }

    return entries;
  }

  /**
   * Merges base context with a per-call context.
   *
   * @param context - Context data to merge.
   * @returns Merged context or undefined when empty.
   */
  private mergeContext(context?: LogContext): LogContext | undefined {
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
  withContext(context: LogContext): Logger {
    const merged = { ...this.baseContext, ...context };
    return new Logger({
      level: this.level,
      useColors: this.useColors,
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
export function createScopedLogger(logger: Logger, scope: string): Logger {
  return new Proxy(logger, {
    /**
     * Intercepts log method access to add a prefix.
     *
     * @param target - Target logger instance.
     * @param prop - Property being accessed.
     * @returns Wrapped logger method or property value.
     */
    get(target, prop: keyof Logger) {
      const value = target[prop];
      if (isFunction(value)) {
        return (message: string, context?: LogContext) => {
          (value as (msg: string, ctx?: LogContext) => void).call(
            target,
            `[${scope}] ${message}`,
            context,
          );
        };
      }
      return value;
    },
  });
}

/**
 * Resolves a log level from a set of options.
 *
 * @param options - Logger options to evaluate.
 * @returns Resolved log level.
 */
export function resolveLogLevel(options: LoggerOptions = {}): LogLevel {
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
