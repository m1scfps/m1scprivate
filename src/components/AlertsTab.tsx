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
import { Bell, BellOff, Trash2, Plus, CheckCircle2 } from "lucide-react";
import type { PriceAlert } from "@/hooks/usePriceAlerts";
import type { MarketData } from "@/lib/futuresConverter";

interface AlertsTabProps {
  alerts: PriceAlert[];
  onAddAlert: (ticker: string, condition: "above" | "below", price: number) => void;
  onRemoveAlert: (id: string) => void;
  onClearTriggered: () => void;
  notificationsEnabled: boolean;
  onRequestNotifications: () => void;
  marketData: MarketData;
}

const TICKERS = ["QQQ", "NQ", "NDX", "SPY", "ES", "SPX", "GLD", "GC"];

export function AlertsTab({
  alerts,
  onAddAlert,
  onRemoveAlert,
  onClearTriggered,
  notificationsEnabled,
  onRequestNotifications,
  marketData,
}: AlertsTabProps) {
  const [ticker, setTicker] = useState("QQQ");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");

  const handleAddAlert = () => {
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) return;
    onAddAlert(ticker, condition, priceValue);
    setPrice("");
  };

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div className="space-y-6">
      {/* Current Market Data */}
      <div className="rounded-xl border border-border/50 bg-gradient-card p-6 backdrop-blur-sm">
        <h3 className="mb-4 text-lg font-semibold text-foreground">📊 Current Market Prices</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "QQQ", value: marketData.qqq, prefix: "$" },
            { label: "NQ", value: marketData.nq },
            { label: "SPY", value: marketData.spy, prefix: "$" },
            { label: "ES", value: marketData.es },
            { label: "NDX", value: marketData.ndx },
            { label: "SPX", value: marketData.spx },
            { label: "GLD", value: marketData.gld, prefix: "$", isGold: true },
            { label: "GC", value: marketData.gc, prefix: "$", isGold: true },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-lg p-3 text-center ${
                item.isGold ? "bg-gold/10 border border-gold/30" : "bg-secondary/30"
              }`}
            >
              <p className={`text-xs font-medium ${item.isGold ? "text-gold" : "text-muted-foreground"}`}>
                {item.label}
              </p>
              <p className={`text-lg font-bold ${item.isGold ? "text-gold" : "text-foreground"}`}>
                {item.prefix}{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border/50 bg-gradient-card p-6 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
              <Bell className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Price Alerts</h2>
              <p className="text-sm text-muted-foreground">
                Get notified when prices hit your targets
              </p>
            </div>
          </div>
          <Button
            variant={notificationsEnabled ? "secondary" : "default"}
            size="sm"
            onClick={onRequestNotifications}
            className={notificationsEnabled ? "" : "bg-gradient-primary"}
          >
            {notificationsEnabled ? (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Enabled
              </>
            ) : (
              <>
                <BellOff className="mr-2 h-4 w-4" />
                Enable Notifications
              </>
            )}
          </Button>
        </div>

        {/* Add Alert Form */}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={ticker} onValueChange={setTicker}>
            <SelectTrigger className="border-border/50 bg-secondary/30">
              <SelectValue placeholder="Ticker" />
            </SelectTrigger>
            <SelectContent>
              {TICKERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={condition} onValueChange={(v) => setCondition(v as "above" | "below")}>
            <SelectTrigger className="border-border/50 bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="above">Goes Above</SelectItem>
              <SelectItem value="below">Goes Below</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border-border/50 bg-secondary/30"
            step="0.01"
          />

          <Button onClick={handleAddAlert} className="bg-gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="rounded-xl border border-border/50 bg-gradient-card p-6 backdrop-blur-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-success"></span>
          </span>
          Active Alerts ({activeAlerts.length})
        </h3>

        {activeAlerts.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No active alerts. Add one above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-primary">{alert.ticker}</span>
                  <span className="text-muted-foreground">
                    {alert.condition === "above" ? "≥" : "≤"}
                  </span>
                  <span className="font-medium">{alert.price.toFixed(2)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAlert(alert.id)}
                  className="text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-success">
              <CheckCircle2 className="h-5 w-5" />
              Triggered ({triggeredAlerts.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={onClearTriggered}>
              Clear All
            </Button>
          </div>

          <div className="space-y-2">
            {triggeredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg bg-success/20 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-success">{alert.ticker}</span>
                  <span className="text-muted-foreground">
                    {alert.condition === "above" ? "≥" : "≤"}
                  </span>
                  <span className="font-medium">{alert.price.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">✓ Triggered</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAlert(alert.id)}
                  className="text-muted-foreground hover:bg-secondary/30"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tip:</strong> Alerts check prices on each auto-refresh (every 15 seconds when enabled).
          Enable browser notifications to get alerts even when the tab is in the background.
        </p>
      </div>
    </div>
  );
}
