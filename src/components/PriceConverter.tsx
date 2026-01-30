import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import type { MarketData, MarketParams } from "@/lib/futuresConverter";
import { convert } from "@/lib/futuresConverter";

interface PriceConverterProps {
  tickers: string[];
  defaultFrom: string;
  defaultValue: number;
  marketData: MarketData;
  params: MarketParams;
  varianceTicker?: string;
  variancePoints?: number;
  variant?: "nasdaq" | "sp500";
}

export function PriceConverter({
  tickers,
  defaultFrom,
  defaultValue,
  marketData,
  params,
  varianceTicker,
  variancePoints = 10,
  variant = "nasdaq",
}: PriceConverterProps) {
  const isSP500 = variant === "sp500";
  const [fromTicker, setFromTicker] = useState(defaultFrom);
  const [toTicker, setToTicker] = useState(tickers[tickers.length - 1]);
  const [inputValue, setInputValue] = useState(defaultValue.toString());
  const [result, setResult] = useState<number | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  const handleConvert = () => {
    const value = parseFloat(inputValue);
    if (isNaN(value)) return;

    const converted = convert(value, fromTicker, toTicker, marketData, params);
    if (converted !== null) {
      setResult(converted);
      setRatio(converted / value);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">From</label>
          <Select value={fromTicker} onValueChange={setFromTicker}>
            <SelectTrigger className="border-border/50 bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tickers.map((ticker) => (
                <SelectItem key={ticker} value={ticker}>
                  {ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="border-border/50 bg-secondary/30"
            step="0.01"
          />
        </div>

        <div className="flex h-10 items-center justify-center text-muted-foreground">
          <ArrowRight className="h-5 w-5" />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">To</label>
          <Select value={toTicker} onValueChange={setToTicker}>
            <SelectTrigger className="border-border/50 bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tickers.map((ticker) => (
                <SelectItem key={ticker} value={ticker}>
                  {ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={handleConvert}
        className={`w-full font-bold text-white transition-all hover:scale-[1.02] ${
          isSP500
            ? "bg-gradient-sp500 hover:opacity-90 hover:shadow-[0_4px_20px_hsl(var(--sp-red)/0.4)]"
            : "bg-gradient-primary hover:opacity-90 hover:shadow-[0_4px_20px_hsl(var(--primary)/0.4)]"
        }`}
      >
        Convert
      </Button>

      {result !== null && (
        <div className="space-y-3 rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="text-2xl font-bold text-success">
            Result: {result.toFixed(2)}
          </p>
          {ratio !== null && (
            <p className="text-sm text-muted-foreground">
              Conversion Ratio: {ratio.toFixed(4)}x
            </p>
          )}
          {varianceTicker && toTicker === varianceTicker && (
            <p className="text-sm text-warning">
              Range with ±{variancePoints} point variance:{" "}
              {(result - variancePoints).toFixed(2)} – {(result + variancePoints).toFixed(2)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
