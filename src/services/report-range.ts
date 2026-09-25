export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "custom";
const day = 86_400_000;

// Convert a local midnight into UTC. Recomputing the offset handles Cairo's
// summer-time transitions without hard-coding a UTC offset.
function localMidnight(date: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  let result = utc;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", minute: "2-digit", second: "2-digit" });
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    result += utc - observed;
  }
  return new Date(result);
}
export function localDate(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function addDays(date: string, offset: number): string { return new Date(Date.parse(`${date}T00:00:00Z`) + offset * day).toISOString().slice(0, 10); }
function validDate(value: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const parsed = new Date(`${value}T00:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }

export function getReportRange(timeZone: string, period: string = "7d", from?: string, to?: string, now = new Date()) {
  const today = localDate(now, timeZone);
  let start: string; let end: string;
  switch (period) {
    case "today": start = end = today; break;
    case "yesterday": start = end = addDays(today, -1); break;
    case "30d": start = addDays(today, -29); end = today; break;
    case "month": start = `${today.slice(0, 7)}-01`; end = today; break;
    case "lastMonth": { const first = `${today.slice(0, 7)}-01`; end = addDays(first, -1); start = `${end.slice(0, 7)}-01`; break; }
    case "custom": if (!from || !to || !validDate(from) || !validDate(to) || from > to || Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * day) throw new Error("Invalid date range"); start = from; end = to; break;
    case "7d": start = addDays(today, -6); end = today; break;
    default: throw new Error("Invalid period");
  }
  return { period: period as RangeKey, from: start, to: end, start: localMidnight(start, timeZone), endExclusive: localMidnight(addDays(end, 1), timeZone) };
}

