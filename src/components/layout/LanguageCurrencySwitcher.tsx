import { Globe, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency, CURRENCIES, CurrencyCode } from "@/contexts/CurrencyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const current = LANGS.find(l => l.code === i18n.language?.split("-")[0]) || LANGS[0];
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <Globe className="w-5 h-5" />
              <span className="text-xs font-semibold hidden md:inline uppercase">{current.code}</span>
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Interface language</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Language</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGS.map(l => (
          <DropdownMenuItem key={l.code} onClick={() => i18n.changeLanguage(l.code)}>
            <span className="mr-2">{l.flag}</span> {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const CurrencySwitcher = () => {
  const { currency, setCurrency } = useCurrency();
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1.5">
              <Coins className="w-5 h-5" />
              <span className="text-xs font-semibold hidden md:inline">{currency.code}</span>
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Display currency (FX rates indicative)</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Display Currency</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CURRENCIES.map(c => (
          <DropdownMenuItem key={c.code} onClick={() => setCurrency(c.code as CurrencyCode)}>
            <span className="font-mono w-8">{c.symbol}</span>
            <span className="flex-1">{c.label}</span>
            <span className="text-xs text-muted-foreground">{c.code}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          1 USD = {currency.rate} {currency.code}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
