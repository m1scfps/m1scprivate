import { MetricCard } from "./MetricCard";
import { PremiumCard } from "./PremiumCard";
import { RatioCard } from "./RatioCard";
import { PriceConverter } from "./PriceConverter";
import type { MarketData, MarketParams, PremiumInfo } from "@/lib/futuresConverter";

interface MarketTabProps {
  type: "nasdaq" | "sp500";
  marketData: MarketData;
  params: MarketParams;
  premium: PremiumInfo;
}

export function MarketTab({ type, marketData, params, premium }: MarketTabProps) {
  const isNasdaq = type === "nasdaq";

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
    : [
        { label: "SPY", value: marketData.spy.toFixed(2), prefix: "$" },
        { label: "SPX", value: marketData.spx.toLocaleString() },
        { label: "ES", value: marketData.es.toLocaleString() },
      ];

  const ratios = isNasdaq
    ? [
        { label: "QQQ → NQ", value: marketData.nq / marketData.qqq },
        { label: "NDX → NQ", value: marketData.nq / marketData.ndx },
      ]
    : [
        { label: "SPY → ES", value: marketData.es / marketData.spy },
        { label: "SPX → ES", value: marketData.es / marketData.spx },
      ];

  const tickers = isNasdaq ? ["QQQ", "NDX", "NQ"] : ["SPY", "SPX", "ES"];
  const defaultFrom = isNasdaq ? "QQQ" : "SPY";
  const defaultValue = isNasdaq ? 629.0 : 595.0;
  const varianceTicker = isNasdaq ? "NQ" : "ES";
  const variancePoints = isNasdaq ? 10 : 10 * (marketData.es / marketData.nq);

  return (
    <div className="space-y-6">
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
          title={`🎯 ${isNasdaq ? "NQ" : "ES"} Futures Premium (Theoretical)`}
          formula={`${isNasdaq ? "NDX" : "SPX"} × e^((r-d)×t)`}
          premium={premium}
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
        />
      </div>
    </div>
  );
}
