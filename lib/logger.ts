/**
 * Structured application logging with redaction.
 * Categories map to operational domains for filtering in log drains.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogCategory =
  | "app"
  | "security"
  | "billing"
  | "webhook"
  | "activation"
  | "job"
  | "email"
  | "health"
  | "analytics";

export type LogFields = Record<string, unknown>;

const SENSITIVE_KEY =
  /(password|secret|token|authorization|cookie|api[_-]?key|service[_-]?role|private[_-]?key|card|cvv|ssn)/i;

const EMAIL_RE = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 8 && /^[A-Za-z0-9_\-]{20,}$/.test(value)) {
      return `[redacted:${value.slice(0, 4)}…]`;
    }
    return value.replace(EMAIL_RE, (_, local: string, domain: string) => {
      const hint = local.slice(0, 1);
      return `${hint}***@${domain}`;
    });
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(nested);
    }
    return out;
  }
  return value;
}

function write(
  level: LogLevel,
  category: LogCategory,
  message: string,
  fields?: LogFields,
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    category,
    message,
    ...(fields ? { fields: redactValue(fields) as LogFields } : {}),
  };

  const line = `[awarix/${category}] ${JSON.stringify(payload)}`;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  info(category: LogCategory, message: string, fields?: LogFields) {
    write("info", category, message, fields);
  },
  warn(category: LogCategory, message: string, fields?: LogFields) {
    write("warn", category, message, fields);
  },
  error(category: LogCategory, message: string, fields?: LogFields) {
    write("error", category, message, fields);
  },
  security(message: string, fields?: LogFields) {
    write("warn", "security", message, fields);
  },
  billing(message: string, fields?: LogFields) {
    write("info", "billing", message, fields);
  },
  webhook(message: string, fields?: LogFields) {
    write("info", "webhook", message, fields);
  },
  activation(message: string, fields?: LogFields) {
    write("info", "activation", message, fields);
  },
  job(message: string, fields?: LogFields) {
    write("info", "job", message, fields);
  },
};
