import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParametersSidebar } from "@/components/ParametersSidebar";
import { MarketTab } from "@/components/MarketTab";
import {
  getDefaultMarketData,
  getDefaultParams,
  getNextQuarterlyExpiration,
  calculatePremiumInfo,
  type MarketData,
  type MarketParams,
} from "@/lib/futuresConverter";

const Index = () => {
  const [marketData, setMarketData] = useState<MarketData>(getDefaultMarketData);
  const [params, setParams] = useState<MarketParams>(getDefaultParams);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simulate market data refresh (in real app, this would fetch from an API)
  const handleRefreshMarket = () => {
    setIsRefreshing(true);
    // Simulate a small random price movement
    setTimeout(() => {
      setMarketData((prev) => ({
        ...prev,
        qqq: prev.qqq + (Math.random() - 0.5) * 2,
        nq: prev.nq + (Math.random() - 0.5) * 20,
        ndx: prev.ndx + (Math.random() - 0.5) * 20,
        spy: prev.spy + (Math.random() - 0.5) * 2,
        es: prev.es + (Math.random() - 0.5) * 10,
        spx: prev.spx + (Math.random() - 0.5) * 10,
        lastUpdate: new Date(),
      }));
      setIsRefreshing(false);
    }, 500);
  };

  const handleRefreshParams = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      const expiration = getNextQuarterlyExpiration();
      setParams((prev) => ({
        ...prev,
        daysToExp: expiration.days,
        nextExpiration: expiration.date,
        lastParamUpdate: new Date(),
      }));
      setIsRefreshing(false);
    }, 500);
  };

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
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [params.daysToExp]);

  const nqPremium = calculatePremiumInfo(marketData.ndx, marketData.nq, "NQ", params);
  const esPremium = calculatePremiumInfo(marketData.spx, marketData.es, "ES", params);

  return (
    <div className="min-h-screen bg-gradient-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="mb-2 bg-gradient-primary bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            📊 Futures Price Converter
          </h1>
          <p className="text-muted-foreground">
            <span className="font-semibold">Real-time calibrated conversions</span> by m1scfx
          </p>
        </header>

        {/* Main content */}
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left column - Tabs */}
          <div>
            <Tabs defaultValue="nasdaq" className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-2 bg-secondary/30">
                <TabsTrigger
                  value="nasdaq"
                  className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
                >
                  📈 NASDAQ (QQQ/NQ/NDX)
                </TabsTrigger>
                <TabsTrigger
                  value="sp500"
                  className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
                >
                  📊 S&P 500 (SPY/ES/SPX)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nasdaq">
                <MarketTab
                  type="nasdaq"
                  marketData={marketData}
                  params={params}
                  premium={nqPremium}
                />
              </TabsContent>

              <TabsContent value="sp500">
                <MarketTab
                  type="sp500"
                  marketData={marketData}
                  params={params}
                  premium={esPremium}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column - Sidebar */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <ParametersSidebar
              params={params}
              onParamsChange={setParams}
              onRefreshMarket={handleRefreshMarket}
              onRefreshParams={handleRefreshParams}
              isRefreshing={isRefreshing}
            />
          </aside>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-border/30 pt-6 text-center text-sm text-muted-foreground">
          <p>© 2026 m1scfx. All rights reserved.</p>
          <p className="mt-1">Discord: m1scfx</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
