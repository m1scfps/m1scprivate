import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RefreshCw, Settings, ChevronDown } from "lucide-react";
import type { MarketParams } from "@/lib/futuresConverter";

interface ParametersSidebarProps {
  params: MarketParams;
  onParamsChange: (params: MarketParams) => void;
  onRefreshMarket: () => void;
  onRefreshParams: () => void;
  isRefreshing?: boolean;
}

export function ParametersSidebar({
  params,
  onParamsChange,
  onRefreshMarket,
  onRefreshParams,
  isRefreshing = false,
}: ParametersSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-6 rounded-xl border border-border/50 bg-gradient-card p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Settings className="h-5 w-5 text-primary" />
        <span>Settings & Controls</span>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onRefreshMarket}
          variant="secondary"
          size="sm"
          className="flex-1"
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Market
        </Button>
        <Button
          onClick={onRefreshParams}
          variant="secondary"
          size="sm"
          className="flex-1"
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Params
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          📈 Market Parameters
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">Risk Free Rate</p>
            <p className="text-lg font-semibold">{params.riskFreeRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">NDX Div Yield</p>
            <p className="text-lg font-semibold">{params.ndxDivYield.toFixed(2)}%</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">SPX Div Yield</p>
            <p className="text-lg font-semibold">{params.spxDivYield.toFixed(2)}%</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">Days to Exp</p>
            <p className="text-lg font-semibold">{params.daysToExp}</p>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">Next Expiration</p>
          <p className="font-semibold">{params.nextExpiration}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Last updated: {formatTime(params.lastParamUpdate)}
        </p>
      </div>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Settings
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="riskFreeRate" className="text-xs">
              Risk Free Rate (%)
            </Label>
            <Input
              id="riskFreeRate"
              type="number"
              step="0.1"
              min="0"
              max="20"
              value={params.riskFreeRate}
              onChange={(e) =>
                onParamsChange({
                  ...params,
                  riskFreeRate: parseFloat(e.target.value) || 0,
                })
              }
              className="border-border/50 bg-secondary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ndxDivYield" className="text-xs">
              NDX Dividend Yield (%)
            </Label>
            <Input
              id="ndxDivYield"
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={params.ndxDivYield}
              onChange={(e) =>
                onParamsChange({
                  ...params,
                  ndxDivYield: parseFloat(e.target.value) || 0,
                })
              }
              className="border-border/50 bg-secondary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spxDivYield" className="text-xs">
              SPX Dividend Yield (%)
            </Label>
            <Input
              id="spxDivYield"
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={params.spxDivYield}
              onChange={(e) =>
                onParamsChange({
                  ...params,
                  spxDivYield: parseFloat(e.target.value) || 0,
                })
              }
              className="border-border/50 bg-secondary/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="daysToExp" className="text-xs">
              Days to Expiration
            </Label>
            <Input
              id="daysToExp"
              type="number"
              step="1"
              min="1"
              max="365"
              value={params.daysToExp}
              onChange={(e) =>
                onParamsChange({
                  ...params,
                  daysToExp: parseInt(e.target.value) || 1,
                })
              }
              className="border-border/50 bg-secondary/30"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
