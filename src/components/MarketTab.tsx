import { forwardRef } from "react";
import { MetricCard } from "./MetricCard";
import { PremiumCard } from "./PremiumCard";
import { RatioCard } from "./RatioCard";
import { PriceConverter } from "./PriceConverter";
import type { MarketData, MarketParams, PremiumInfo } from "@/lib/futuresConverter";

interface MarketTabProps {
  type: "nasdaq" | "sp500" | "gold";
  marketData: MarketData;
  params: MarketParams;
  premium: PremiumInfo;
  variant?: "nasdaq" | "sp500" | "gold";
}

export const MarketTab = forwardRef<HTMLDivElement, MarketTabProps>(
  ({ type, marketData, params, premium, variant = "nasdaq" }, ref) => {
    const isNasdaq = type === "nasdaq";
    const isSP500 = type === "sp500";
    const isGold = type === "gold";

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };

    const metrics = isNasdaq
      ? [
          { label: "QQQ", value: marketData.qqq.toFixed(2), prefix: "$" },
          { label: "NDX", value: marketData.ndx.toLocaleString() },
          { label: "NQ", value: marketData.nq.toLocaleString() },
        ]
      : isSP500
      ? [
          { label: "SPY", value: marketData.spy.toFixed(2), prefix: "$" },
          { label: "SPX", value: marketData.spx.toLocaleString() },
          { label: "ES", value: marketData.es.toLocaleString() },
        ]
      : [
          { label: "GLD", value: marketData.gld.toFixed(2), prefix: "$" },
          { label: "Gold Spot", value: (marketData.gc * 0.996).toFixed(2), prefix: "$" },
          { label: "GC", value: marketData.gc.toFixed(2), prefix: "$" },
        ];

    const ratios = isNasdaq
      ? [
          { label: "QQQ → NQ", value: marketData.nq / marketData.qqq },
          { label: "NDX → NQ", value: marketData.nq / marketData.ndx },
        ]
      : isSP500
      ? [
          { label: "SPY → ES", value: marketData.es / marketData.spy },
          { label: "SPX → ES", value: marketData.es / marketData.spx },
        ]
      : [
          { label: "GLD → GC", value: marketData.gc / marketData.gld },
          { label: "GC × 100 oz", value: marketData.gc * 100 },
        ];

    const tickers = isNasdaq ? ["QQQ", "NDX", "NQ"] : isSP500 ? ["SPY", "SPX", "ES"] : ["GLD", "GC"];
    const defaultFrom = isNasdaq ? "QQQ" : isSP500 ? "SPY" : "GLD";
    const defaultValue = isNasdaq ? 629.0 : isSP500 ? 595.0 : 305.0;
    const varianceTicker = isNasdaq ? "NQ" : isSP500 ? "ES" : "GC";
    const variancePoints = isNasdaq ? 10 : isSP500 ? 10 * (marketData.es / marketData.nq) : 10;

    return (
      <div ref={ref} className="space-y-6">
        {/* Current Market Data */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Current Market Data</h2>
          <div className="grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                prefix={metric.prefix}
              />
            ))}
          </div>
          <p className="mt-2 text-right text-xs text-muted-foreground">
            Last update: {formatTime(marketData.lastUpdate)}
          </p>
        </div>

        {/* Premium and Ratios */}
        <div className="grid gap-4 md:grid-cols-2">
          <PremiumCard
            title={`🎯 ${isNasdaq ? "NQ" : isSP500 ? "ES" : "GC"} Futures Premium (Theoretical)`}
            formula={isGold ? "Gold Spot × e^(r×t)" : `${isNasdaq ? "NDX" : "SPX"} × e^((r-d)×t)`}
            premium={premium}
            variant={variant}
          />
          <RatioCard ratios={ratios} />
        </div>

        {/* Price Converter */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">💱 Price Converter</h2>
          <PriceConverter
            tickers={tickers}
            defaultFrom={defaultFrom}
            defaultValue={defaultValue}
            marketData={marketData}
            params={params}
            varianceTicker={varianceTicker}
            variancePoints={variancePoints}
            variant={variant}
          />
        </div>

      </div>
    );
  }
);

MarketTab.displayName = "MarketTab";
