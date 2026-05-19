export const HONDURAS_TIME_ZONE = "America/Tegucigalpa";
export const HONDURAS_TIME_ZONE_LABEL = "hora de Honduras";

const hondurasOffsetHours = 6;

function parts(value: string) {
  return value.split("-").map((part) => Number(part));
}

export function hondurasDateTimeToIso(date?: string | null, time?: string | null) {
  if (!date) return null;
  const [year, month, day] = parts(date);
  const [hour = 9, minute = 0] = (time || "09:00").split(":").map((part) => Number(part));
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return new Date(Date.UTC(year, month - 1, day, hour + hondurasOffsetHours, minute, 0, 0)).toISOString();
}

export function todayInHonduras() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HONDURAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDaysInHonduras(days: number) {
  const noonUtc = new Date(`${todayInHonduras()}T18:00:00.000Z`);
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
