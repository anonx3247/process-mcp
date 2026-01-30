/**
 * MCP helper utilities
 */

import { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { Result, isErr } from "./error.js";

/**
 * Convert a Result to an MCP CallToolResult
 */
export function resultToCallToolResult<T>(result: Result<T>): CallToolResult {
  if (isErr(result)) {
    const errorObj: { error: string; message: string; cause?: string } = {
      error: result.code,
      message: result.message,
    };
    if (result.cause) {
      errorObj.cause = String(result.cause);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(errorObj, null, 2),
        } as TextContent,
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: typeof result.value === "string"
          ? result.value
          : JSON.stringify(result.value, null, 2),
      } as TextContent,
    ],
  };
}

/**
 * Helper to create an error result
 */
export function errorToCallToolResult(code: string, message: string, cause?: unknown): CallToolResult {
  const errorObj: { error: string; message: string; cause?: string } = {
    error: code,
    message,
  };
  if (cause) {
    errorObj.cause = String(cause);
  }
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(errorObj, null, 2),
      } as TextContent,
    ],
    isError: true,
  };
}
