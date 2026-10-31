/**
 * Typed business errors. Services throw these; the Server Action wrapper turns
 * them into friendly toasts and the API wrapper into JSON with an HTTP status.
 */
import { canTransition, type Flow } from "@/lib/workflows";
import { humanize } from "@/lib/format";

export type ErrorCode =
  | "VALIDATION"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "DISPATCH_INCOMPLETE"
  | "RATE_LIMITED";

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 422,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  DISPATCH_INCOMPLETE: 409,
  RATE_LIMITED: 429,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

export function notFoundError(what: string): AppError {
  return new AppError("NOT_FOUND", `${what} not found`);
}

export function assertFound<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw notFoundError(what);
  return value;
}

/** Guard a status change against the record's state machine. */
export function assertTransition<S extends string>(entity: string, flow: Flow<S>, from: S, to: S): void {
  if (!canTransition(flow, from, to)) {
    throw new AppError(
      "INVALID_STATE",
      `This ${entity} is "${humanize(from)}" and cannot move to "${humanize(to)}".`,
    );
  }
}

/** Mongo duplicate-key error (unique index violation). */
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}
