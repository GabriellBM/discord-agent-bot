export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SUCCESS";

export type LogContext =
  | "SYSTEM"
  | "DISCORD"
  | "VOICE"
  | "MUSIC"
  | "AI"
  | "MODERATION";

export type LogMetadata = Record<string, string | number | boolean | null | undefined>;

const TIME_ZONE = "America/Recife";

function formatTimestamp(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  return `${parts}.${milliseconds}`;
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "ON" : "OFF";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ")}"`;
}

function formatMetadata(metadata?: LogMetadata): string {
  if (!metadata) {
    return "";
  }

  return Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${formatValue(value as string | number | boolean)}`)
    .join(" ");
}

function writeLog(
  level: LogLevel,
  context: LogContext,
  event: string,
  metadata?: LogMetadata
): void {
  if (level === "DEBUG" && process.env.NODE_ENV === "production") {
    return;
  }

  const timestamp = formatTimestamp();
  const normalizedEvent = event.toUpperCase().replace(/\s+/g, "_");
  const meta = formatMetadata(metadata);
  const line = [
    timestamp.padEnd(24),
    level.padEnd(8),
    `[${context}]`.padEnd(14),
    normalizedEvent.padEnd(14),
    meta
  ]
    .filter(Boolean)
    .join(" ");

  console.log(line);
}

export const logger = {
  debug: (context: LogContext, event: string, metadata?: LogMetadata) =>
    writeLog("DEBUG", context, event, metadata),

  info: (context: LogContext, event: string, metadata?: LogMetadata) =>
    writeLog("INFO", context, event, metadata),

  success: (context: LogContext, event: string, metadata?: LogMetadata) =>
    writeLog("SUCCESS", context, event, metadata),

  warn: (context: LogContext, event: string, metadata?: LogMetadata) =>
    writeLog("WARN", context, event, metadata),

  error: (context: LogContext, event: string, metadata?: LogMetadata) =>
    writeLog("ERROR", context, event, metadata)
};
