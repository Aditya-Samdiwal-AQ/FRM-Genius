/**
 * English pluralization helpers.
 *
 * Usage: `${n} ${plural(n, "account")} resolved` → "1 account resolved" / "3 accounts resolved"
 */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}
