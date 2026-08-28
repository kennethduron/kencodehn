export const HONDURAS_TIME_ZONE = "America/Tegucigalpa";
export const HONDURAS_TIME_ZONE_LABEL = "hora de Honduras";

function parts(value: string) {
  return value.split("-").map((part) => Number(part));
}

function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  );
  return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - instant.getTime();
}

export function zonedDateTimeToIso(date?: string | null, time?: string | null, timeZone = HONDURAS_TIME_ZONE) {
  if (!date) return null;
  const [year, month, day] = parts(date);
  const [hour = 9, minute = 0] = (time || "09:00").split(":").map((part) => Number(part));
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const normalized = new Date(wallClockUtc);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) return null;

  let instant = new Date(wallClockUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = new Date(wallClockUtc - timeZoneOffsetMs(instant, timeZone));
  }
  return instant.toISOString();
}

export function hondurasDateTimeToIso(date?: string | null, time?: string | null) {
  return zonedDateTimeToIso(date, time, HONDURAS_TIME_ZONE);
}

export function todayInHonduras(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HONDURAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysInHonduras(days: number, now = new Date()) {
  const noonUtc = new Date(`${todayInHonduras(now)}T18:00:00.000Z`);
  noonUtc.setUTCDate(noonUtc.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HONDURAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(noonUtc);
}

export function formatHondurasDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatHondurasDateTime(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getHondurasDatePart(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HONDURAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function getHondurasTimePart(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HONDURAS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
