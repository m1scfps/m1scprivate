import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Zap,
  AlertTriangle,
  Search,
} from "lucide-react";

interface GammaExposure {
  regime: string;
  netGEX: number;
  dealerPosition: string;
  flipPoint: number;
  keyLevels: { strike: number; gex: number }[];
}

interface FlowSentiment {
  direction: string;
  score: number;
  signals: string[];
}

interface UnusualActivity {
  strike: number;
  type: string;
  volume: number;
  openInterest: number;
  ratio: number;
  sentiment: string;
}

interface OptionsData {
  ticker: string;
  spotPrice: number;
  putCallRatio: number;
  putCallOIRatio: number;
  maxPain: number;
  totalCallVolume: number;
  totalPutVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  avgCallIV: number;
  avgPutIV: number;
  ivSkew: number;
  gammaExposure: GammaExposure;
  flowSentiment: FlowSentiment;
  unusualActivity: UnusualActivity[];
  topStrikes: {
    calls: { strike: number; volume: number; oi: number }[];
    puts: { strike: number; volume: number; oi: number }[];
  };
  expirations: string[];
  lastUpdate: string;
}

const QUICK_TICKERS = ["SPY", "QQQ", "SPX", "NDX", "IWM", "AAPL", "TSLA", "NVDA"];

export function OptionsTab() {
  const [ticker, setTicker] = useState("SPY");
  const [data, setData] = useState<OptionsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async (t?: string) => {
    const target = t || ticker;
    if (!target.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("options-data", {
        body: { ticker: target.trim().toUpperCase() },
      });
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result);
      setTicker(target.trim().toUpperCase());
    } catch (e: any) {
      setError(e.message || "Failed to fetch options data");
    } finally {
      setIsLoading(false);
    }
  }, [ticker]);

  const getSentimentColor = (direction: string) => {
    if (direction.includes("BULLISH")) return "text-success";
    if (direction.includes("BEARISH")) return "text-destructive";
    return "text-muted-foreground";
  };

  const getSentimentBadge = (direction: string) => {
    if (direction.includes("STRONG BULLISH")) return <Badge className="bg-success/20 text-success border-success/30">Strong Bullish</Badge>;
    if (direction.includes("BULLISH")) return <Badge className="bg-success/20 text-success border-success/30">Bullish</Badge>;
    if (direction.includes("STRONG BEARISH")) return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Strong Bearish</Badge>;
    if (direction.includes("BEARISH")) return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Bearish</Badge>;
    return <Badge variant="secondary">Neutral</Badge>;
  };

  const getGammaRegimeBadge = (regime: string) => {
    if (regime === "POSITIVE_GAMMA") return <Badge className="bg-success/20 text-success border-success/30">Positive Gamma</Badge>;
    if (regime === "NEGATIVE_GAMMA") return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Negative Gamma</Badge>;
    return <Badge variant="secondary">Neutral</Badge>;
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // GEX chart data
  const gexChartData = data?.gammaExposure.keyLevels
    .sort((a, b) => a.strike - b.strike)
    .map((l) => ({
      strike: l.strike,
      gex: Math.round(l.gex / 1000),
    })) || [];

  return (
    <div className="space-y-6">
      {/* Ticker Input */}
      <Card className="border-border/50 bg-gradient-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Enter ticker (SPY, QQQ, AAPL...)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && fetchOptions()}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => fetchOptions()} disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Analyze"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TICKERS.map((t) => (
                <Button
                  key={t}
                  variant={ticker === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTicker(t);
                    fetchOptions(t);
                  }}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-gradient-card">
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Analysis Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => fetchOptions()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">{data.ticker}</h2>
              <span className="text-xl font-semibold text-muted-foreground">${data.spotPrice.toFixed(2)}</span>
              {getSentimentBadge(data.flowSentiment.direction)}
            </div>
            <p className="text-xs text-muted-foreground">
              Updated: {new Date(data.lastUpdate).toLocaleTimeString()}
            </p>
          </div>

          {/* Flow Sentiment */}
          <Card className="border-border/50 bg-gradient-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Options Flow Sentiment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                {data.flowSentiment.direction.includes("BULLISH") ? (
                  <TrendingUp className="h-8 w-8 text-success" />
                ) : data.flowSentiment.direction.includes("BEARISH") ? (
                  <TrendingDown className="h-8 w-8 text-destructive" />
                ) : (
                  <Target className="h-8 w-8 text-muted-foreground" />
                )}
                <div>
                  <p className={`text-xl font-bold ${getSentimentColor(data.flowSentiment.direction)}`}>
                    {data.flowSentiment.direction}
                  </p>
                  <p className="text-sm text-muted-foreground">Score: {data.flowSentiment.score}</p>
                </div>
              </div>
              <div className="space-y-2">
                {data.flowSentiment.signals.map((signal, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-muted-foreground">•</span>
                    <span className="text-foreground/80">{signal}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 bg-gradient-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Put/Call Ratio (Vol)</p>
                <p className={`text-2xl font-bold ${data.putCallRatio < 0.7 ? 'text-success' : data.putCallRatio > 1.2 ? 'text-destructive' : 'text-foreground'}`}>
                  {data.putCallRatio.toFixed(3)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  OI Ratio: {data.putCallOIRatio.toFixed(3)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-gradient-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Max Pain</p>
                <p className="text-2xl font-bold text-foreground">${data.maxPain.toFixed(0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.maxPain > data.spotPrice ? "Above" : "Below"} spot by {Math.abs(((data.maxPain - data.spotPrice) / data.spotPrice) * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-gradient-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Avg Call IV</p>
                <p className="text-2xl font-bold text-foreground">{data.avgCallIV.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Put IV: {data.avgPutIV.toFixed(1)}% | Skew: {data.ivSkew > 0 ? "+" : ""}{data.ivSkew.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-gradient-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(data.totalCallVolume + data.totalPutVolume)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calls: {formatNumber(data.totalCallVolume)} | Puts: {formatNumber(data.totalPutVolume)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gamma Exposure + OI */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Gamma */}
            <Card className="border-border/50 bg-gradient-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-primary" />
                  Gamma Exposure (GEX)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-3">
                  {getGammaRegimeBadge(data.gammaExposure.regime)}
                  <span className="text-sm text-muted-foreground">
                    Net GEX: {formatNumber(data.gammaExposure.netGEX)}
                  </span>
                </div>
                <p className="mb-4 text-sm text-foreground/80">{data.gammaExposure.dealerPosition}</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Gamma Flip: <span className="font-medium text-foreground">${data.gammaExposure.flipPoint.toFixed(0)}</span>
                </p>

                {gexChartData.length > 0 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gexChartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                        <XAxis dataKey="strike" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value}K`, 'GEX']}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                        <Bar dataKey="gex" radius={[4, 4, 0, 0]}>
                          {gexChartData.map((entry, index) => (
                            <Cell key={index} fill={entry.gex >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Strikes */}
            <Card className="border-border/50 bg-gradient-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-primary" />
                  Top Strikes by Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-success">Calls</p>
                    <div className="space-y-1.5">
                      {data.topStrikes.calls.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">${s.strike}</span>
                          <span className="text-muted-foreground">Vol: {formatNumber(s.volume)} | OI: {formatNumber(s.oi)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-destructive">Puts</p>
                    <div className="space-y-1.5">
                      {data.topStrikes.puts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">${s.strike}</span>
                          <span className="text-muted-foreground">Vol: {formatNumber(s.volume)} | OI: {formatNumber(s.oi)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Open Interest summary */}
                <div className="mt-4 rounded-lg border border-border/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Open Interest</p>
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="text-success">Calls:</span>{" "}
                      <span className="font-medium text-foreground">{formatNumber(data.totalCallOI)}</span>
                    </div>
                    <div>
                      <span className="text-destructive">Puts:</span>{" "}
                      <span className="font-medium text-foreground">{formatNumber(data.totalPutOI)}</span>
                    </div>
                  </div>
                  {/* Visual bar */}
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-success"
                      style={{
                        width: `${(data.totalCallOI / (data.totalCallOI + data.totalPutOI)) * 100}%`,
                      }}
                    />
                    <div className="flex-1 bg-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Unusual Activity */}
          {data.unusualActivity.length > 0 && (
            <Card className="border-border/50 bg-gradient-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Unusual Options Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Strike</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Volume</TableHead>
                        <TableHead className="text-xs">OI</TableHead>
                        <TableHead className="text-xs">Vol/OI</TableHead>
                        <TableHead className="text-xs">Signal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.unusualActivity.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">${item.strike}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={item.type === "CALL" ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}
                            >
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatNumber(item.volume)}</TableCell>
                          <TableCell>{formatNumber(item.openInterest)}</TableCell>
                          <TableCell className="font-bold">{item.ratio}x</TableCell>
                          <TableCell>
                            <Badge className={item.sentiment === "BULLISH" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}>
                              {item.sentiment}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <p className="text-center text-xs text-muted-foreground">
            Options data may be delayed up to 15 minutes. Not financial advice. GEX is estimated from public OI data.
          </p>
        </>
      )}

      {/* Initial state */}
      {!data && !isLoading && !error && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50" />
          <div>
            <p className="text-lg font-medium text-foreground">Select a ticker to analyze</p>
            <p className="text-sm text-muted-foreground">Choose from the quick buttons above or type any options-eligible ticker</p>
          </div>
        </div>
      )}
    </div>
  );
}
