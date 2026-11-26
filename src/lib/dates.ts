// Calendar days are the athlete's local days, written "YYYY-MM-DD".

export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** The last `days` date keys, oldest first, ending today. */
export function lastDays(days: number): string[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => toDateKey(addDays(today, i - days + 1)));
}

export function shortDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
