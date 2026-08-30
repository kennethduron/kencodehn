const DECIMAL_MONEY = /^([0-9]{1,13})(?:\.([0-9]{1,2}))?$/;
const MINOR_MONEY = /^(0|[1-9][0-9]{0,15})$/;

export function parseMoneyToMinor(value: string): bigint {
  const match = DECIMAL_MONEY.exec(value.trim());
  if (!match) throw new Error("Monto inválido. Use máximo dos decimales.");
  return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function parseMinor(value: string | number | bigint): bigint {
  const normalized = typeof value === "bigint" ? value.toString() : String(value);
  if (!MINOR_MONEY.test(normalized)) throw new Error("Unidades menores inválidas.");
  return BigInt(normalized);
}

export function addMinor(values: Array<string | number | bigint>): bigint {
  return values.reduce<bigint>((total, value) => total + parseMinor(value), BigInt(0));
}

export function formatMinor(value: string | number | bigint, currency: string, locale = "es-HN") {
  const minor = parseMinor(value);
  const whole = minor / BigInt(100);
  const cents = (minor % BigInt(100)).toString().padStart(2, "0");
  const normalizedCurrency = currency.toUpperCase();
  const grouped = new Intl.NumberFormat(normalizedCurrency === "USD" ? "en-US" : locale, { maximumFractionDigits: 0 }).format(whole);
  return normalizedCurrency === "USD" ? `$${grouped}.${cents}` : `${normalizedCurrency} ${grouped}.${cents}`;
}

export function minorToDecimalInput(value: string | number | bigint) {
  const minor = parseMinor(value);
  return `${minor / BigInt(100)}.${(minor % BigInt(100)).toString().padStart(2, "0")}`;
}

export function formatSignedMinor(value: bigint, currency: string, locale = "es-HN") {
  const negative = value < BigInt(0);
  return `${negative ? "-" : ""}${formatMinor(negative ? -value : value, currency, locale)}`;
}

export function compareMinor(left: string | number | bigint, right: string | number | bigint) {
  const a = parseMinor(left);
  const b = parseMinor(right);
  return a === b ? 0 : a < b ? -1 : 1;
}
