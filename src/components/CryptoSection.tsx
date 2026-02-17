import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Bitcoin,
  ArrowRightLeft,
  Gauge,
  PieChart,
  Wallet,
  Layers,
} from "lucide-react";

interface CryptoAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
}

interface CryptoSector {
  name: string;
  performance24h: number;
  topCoin: string;
}

interface CryptoData {
  timestamp: string;
  btc: CryptoAsset;
  eth: CryptoAsset;
  topAltcoins: CryptoAsset[];
  btcDominance: number;
  ethDominance: number;
  totalMarketCap: number;
  totalVolume24h: number;
  fearGreedIndex: { value: number; label: string };
  sectorRotation: CryptoSector[];
  btcEtfFlow: { signal: string; description: string };
  moneyFlow: {
    direction: string;
    signal: string;
    btcVsAlts: string;
    defiTvlTrend: string;
  };
}

function formatMarketCap(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return `$${num.toLocaleString()}`;
}

function getFearGreedColor(value: number): string {
  if (value <= 25) return 'text-destructive';
  if (value <= 45) return 'text-orange-500';
  if (value <= 55) return 'text-muted-foreground';
  if (value <= 75) return 'text-success';
  return 'text-success';
}

function getFearGreedBg(value: number): string {
  if (value <= 25) return 'bg-destructive/20';
  if (value <= 45) return 'bg-orange-500/20';
  if (value <= 55) return 'bg-secondary/30';
  if (value <= 75) return 'bg-success/20';
  return 'bg-success/20';
}

export function CryptoSection() {
  const [data, setData] = useState<CryptoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCrypto = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('crypto-data', { body: {} });
      if (fnError) throw fnError;
      setData(response);
    } catch (err) {
      console.error('Crypto fetch error:', err);
      setError('Failed to fetch crypto data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCrypto(); }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <Bitcoin className="h-5 w-5 text-orange-500" />
          Crypto Intelligence
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-semibold flex items-center gap-2">
            <Bitcoin className="h-5 w-5 text-orange-500" />
            Crypto Intelligence
          </h3>
          <Button onClick={fetchCrypto} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const ChangeText = ({ value }: { value: number }) => (
    <span className={`font-mono font-bold ${value >= 0 ? 'text-success' : 'text-destructive'}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <Bitcoin className="h-5 w-5 text-orange-500" />
          Crypto Intelligence
        </h3>
        <Button onClick={fetchCrypto} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Fear & Greed + Market Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Fear & Greed Index */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4" />
              Fear & Greed Index
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`rounded-lg p-4 text-center ${getFearGreedBg(data.fearGreedIndex.value)}`}>
              <p className={`text-4xl font-bold ${getFearGreedColor(data.fearGreedIndex.value)}`}>
                {data.fearGreedIndex.value}
              </p>
              <p className="text-sm font-medium mt-1">{data.fearGreedIndex.label}</p>
            </div>
            <div className="h-2 bg-secondary/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${data.fearGreedIndex.value}%`,
                  background: `linear-gradient(90deg, hsl(var(--destructive)), hsl(45 100% 50%), hsl(var(--success)))`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Extreme Fear</span>
              <span>Extreme Greed</span>
            </div>
          </CardContent>
        </Card>

        {/* Market Overview */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4" />
              Market Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Market Cap</span>
              <span className="font-mono font-bold">{formatMarketCap(data.totalMarketCap)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">24h Volume</span>
              <span className="font-mono">{formatMarketCap(data.totalVolume24h)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">BTC Dominance</span>
              <span className="font-mono font-bold">{data.btcDominance.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ETH Dominance</span>
              <span className="font-mono">{data.ethDominance.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Alt Season</span>
              <Badge variant={data.btcDominance < 50 ? 'default' : 'secondary'}>
                {data.btcDominance < 45 ? 'YES' : data.btcDominance < 50 ? 'EMERGING' : 'NO'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BTC & ETH */}
      <div className="grid gap-4 md:grid-cols-2">
        {[data.btc, data.eth].map((coin) => (
          <Card key={coin.symbol} className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                <span>{coin.name} ({coin.symbol})</span>
                <span className="text-lg font-bold text-foreground">${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">24h</span>
                  <p><ChangeText value={coin.change24h} /></p>
                </div>
                <div>
                  <span className="text-muted-foreground">7d</span>
                  <p><ChangeText value={coin.change7d} /></p>
                </div>
                <div>
                  <span className="text-muted-foreground">MCap</span>
                  <p className="font-mono text-xs">{formatMarketCap(coin.marketCap)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Money Flow & ETF */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowRightLeft className="h-4 w-4" />
              Money Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-secondary/30 p-3">
              <p className="text-sm font-bold">{data.moneyFlow.signal}</p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Direction</span>
              <Badge variant={data.moneyFlow.direction === 'RISK-ON' ? 'default' : 
                             data.moneyFlow.direction.includes('OFF') || data.moneyFlow.direction.includes('SELLING') ? 'destructive' : 'secondary'}>
                {data.moneyFlow.direction}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">BTC vs Alts</span>
              <Badge variant="outline">{data.moneyFlow.btcVsAlts}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">DeFi TVL Trend</span>
              <Badge variant={data.moneyFlow.defiTvlTrend === 'GROWING' ? 'default' : 
                             data.moneyFlow.defiTvlTrend === 'DECLINING' ? 'destructive' : 'secondary'}>
                {data.moneyFlow.defiTvlTrend}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4" />
              BTC ETF Flow Signal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {data.btcEtfFlow.signal.includes('INFLOW') ? (
                <TrendingUp className="h-6 w-6 text-success" />
              ) : data.btcEtfFlow.signal.includes('OUTFLOW') ? (
                <TrendingDown className="h-6 w-6 text-destructive" />
              ) : (
                <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
              )}
              <Badge variant={data.btcEtfFlow.signal.includes('INFLOW') ? 'default' : 
                             data.btcEtfFlow.signal.includes('OUTFLOW') ? 'destructive' : 'secondary'}
                     className="text-base px-3 py-1">
                {data.btcEtfFlow.signal}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.btcEtfFlow.description}</p>
            <p className="text-xs text-muted-foreground italic">
              Estimated from BTC price action & volume patterns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Crypto Sector Rotation */}
      {data.sectorRotation.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieChart className="h-4 w-4" />
              Crypto Sector Rotation (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.sectorRotation.map((sector) => (
              <div key={sector.name} className="flex items-center gap-3">
                <span className="text-sm w-20 font-medium">{sector.name}</span>
                <div className="flex-1 h-2 bg-secondary/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${sector.performance24h >= 0 ? 'bg-success' : 'bg-destructive'}`}
                    style={{ width: `${Math.min(Math.abs(sector.performance24h) * 10, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-16 text-right ${sector.performance24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {sector.performance24h >= 0 ? '+' : ''}{sector.performance24h.toFixed(2)}%
                </span>
                <span className="text-xs text-muted-foreground w-28 text-right truncate">{sector.topCoin}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Altcoins */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Altcoins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground pb-1 border-b border-border/50">
              <span>Coin</span>
              <span className="text-right">Price</span>
              <span className="text-right">24h</span>
              <span className="text-right">7d</span>
              <span className="text-right">MCap</span>
            </div>
            {data.topAltcoins.slice(0, 8).map((coin) => (
              <div key={coin.symbol} className="grid grid-cols-5 gap-2 text-sm py-1">
                <span className="font-medium truncate">{coin.symbol}</span>
                <span className="text-right font-mono text-xs">${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className={`text-right font-mono text-xs ${coin.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
                </span>
                <span className={`text-right font-mono text-xs ${coin.change7d >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {coin.change7d >= 0 ? '+' : ''}{coin.change7d.toFixed(1)}%
                </span>
                <span className="text-right font-mono text-xs">{formatMarketCap(coin.marketCap)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
