import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "INR" | "AUD" | "CAD" | "AED" | "SGD";

interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  label: string;
  rate: number; // relative to USD
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", symbol: "$", label: "US Dollar", rate: 1 },
  { code: "EUR", symbol: "€", label: "Euro", rate: 0.92 },
  { code: "GBP", symbol: "£", label: "British Pound", rate: 0.79 },
  { code: "INR", symbol: "₹", label: "Indian Rupee", rate: 83.2 },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", rate: 1.52 },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", rate: 1.36 },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", rate: 3.67 },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", rate: 1.34 },
];

interface CurrencyContextValue {
  currency: CurrencyMeta;
  setCurrency: (code: CurrencyCode) => void;
  format: (amountUSD: number, opts?: { compact?: boolean }) => string;
  convert: (amountUSD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [code, setCode] = useState<CurrencyCode>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ff:currency") : null;
    return (stored as CurrencyCode) || "USD";
  });

  useEffect(() => {
    localStorage.setItem("ff:currency", code);
  }, [code]);

  const currency = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];

  const convert = (amountUSD: number) => amountUSD * currency.rate;

  const format = (amountUSD: number, opts?: { compact?: boolean }) => {
    const value = convert(amountUSD);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency.code,
        notation: opts?.compact ? "compact" : "standard",
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency.symbol}${value.toFixed(2)}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency: setCode, format, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
};
