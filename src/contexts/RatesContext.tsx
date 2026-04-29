import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BASE_RATES_FROM_USD, driftRates, type Currency } from "@/lib/currency";

interface RatesContextValue {
  rates: Record<Currency, number>;
  updatedAt: Date;
}

const RatesContext = createContext<RatesContextValue | undefined>(undefined);

export function RatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<Record<Currency, number>>(BASE_RATES_FROM_USD);
  const [updatedAt, setUpdatedAt] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setRates(driftRates(BASE_RATES_FROM_USD));
      setUpdatedAt(new Date());
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return <RatesContext.Provider value={{ rates, updatedAt }}>{children}</RatesContext.Provider>;
}

export function useRates() {
  const ctx = useContext(RatesContext);
  if (!ctx) throw new Error("useRates must be used within RatesProvider");
  return ctx;
}