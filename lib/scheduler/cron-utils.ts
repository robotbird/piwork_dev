/** Cron expression utilities for scheduled tasks */

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

type FieldValidationResult = {
  isValid: boolean;
  error?: string;
};

function validateMinute(value: string): FieldValidationResult {
  return validateField(value, 0, 59, ["*"]);
}

function validateHour(value: string): FieldValidationResult {
  return validateField(value, 0, 23, ["*"]);
}

function validateDayOfMonth(value: string): FieldValidationResult {
  return validateField(value, 1, 31, ["*", "?"]);
}

function validateMonth(value: string): FieldValidationResult {
  return validateField(value, 1, 12, ["*"]);
}

function validateDayOfWeek(value: string): FieldValidationResult {
  return validateField(value, 0, 7, ["*", "?"], [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ]);
}

function validateField(
  value: string,
  min: number,
  max: number,
  specials: string[],
  aliases: string[] = [],
): FieldValidationResult {
  if (specials.includes(value)) {
    return { isValid: true };
  }

  const parts = value.split(",");
  for (const part of parts) {
    const trimmed = part.trim();

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
      continue;
    }

    const num = parsePart(trimmed);
    if (num === null || num < min || num > max) {
      return { isValid: false, error: `Value out of range: ${trimmed}` };
    }
  }

  return { isValid: true };
}

function parsePart(value: string): number | null {
  const num = parseInt(value, 10);
  if (!isNaN(num)) {
    return num;
  }
  return null;
}

/** Calculate next run time from a cron expression */
export function getNextRunTime(cron: string, from: Date = new Date()): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;

  const date = new Date(from);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);

  const maxAttempts = 8 * 366 * 24 * 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    if (
      matches(minuteExpr, String(minute), 0, 59) &&
      matches(hourExpr, String(hour), 0, 23) &&
      matches(domExpr, String(dayOfMonth), 1, 31, true) &&
      matches(monthExpr, String(month), 1, 12, true) &&
      matchesDow(dowExpr, dayOfWeek)
    ) {
      return new Date(date);
    }

    date.setMinutes(date.getMinutes() + 1);
  }

  return null;
}

function matches(
  expr: string,
  value: string,
  min: number,
  max: number,
  acceptWildcard = false,
): boolean {
  const num = parseInt(value, 10);

  if (expr === "*") return acceptWildcard || true;

  if (expr.includes(",")) {
    return expr.split(",").some((part) => matches(part.trim(), value, min, max, acceptWildcard));
  }

  if (expr.includes("/")) {
    const [base, stepStr] = expr.split("/");
    const step = parseInt(stepStr, 10);

    if (base === "*" || base === "") {
      return num % step === 0;
    }

    if (base.includes("-")) {
      const [start, end] = base.split("-").map(Number);
      return num >= start && num <= end && (num - start) % step === 0;
    }

    const baseNum = parseInt(base, 10);
    return num >= baseNum && (num - baseNum) % step === 0;
  }

  if (expr.includes("-")) {
    const [start, end] = expr.split("-").map(Number);
    return num >= start && num <= end;
  }

  return num === parseInt(expr, 10);
}

function matchesDow(expr: string, dayOfWeek: number): boolean {
  if (expr === "*" || expr === "?") return true;

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

  if (normalized.includes(",")) {
    return normalized.split(",").some((part) => {
      const trimmed = part.trim();
      if (dayMap[trimmed] !== undefined) {
        return dayMap[trimmed] === dayOfWeek;
      }
      return matches(normalized, String(dayOfWeek), 0, 7);
    });
  }

  if (dayMap[normalized] !== undefined) {
    return dayMap[normalized] === dayOfWeek;
  }

  return matches(expr, String(dayOfWeek), 0, 7);
}

/** Get human-readable description of schedule */
export function describeSchedule(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dom, month, dow] = parts;

  if (minute === "0" && hour === "9" && dom === "*" && month === "*" && dow === "*") {
    return "Daily at 9:00 AM";
  }

  if (minute === "0" && hour === "9" && dom === "*" && month === "*" && (dow === "1" || dow.toLowerCase() === "mon")) {
    return "Every Monday at 9:00 AM";
  }

  if (dom === "*" && month === "*" && dow === "0") {
    return "Every Sunday at 12:00 AM";
  }

  const descriptions: string[] = [];

  if (minute !== "*") {
    descriptions.push(`minute ${minute}`);
  }

  if (hour !== "*") {
    descriptions.push(`hour ${hour}`);
  }

  if (dom !== "*" && dom !== "?") {
    descriptions.push(`day ${dom}`);
  }

  if (month !== "*") {
    descriptions.push(`month ${month}`);
  }

  if (dow !== "*" && dow !== "?") {
    descriptions.push(`day of week ${dow}`);
  }

  return descriptions.length > 0 ? descriptions.join(", ") : cron;
}