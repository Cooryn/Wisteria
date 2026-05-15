import type { ToolError } from "./types.js";

export class WisteriaError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "WisteriaError";
  }
}

export function toToolError(error: unknown): ToolError {
  if (error instanceof WisteriaError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: error.message,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "UNKNOWN_ERROR",
      message: "Unknown error",
    },
  };
}
