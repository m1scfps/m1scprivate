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
import { ArrowRight, FlaskConical } from "lucide-react";
import type { MarketData, MarketParams } from "@/lib/futuresConverter";
import { convertCrossIndex } from "@/lib/futuresConverter";

interface CrossIndexConverterProps {
  marketData: MarketData;
  params: MarketParams;
}

const CROSS_TICKERS = ["ES", "NQ", "SPX", "NDX"];

export function CrossIndexConverter({ marketData, params }: CrossIndexConverterProps) {
  const [fromTicker, setFromTicker] = useState("ES");
  const [toTicker, setToTicker] = useState("NQ");
  const [inputValue, setInputValue] = useState(marketData.es.toString());
  const [result, setResult] = useState<number | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  const handleConvert = () => {
    const value = parseFloat(inputValue);
    if (isNaN(value)) return;

    const converted = convertCrossIndex(value, fromTicker, toTicker, marketData, params);
    if (converted !== null) {
      setResult(converted);
      setRatio(converted / value);
    }
  };

  // Calculate current market ratios for reference
  const ndxSpxRatio = marketData.ndx / marketData.spx;
  const nqEsRatio = marketData.nq / marketData.es;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3">
        <FlaskConical className="h-5 w-5 text-warning" />
        <div>
          <p className="text-sm font-medium text-warning">BETA Feature</p>
          <p className="text-xs text-muted-foreground">
            Cross-index conversions use current market ratios (NDX/SPX: {ndxSpxRatio.toFixed(4)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">From</label>
          <Select value={fromTicker} onValueChange={setFromTicker}>
            <SelectTrigger className="border-border/50 bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CROSS_TICKERS.map((ticker) => (
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
              {CROSS_TICKERS.map((ticker) => (
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
        className="w-full font-bold text-white transition-all hover:scale-[1.02] bg-gradient-to-r from-primary to-accent hover:opacity-90 hover:shadow-[0_4px_20px_hsl(var(--primary)/0.4)]"
      >
        <FlaskConical className="mr-2 h-4 w-4" />
        Convert (BETA)
      </Button>

      {result !== null && (
        <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-2xl font-bold text-accent">
            Result: {result.toFixed(2)}
          </p>
          {ratio !== null && (
            <p className="text-sm text-muted-foreground">
              Conversion Ratio: {ratio.toFixed(6)}x
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Current NQ/ES ratio: {nqEsRatio.toFixed(4)}
          </p>
        </div>
      )}

      {/* Quick Reference */}
      <div className="rounded-lg bg-secondary/20 p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">📊 Current Market Ratios:</p>
        <div className="grid grid-cols-2 gap-2">
          <span>NDX/SPX: {ndxSpxRatio.toFixed(4)}</span>
          <span>NQ/ES: {nqEsRatio.toFixed(4)}</span>
          <span>SPX: {marketData.spx.toLocaleString()}</span>
          <span>NDX: {marketData.ndx.toLocaleString()}</span>
          <span>ES: {marketData.es.toLocaleString()}</span>
          <span>NQ: {marketData.nq.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
