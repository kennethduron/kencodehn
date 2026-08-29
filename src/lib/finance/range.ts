import { todayInHonduras } from "@/lib/time";
import type { FinancePeriod } from "./types";

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function utc(value: string) { return new Date(`${value}T12:00:00.000Z`); }
function startOfQuarter(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1, 12)); }

export function resolveFinanceRange(input: { period?: string; from?: string; to?: string }, now = new Date()) {
  const today = todayInHonduras(now);
  const current = utc(today);
  const period = (["month", "last_month", "quarter", "year", "custom"].includes(input.period ?? "") ? input.period : "month") as FinancePeriod;
  let from = isoDate(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 12)));
  let to = today;
  if (period === "last_month") {
    const first = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1, 12));
    const last = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0, 12));
    from = isoDate(first); to = isoDate(last);
  } else if (period === "quarter") from = isoDate(startOfQuarter(current));
  else if (period === "year") from = `${current.getUTCFullYear()}-01-01`;
  else if (period === "custom") {
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    if (valid.test(input.from ?? "") && valid.test(input.to ?? "") && String(input.from) <= String(input.to)) {
      from = String(input.from); to = String(input.to);
    }
  }
  return { period, from, to };
}

export const financePeriodLabels: Record<FinancePeriod, string> = {
  month: "Este mes", last_month: "Mes anterior", quarter: "Trimestre", year: "Este ano", custom: "Personalizado",
};
