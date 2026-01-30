/**
 * Result type for error handling
 * Based on the pattern from srchd/src/tools/process.ts
 */

export type Result<T> =
  | { success: true; value: T }
  | { success: false; code: string; message: string; cause?: unknown };

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<T>(code: string, message: string, cause?: unknown): Result<T> {
  return { success: false, code, message, cause };
}

export function isOk<T>(result: Result<T>): result is { success: true; value: T } {
  return result.success === true;
}

export function isErr<T>(result: Result<T>): result is { success: false; code: string; message: string; cause?: unknown } {
  return result.success === false;
}
