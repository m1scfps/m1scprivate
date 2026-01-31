import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { MarketData } from "@/lib/futuresConverter";

export interface PriceAlert {
  id: string;
  ticker: string;
  condition: "above" | "below";
  price: number;
  triggered: boolean;
  createdAt: Date;
}

interface UsePriceAlertsReturn {
  alerts: PriceAlert[];
  addAlert: (ticker: string, condition: "above" | "below", price: number) => void;
  removeAlert: (id: string) => void;
  clearTriggered: () => void;
  checkAlerts: (marketData: MarketData) => void;
  notificationsEnabled: boolean;
  requestNotificationPermission: () => Promise<void>;
}

const TICKER_MAP: Record<string, keyof MarketData> = {
  QQQ: "qqq",
  NQ: "nq",
  NDX: "ndx",
  SPY: "spy",
  ES: "es",
  SPX: "spx",
  GLD: "gld",
  GC: "gc",
};

export function usePriceAlerts(): UsePriceAlertsReturn {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const saved = localStorage.getItem("priceAlerts");
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((a: any) => ({ ...a, createdAt: new Date(a.createdAt) }));
    }
    return [];
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );
  const { toast } = useToast();

  // Save alerts to localStorage
  useEffect(() => {
    localStorage.setItem("priceAlerts", JSON.stringify(alerts));
  }, [alerts]);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") {
      toast({
        title: "Notifications Not Supported",
        description: "Your browser doesn't support notifications.",
        variant: "destructive",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
    
    if (permission === "granted") {
      toast({
        title: "Notifications Enabled",
        description: "You'll receive alerts when prices hit your targets.",
      });
    } else {
      toast({
        title: "Notifications Denied",
        description: "Enable notifications in browser settings for alerts.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const addAlert = useCallback((ticker: string, condition: "above" | "below", price: number) => {
    const newAlert: PriceAlert = {
      id: crypto.randomUUID(),
      ticker,
      condition,
      price,
      triggered: false,
      createdAt: new Date(),
    };
    setAlerts((prev) => [...prev, newAlert]);
    toast({
      title: "Alert Created",
      description: `${ticker} ${condition} ${price.toFixed(2)}`,
    });
  }, [toast]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearTriggered = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => !a.triggered));
  }, []);

  const checkAlerts = useCallback((marketData: MarketData) => {
    setAlerts((prev) => {
      let hasChanges = false;
      const updated = prev.map((alert) => {
        if (alert.triggered) return alert;

        const tickerKey = TICKER_MAP[alert.ticker];
        if (!tickerKey) return alert;

        const currentPrice = marketData[tickerKey] as number;
        if (typeof currentPrice !== "number") return alert;

        const shouldTrigger =
          (alert.condition === "above" && currentPrice >= alert.price) ||
          (alert.condition === "below" && currentPrice <= alert.price);

        if (shouldTrigger) {
          hasChanges = true;
          
          // Show toast
          toast({
            title: `🚨 Price Alert: ${alert.ticker}`,
            description: `${alert.ticker} is now ${alert.condition} ${alert.price.toFixed(2)} (Current: ${currentPrice.toFixed(2)})`,
          });

          // Browser notification
          if (notificationsEnabled && typeof Notification !== "undefined") {
            new Notification(`🚨 ${alert.ticker} Alert`, {
              body: `${alert.ticker} is now ${alert.condition} ${alert.price.toFixed(2)} (Current: ${currentPrice.toFixed(2)})`,
              icon: "/favicon.ico",
            });
          }

          return { ...alert, triggered: true };
        }

        return alert;
      });

      return hasChanges ? updated : prev;
    });
  }, [toast, notificationsEnabled]);

  return {
    alerts,
    addAlert,
    removeAlert,
    clearTriggered,
    checkAlerts,
    notificationsEnabled,
    requestNotificationPermission,
  };
}
