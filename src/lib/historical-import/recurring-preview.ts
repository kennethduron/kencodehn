export type RecurringPreviewPeriod = {
  sequence: number;
  dueDate: string;
  amountMinor: string;
  historical: boolean;
};

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Fecha inválida.");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function isoDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function addUtcDays(value: string, days: number) {
  const { year, month, day } = parseDate(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function scheduledDate(
  startDate: string,
  billingDay: number,
  sequence: number,
  frequency: "monthly" | "quarterly" | "yearly",
) {
  if (sequence === 0) return startDate;
  const start = parseDate(startDate);
  const multiplier =
    frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const date = new Date(
    Date.UTC(start.year, start.month - 1 + sequence * multiplier, billingDay),
  );
  return isoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function buildRecurringPreview(input: {
  startDate: string;
  billingDay: number;
  frequency: "monthly" | "quarterly" | "yearly";
  amountMinor: string;
  today: string;
  horizonDays?: number;
}) {
  if (
    !Number.isInteger(input.billingDay) ||
    input.billingDay < 1 ||
    input.billingDay > 28
  )
    throw new Error("Día de cobro inválido.");
  if (!/^[1-9][0-9]{0,15}$/.test(input.amountMinor))
    throw new Error("Monto inválido.");
  parseDate(input.startDate);
  parseDate(input.today);
  const horizonDate = addUtcDays(input.today, input.horizonDays ?? 45);
  const periods: RecurringPreviewPeriod[] = [];
  for (let sequence = 0; sequence <= 120; sequence += 1) {
    const dueDate = scheduledDate(
      input.startDate,
      input.billingDay,
      sequence,
      input.frequency,
    );
    if (dueDate > horizonDate) break;
    periods.push({
      sequence: sequence + 1,
      dueDate,
      amountMinor: input.amountMinor,
      historical: dueDate < input.today,
    });
  }
  return {
    periods,
    totalMinor: (BigInt(input.amountMinor) * BigInt(periods.length)).toString(),
    historicalMinor: (
      BigInt(input.amountMinor) *
      BigInt(periods.filter((item) => item.historical).length)
    ).toString(),
    horizonDate,
  };
}
