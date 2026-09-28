/** Cron expression parser and next run time calculator */

/**
 * Parse cron expression and return next run times
 * Supported format: minute hour dayOfMonth month dayOfWeek
 * Special values: * (any), ? (no specific value), - (range), , (list), / (step)
 *
 * Examples:
 * - "0 9 * * *" - 每天早上 9 点
 * - "0 9 * * 1" - 每周一早上 9 点
 * - "*/5 * * * *" - 每 5 分钟
 * - "0 0 * * 0" - 每周日早上 12 点
 */
type ParseCronResult = {
  isValid: boolean;
  error?: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
};

export function parseCron(cronExpression: string): ParseCronResult {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      isValid: false,
      error: "Cron expression must have exactly 5 fields",
      minute: "",
      hour: "",
      dayOfMonth: "",
      month: "",
      dayOfWeek: "",
    };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Basic validation for each field
  const validators = [
    validateMinute,
    validateHour,
    validateDayOfMonth,
    validateMonth,
    validateDayOfWeek,
  ];

  for (let i = 0; i < validators.length; i++) {
    const result = validators[i](parts[i]);
    if (!result.isValid) {
      return {
        isValid: false,
        error: result.error,
        minute,
        hour,
        dayOfMonth,
        month,
        dayOfWeek,
      };
    }
  }

  return { isValid: true, minute, hour, dayOfMonth, month, dayOfWeek };
}

function validateMinute(value: string): { isValid: boolean; error?: string } {
  return validateField(value, 0, 59, ["*"]);
}

function validateHour(value: string): { isValid: boolean; error?: string } {
  return validateField(value, 0, 23, ["*"]);
}

function validateDayOfMonth(value: string): {
  isValid: boolean;
  error?: string;
} {
  return validateField(value, 1, 31, ["*", "?"]);
}

function validateMonth(value: string): { isValid: boolean; error?: string } {
  return validateField(value, 1, 12, ["*"]);
}

function validateDayOfWeek(value: string): {
  isValid: boolean;
  error?: string;
} {
  return validateField(value, 0, 7, ["*", "?"], ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
}

function validateField(
  value: string,
  min: number,
  max: number,
  specials: string[],
  aliases: string[] = []
): { isValid: boolean; error?: string } {
  // Check for special values
  if (specials.includes(value)) {
    return { isValid: true };
  }

  // Check for comma-separated values
  const parts = value.split(",");
  for (const part of parts) {
    const trimmed = part.trim();

    // Check for range (e.g., "1-5")
    if (trimmed.includes("-")) {
      const rangeParts = trimmed.split("-");
      if (rangeParts.length !== 2) {
        return { isValid: false, error: `Invalid range format: ${trimmed}` };
      }
      const start = parsePart(rangeParts[0]);
      const end = parsePart(rangeParts[1]);
      if (start === null || end === null) {
        return { isValid: false, error: `Invalid range: ${trimmed}` };
      }
      if (start < min || end > max || start > end) {
        return { isValid: false, error: `Range out of bounds: ${trimmed}` };
      }
      continue;
    }

    // Check for step (e.g., "*/5" or "1-10/2")
    if (trimmed.includes("/")) {
      const stepParts = trimmed.split("/");
      if (stepParts.length !== 2) {
        return { isValid: false, error: `Invalid step format: ${trimmed}` };
      }
      const base = stepParts[0];
      const step = parseInt(stepParts[1], 10);
      if (isNaN(step) || step <= 0) {
        return { isValid: false, error: `Invalid step value: ${trimmed}` };
      }
      if (!["*", ...aliases.map((a) => a.toLowerCase()), ...aliases].includes(base)) {
        const baseNum = parsePart(base);
        if (baseNum === null || baseNum < min || baseNum > max) {
          return { isValid: false, error: `Invalid base value: ${trimmed}` };
        }
      }
      continue;
    }

    // Check for single value or alias
    const num = parsePart(trimmed);
    if (num === null || num < min || num > max) {
      return { isValid: false, error: `Value out of range: ${trimmed}` };
    }
  }

  return { isValid: true };
}

function parsePart(value: string): number | null {
  // Handle numeric values
  const num = parseInt(value, 10);
  if (!isNaN(num)) {
    return num;
  }
  return null;
}

/**
 * Calculate next run time from a cron expression
 * @param cron - Cron expression (e.g., "0 9 * * *")
 * @param from - Starting date (defaults to now)
 * @returns Next run time or null if cannot calculate
 */
export function getNextRunTime(
  cron: string,
  from: Date = new Date()
): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;

  // Start from the next minute
  let date = new Date(from);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);

  // Try for 8 years to account for leap years
  const maxAttempts = 8 * 366 * 24 * 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // 1-12
    const dayOfWeek = date.getDay(); // 0-6 (Sun-Sat)

    // Check if current time matches all fields
    if (
      matches(minuteExpr, String(minute), 0, 59) &&
      matches(hourExpr, String(hour), 0, 23) &&
      matches(domExpr, String(dayOfMonth), 1, 31, true) &&
      matches(monthExpr, String(month), 1, 12, true) &&
      matchesDow(dowExpr, dayOfWeek)
    ) {
      return new Date(date);
    }

    // Increment by one minute
    date.setMinutes(date.getMinutes() + 1);
  }

  return null;
}

function matches(
  expr: string,
  value: string,
  min: number,
  max: number,
  acceptWildcard = false
): boolean {
  const num = parseInt(value, 10);

  // Wildcard matches everything
  if (expr === "*") return acceptWildcard || true;

  // Comma-separated list
  if (expr.includes(",")) {
    return expr.split(",").some((part) => matches(part.trim(), value, min, max, acceptWildcard));
  }

  // Step values
  if (expr.includes("/")) {
    const [base, stepStr] = expr.split("/");
    const step = parseInt(stepStr, 10);

    if (base === "*" || base === "") {
      return num % step === 0;
    }

    // Range with step
    if (base.includes("-")) {
      const [start, end] = base.split("-").map(Number);
      return num >= start && num <= end && (num - start) % step === 0;
    }

    // Single value with step
    const baseNum = parseInt(base, 10);
    return num >= baseNum && (num - baseNum) % step === 0;
  }

  // Range
  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map(Number);
    return num >= start && num <= end;
  }

  // Single value
  return num === parseInt(expr, 10);
}

function matchesDow(expr: string, dayOfWeek: number): boolean {
  if (expr === "*" || expr === "?") return true;

  // Map day names to numbers (Sun=0, Mon=1, ..., Sat=6)
  const dayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  const normalized = expr.toLowerCase();

  // Handle comma-separated list with day names
  if (normalized.includes(",")) {
    return normalized.split(",").some((part) => {
      const trimmed = part.trim();
      if (dayMap[trimmed] !== undefined) {
        return dayMap[trimmed] === dayOfWeek;
      }
      return matches(normalized, String(dayOfWeek), 0, 7);
    });
  }

  // Handle day name aliases
  if (dayMap[normalized] !== undefined) {
    return dayMap[normalized] === dayOfWeek;
  }

  return matches(expr, String(dayOfWeek), 0, 7);
}
