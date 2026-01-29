import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  type MarketData, 
  type MarketParams, 
  getDefaultMarketData, 
  getDefaultParams,
  getNextQuarterlyExpiration 
} from "@/lib/futuresConverter";
import { useToast } from "@/hooks/use-toast";

interface UseMarketDataReturn {
  marketData: MarketData;
  params: MarketParams;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshMarket: () => Promise<void>;
  refreshParams: () => Promise<void>;
  updateParams: (newParams: MarketParams) => void;
}

export function useMarketData(): UseMarketDataReturn {
  const [marketData, setMarketData] = useState<MarketData>(getDefaultMarketData);
  const [params, setParams] = useState<MarketParams>(getDefaultParams);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    try {
      console.log('Fetching all market data from edge function...');
      
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: {},
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Received data:', data);

      if (data?.marketData) {
        setMarketData({
          ...data.marketData,
          lastUpdate: new Date(data.marketData.lastUpdate),
        });
      }

      if (data?.params) {
        setParams({
          ...data.params,
          lastParamUpdate: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      toast({
        title: "Data Fetch Warning",
        description: "Using cached data. Live feed temporarily unavailable.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const refreshMarket = useCallback(async () => {
    setIsRefreshing(true);
    try {
      console.log('Refreshing market prices...');
      
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: {},
      });

      if (error) throw error;

      if (data?.marketData) {
        setMarketData({
          ...data.marketData,
          lastUpdate: new Date(data.marketData.lastUpdate),
        });
        toast({
          title: "Market Data Updated",
          description: "Live prices refreshed successfully.",
        });
      }
    } catch (error) {
      console.error('Failed to refresh market:', error);
      toast({
        title: "Refresh Failed",
        description: "Could not fetch live prices. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  const refreshParams = useCallback(async () => {
    setIsRefreshing(true);
    try {
      console.log('Refreshing market parameters...');
      
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: {},
      });

      if (error) throw error;

      if (data?.params) {
        setParams({
          ...data.params,
          lastParamUpdate: new Date(),
        });
        toast({
          title: "Parameters Updated",
          description: "Risk-free rate and yields refreshed.",
        });
      }
    } catch (error) {
      console.error('Failed to refresh params:', error);
      toast({
        title: "Refresh Failed",
        description: "Could not fetch parameters. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  const updateParams = useCallback((newParams: MarketParams) => {
    setParams(newParams);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllData().finally(() => setIsLoading(false));
  }, [fetchAllData]);

  // Update expiration days periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const expiration = getNextQuarterlyExpiration();
      if (params.daysToExp !== expiration.days) {
        setParams((prev) => ({
          ...prev,
          daysToExp: expiration.days,
          nextExpiration: expiration.date,
        }));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [params.daysToExp]);

  return {
    marketData,
    params,
    isLoading,
    isRefreshing,
    refreshMarket,
    refreshParams,
    updateParams,
  };
}
