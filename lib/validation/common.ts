const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function parseUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed;
}

export function requireUuid(value: unknown, fieldName: string): string {
  const parsed = parseUuid(value);
  if (!parsed) {
    throw new ValidationError(`${fieldName} must be a valid id.`);
  }
  return parsed;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function clampString(
  value: unknown,
  args: { max: number; min?: number; field: string },
): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${args.field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < (args.min ?? 1)) {
    throw new ValidationError(`${args.field} is required.`);
  }
  if (trimmed.length > args.max) {
    throw new ValidationError(`${args.field} is too long.`);
  }
  return trimmed;
}

export function optionalClampString(
  value: unknown,
  args: { max: number; field: string },
): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new ValidationError(`${args.field} must be text.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > args.max) {
    throw new ValidationError(`${args.field} is too long.`);
  }
  return trimmed;
}

export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`Invalid ${field}.`);
  }
  return value as T;
}

export function parseOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | null {
  if (value == null || value === "") return null;
  return parseEnum(value, allowed, field);
}

export function parseBoundedInt(
  value: unknown,
  args: { min: number; max: number; field: string; fallback?: number },
): number {
  if (value == null || value === "") {
    if (args.fallback != null) return args.fallback;
    throw new ValidationError(`${args.field} is required.`);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new ValidationError(`${args.field} must be a whole number.`);
  }
  if (n < args.min || n > args.max) {
    throw new ValidationError(
      `${args.field} must be between ${args.min} and ${args.max}.`,
    );
  }
  return n;
}

export function parseUuidArray(
  value: unknown,
  args: { max: number; field: string },
): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError(`${args.field} must be a list.`);
  }
  if (value.length > args.max) {
    throw new ValidationError(`${args.field} has too many items.`);
  }
  const out: string[] = [];
  for (const item of value) {
    const id = parseUuid(item);
    if (!id) {
      throw new ValidationError(`${args.field} contains an invalid id.`);
    }
    out.push(id);
  }
  return out;
}

export function parsePagination(args: {
  limit?: unknown;
  offset?: unknown;
  maxLimit?: number;
}): { limit: number; offset: number } {
  const maxLimit = args.maxLimit ?? 100;
  return {
    limit: parseBoundedInt(args.limit, {
      min: 1,
      max: maxLimit,
      field: "limit",
      fallback: 25,
    }),
    offset: parseBoundedInt(args.offset, {
      min: 0,
      max: 100_000,
      field: "offset",
      fallback: 0,
    }),
  };
}
