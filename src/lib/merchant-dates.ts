// Use the same business timezone and literal text in Node and the browser.
// Intl's localized literals (including AM/PM whitespace) differ between ICU versions.
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Montevideo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  numberingSystem: "latn",
});

const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dateParts(value: string | number) {
  return Object.fromEntries(
    formatter.formatToParts(new Date(value)).map(({ type, value }) => [type, value])
  );
}

export function merchantDateKey(value: string | number): string {
  const { year, month, day } = dateParts(value);
  return `${year}-${month}-${day}`;
}

export function formatMerchantDate(value: string | null, exact = false): string {
  if (!value) return "Sin visitas";
  try {
    const parts = dateParts(value);
    const hour = Number(parts.hour);
    const time = `${String(hour % 12 || 12).padStart(2, "0")}:${parts.minute}${exact ? `:${parts.second}` : ""} ${hour < 12 ? "a. m." : "p. m."}`;
    const month = months[Number(parts.month) - 1];
    return exact
      ? `${parts.day} de ${month} de ${parts.year}, ${time}`
      : `${parts.day}-${month}, ${time}`;
  } catch {
    return value;
  }
}
