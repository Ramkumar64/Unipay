export type Currency = "USD" | "INR" | "EUR" | "GBP";
export const CURRENCIES: Currency[] = ["USD", "INR", "EUR", "GBP"];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
};

// Base rates: 1 USD = X
export const BASE_RATES_FROM_USD: Record<Currency, number> = {
  USD: 1,
  INR: 83.2,
  EUR: 0.92,
  GBP: 0.79,
};

/** Get rate for converting `from` -> `to`. */
export function getRate(
  from: Currency,
  to: Currency,
  rates: Record<Currency, number>,
): number {
  if (from === to) return 1;
  // rates are X per 1 USD
  const fromPerUsd = rates[from];
  const toPerUsd = rates[to];
  return toPerUsd / fromPerUsd;
}

export function formatMoney(amount: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "INR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${CURRENCY_SYMBOL[currency]}${amount.toFixed(2)}`;
  }
}

/** Apply ±0.5% drift to base rates. */
export function driftRates(base: Record<Currency, number>): Record<Currency, number> {
  const out = { ...base };
  (Object.keys(out) as Currency[]).forEach((k) => {
    if (k === "USD") return;
    const drift = 1 + (Math.random() - 0.5) * 0.01; // ±0.5%
    out[k] = +(base[k] * drift).toFixed(6);
  });
  return out;
}