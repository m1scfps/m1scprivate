import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParametersSidebar } from "@/components/ParametersSidebar";
import { MarketTab } from "@/components/MarketTab";
import { CheatSheetTab } from "@/components/CheatSheetTab";
import { useMarketData } from "@/hooks/useMarketData";
import { calculatePremiumInfo } from "@/lib/futuresConverter";
import { Loader2 } from "lucide-react";

const Index = () => {
  const {
    marketData,
    params,
    isLoading,
    isRefreshing,
    refreshMarket,
    refreshParams,
    updateParams,
  } = useMarketData();

  const nqPremium = calculatePremiumInfo(marketData.ndx, marketData.nq, "NQ", params);
  const esPremium = calculatePremiumInfo(marketData.spx, marketData.es, "ES", params);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading live market data...</p>
        </div>
      </div>
    );
  }

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
              <TabsList className="mb-6 grid w-full grid-cols-3 bg-secondary/30">
                <TabsTrigger
                  value="nasdaq"
                  className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
                >
                  📈 NASDAQ
                </TabsTrigger>
                <TabsTrigger
                  value="sp500"
                  className="data-[state=active]:bg-gradient-sp500 data-[state=active]:text-white"
                >
                  📊 S&P 500
                </TabsTrigger>
                <TabsTrigger
                  value="cheatsheet"
                  className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
                >
                  📋 Cheat Sheet
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nasdaq">
                <MarketTab
                  type="nasdaq"
                  marketData={marketData}
                  params={params}
                  premium={nqPremium}
                  variant="nasdaq"
                />
              </TabsContent>

              <TabsContent value="sp500">
                <MarketTab
                  type="sp500"
                  marketData={marketData}
                  params={params}
                  premium={esPremium}
                  variant="sp500"
                />
              </TabsContent>

              <TabsContent value="cheatsheet">
                <CheatSheetTab />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column - Sidebar */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <ParametersSidebar
              params={params}
              onParamsChange={updateParams}
              onRefreshMarket={refreshMarket}
              onRefreshParams={refreshParams}
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
