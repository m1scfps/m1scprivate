import { useState, useEffect } from "react";
import { CryptoSection } from "@/components/CryptoSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  RefreshCw, 
  AlertTriangle,
  Calendar,
  BarChart3,
  Activity,
  Zap,
  Clock,
  Target,
  Thermometer,
  PieChart
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface OptionsFlowData {
  positioning: string;
  bias: number;
  vixVsAverage: number;
  vixLevel: number;
  gammaRegime: string;
  gammaImpact: string;
  gammaSupport: number;
  gammaResistance: number;
  keyResistance: number;
  keySupport: number;
}

interface VolatilityData {
  vixCurrent: number;
  vix20dAvg: number;
  vixChange1d: number;
  vixChange5d: number;
  vixTrend: string;
  vixSignal: string;
  vixHistory: Array<{ date: string; value: number }>;
  nqVolatility: number;
  esVolatility: number;
  volatilityRegime: string;
}

interface SectorRotation {
  strongestSector: string;
  weakestSector: string;
  techMomentum: number;
  sectorStrength: Record<string, number>;
}

interface EconomicEvent {
  date: string;
  event: string;
  importance: string;
  consensus: string;
  previous: string;
  daysUntil: number;
}

interface PredictionData {
  timestamp: string;
  currentPrice: number;
  premarket: {
    currentPrice: number;
    prevClose: number;
    premarketChange: number;
  } | null;
  optionsFlow: OptionsFlowData;
  volatility: VolatilityData;
  marketBreadth: {
    vixRegime: string;
    marketSentiment: string;
    internalsScore: number;
    nqSpyCorrelation: number;
    advanceDecline: number;
    newHighsLows: number;
    breadthThrust: string;
  };
  sectorRotation: SectorRotation | null;
  economicEvents: EconomicEvent[];
  newsPrediction: {
    newsType: string;
    outcome: string;
    score: number;
    signals: string[];
  };
  openPrediction: {
    direction: string;
    confidence: string;
    score: number;
    signals: string[];
    strategy: string;
  };
}

export function PredictionTab() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('nq-prediction', {
        body: {},
      });

      if (fnError) throw fnError;
      setData(response);
    } catch (err) {
      console.error('Prediction fetch error:', err);
      setError('Failed to fetch predictions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, []);

  const getDirectionIcon = (direction: string) => {
    if (direction.includes('BULLISH')) return <TrendingUp className="h-6 w-6 text-success" />;
    if (direction.includes('BEARISH')) return <TrendingDown className="h-6 w-6 text-destructive" />;
    return <Minus className="h-6 w-6 text-muted-foreground" />;
  };

  const getConfidenceBadge = (confidence: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'High': 'default',
      'Medium': 'secondary',
      'Low': 'destructive',
    };
    return <Badge variant={variants[confidence] || 'secondary'}>{confidence} Confidence</Badge>;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">NQ Institutional Prediction Bot</h2>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">NQ Institutional Prediction Bot</h2>
          <Button onClick={fetchPrediction} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Analysis Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">NQ Institutional Prediction Bot</h2>
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={fetchPrediction} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* 9:30 Open Prediction - Main Card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            9:30 Open Prediction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getDirectionIcon(data.openPrediction.direction)}
              <span className="text-2xl font-bold">{data.openPrediction.direction}</span>
            </div>
            {getConfidenceBadge(data.openPrediction.confidence)}
          </div>
          
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-sm font-medium text-muted-foreground">Strategy</p>
            <p className="text-base font-semibold">{data.openPrediction.strategy}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Score:</span>
            <Badge variant={data.openPrediction.score > 0 ? 'default' : data.openPrediction.score < 0 ? 'destructive' : 'secondary'}>
              {data.openPrediction.score > 0 ? '+' : ''}{data.openPrediction.score.toFixed(1)}
            </Badge>
            {data.openPrediction.signals.map((signal, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {signal}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pre-market Status */}
      {data.premarket && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" />
              Pre-Market Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="text-lg font-bold font-mono">{formatNumber(data.premarket.currentPrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prev Close</p>
                <p className="text-lg font-mono">{formatNumber(data.premarket.prevClose)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Change</p>
                <p className={`text-lg font-bold font-mono ${data.premarket.premarketChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {data.premarket.premarketChange >= 0 ? '+' : ''}{data.premarket.premarketChange.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OPTIONS FLOW SECTION */}
      <div className="space-y-4">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Options Flow
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* VIX & Positioning */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                VIX & Positioning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium">{data.optionsFlow.positioning}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">VIX Level</span>
                  <p className="font-mono font-bold">{data.optionsFlow.vixLevel.toFixed(1)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">VIX vs Avg</span>
                  <p className={`font-mono font-bold ${data.optionsFlow.vixVsAverage >= 0 ? 'text-destructive' : 'text-success'}`}>
                    {data.optionsFlow.vixVsAverage >= 0 ? '+' : ''}{data.optionsFlow.vixVsAverage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gamma Exposure */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gamma Exposure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium">{data.optionsFlow.gammaRegime.replace('_', ' ')}</p>
              <p className="text-sm text-muted-foreground">{data.optionsFlow.gammaImpact}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Support</span>
                  <p className="font-mono text-success">{formatNumber(data.optionsFlow.gammaSupport)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Resistance</span>
                  <p className="font-mono text-destructive">{formatNumber(data.optionsFlow.gammaResistance)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Key Strike ↓</span>
                  <p className="font-mono">{formatNumber(data.optionsFlow.keySupport)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Key Strike ↑</span>
                  <p className="font-mono">{formatNumber(data.optionsFlow.keyResistance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* VOLATILITY SECTION */}
      <div className="space-y-4">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-orange-500" />
          Volatility
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* VIX Details */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                VIX Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current VIX</span>
                <span className="font-mono font-bold text-xl">{data.volatility?.vixCurrent?.toFixed(2) || data.optionsFlow.vixLevel.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">20-day Avg</span>
                <span className="font-mono">{data.volatility?.vix20dAvg?.toFixed(2) || (data.optionsFlow.vixLevel / (1 + data.optionsFlow.vixVsAverage / 100)).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">1-day Change</span>
                <span className={`font-mono font-bold ${(data.volatility?.vixChange1d || 0) >= 0 ? 'text-destructive' : 'text-success'}`}>
                  {(data.volatility?.vixChange1d || 0) >= 0 ? '+' : ''}{(data.volatility?.vixChange1d || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">5-day Change</span>
                <span className={`font-mono font-bold ${(data.volatility?.vixChange5d || 0) >= 0 ? 'text-destructive' : 'text-success'}`}>
                  {(data.volatility?.vixChange5d || 0) >= 0 ? '+' : ''}{(data.volatility?.vixChange5d || 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trend</span>
                <Badge variant={data.volatility?.vixTrend === 'RISING' ? 'destructive' : 
                               data.volatility?.vixTrend === 'FALLING' ? 'default' : 'secondary'}>
                  {data.volatility?.vixTrend || (data.optionsFlow.vixVsAverage > 5 ? 'RISING' : data.optionsFlow.vixVsAverage < -5 ? 'FALLING' : 'STABLE')}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* VIX Signal for NQ/ES */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                VIX Signal for NQ/ES
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-secondary/30 p-3">
                <p className="text-sm font-medium text-muted-foreground">Signal</p>
                <p className="text-lg font-bold">
                  {data.volatility?.vixSignal || 
                   (data.optionsFlow.vixLevel < 15 ? '🟢 LOW VOL - Favor Long NQ/ES' :
                    data.optionsFlow.vixLevel > 25 ? '🔴 HIGH VOL - Caution/Hedges' :
                    '🟡 NORMAL VOL - Trade Setups')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Volatility Regime</span>
                  <p className="font-mono font-bold">
                    {data.volatility?.volatilityRegime || data.optionsFlow.gammaRegime.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">NQ Implied Vol</span>
                  <p className="font-mono">{(data.volatility?.nqVolatility || data.optionsFlow.vixLevel * 1.1).toFixed(1)}%</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {data.optionsFlow.vixLevel < 15 && "Low VIX = dealer gamma support, buy dips"}
                {data.optionsFlow.vixLevel >= 15 && data.optionsFlow.vixLevel <= 25 && "Normal VIX = standard risk, trade technicals"}
                {data.optionsFlow.vixLevel > 25 && "High VIX = elevated risk, reduce size, consider hedges"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* VIX Chart */}
        {data.volatility?.vixHistory && data.volatility.vixHistory.length > 0 && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                VIX 20-Day History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.volatility.vixHistory}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      tickFormatter={(value) => value.slice(5)}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <ReferenceLine y={20} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Reference: VIX 20 = Normal</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Market Breadth & Sector Rotation */}
      <div className="space-y-4">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          Market Internals
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Market Breadth - Enhanced */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4" />
                Market Breadth
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VIX Regime</span>
                <Badge variant={data.marketBreadth.vixRegime === 'LOW_FEAR' ? 'default' :
                               data.marketBreadth.vixRegime === 'HIGH_FEAR' ? 'destructive' : 'secondary'}>
                  {data.marketBreadth.vixRegime.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sentiment</span>
                <Badge variant={data.marketBreadth.marketSentiment === 'RISK_ON' ? 'default' : 
                               data.marketBreadth.marketSentiment === 'RISK_OFF' ? 'destructive' : 'secondary'}>
                  {data.marketBreadth.marketSentiment.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Internals Score</span>
                <span className={`font-mono font-bold ${data.marketBreadth.internalsScore > 0 ? 'text-success' : 
                                data.marketBreadth.internalsScore < 0 ? 'text-destructive' : ''}`}>
                  {data.marketBreadth.internalsScore > 0 ? '+' : ''}{data.marketBreadth.internalsScore}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">NQ/SPY Correlation</span>
                <span className="font-mono">{data.marketBreadth.nqSpyCorrelation.toFixed(2)}</span>
              </div>
              {data.marketBreadth.advanceDecline !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Advance/Decline</span>
                  <span className={`font-mono ${data.marketBreadth.advanceDecline > 0 ? 'text-success' : 'text-destructive'}`}>
                    {data.marketBreadth.advanceDecline > 0 ? '+' : ''}{data.marketBreadth.advanceDecline.toFixed(2)}
                  </span>
                </div>
              )}
              {data.marketBreadth.breadthThrust && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Breadth Thrust</span>
                  <Badge variant={data.marketBreadth.breadthThrust === 'BULLISH' ? 'default' :
                                 data.marketBreadth.breadthThrust === 'BEARISH' ? 'destructive' : 'secondary'}>
                    {data.marketBreadth.breadthThrust}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sector Rotation - Enhanced */}
          {data.sectorRotation && (
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PieChart className="h-4 w-4" />
                  Sector Rotation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Strongest</span>
                  <Badge variant="default">{data.sectorRotation.strongestSector}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weakest</span>
                  <Badge variant="destructive">{data.sectorRotation.weakestSector}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tech Momentum</span>
                  <span className={`font-mono font-bold ${data.sectorRotation.techMomentum >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {data.sectorRotation.techMomentum >= 0 ? '+' : ''}{data.sectorRotation.techMomentum.toFixed(2)}%
                  </span>
                </div>
                
                {/* Sector Strength Bars */}
                <div className="pt-2 border-t border-border/50 space-y-2">
                  <p className="text-xs text-muted-foreground">5-Day Sector Performance</p>
                  {Object.entries(data.sectorRotation.sectorStrength)
                    .sort((a, b) => b[1] - a[1])
                    .map(([sector, strength]) => (
                      <div key={sector} className="flex items-center gap-2">
                        <span className="text-xs w-16">{sector}</span>
                        <div className="flex-1 h-2 bg-secondary/30 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${strength >= 0 ? 'bg-success' : 'bg-destructive'}`}
                            style={{ 
                              width: `${Math.min(Math.abs(strength) * 10, 100)}%`,
                              marginLeft: strength < 0 ? 'auto' : 0
                            }}
                          />
                        </div>
                        <span className={`text-xs font-mono w-14 text-right ${strength >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {strength >= 0 ? '+' : ''}{strength.toFixed(2)}%
                        </span>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* News Prediction */}
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            News Prediction: {data.newsPrediction.newsType}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={data.newsPrediction.outcome.includes('BETTER') ? 'default' : 
                          data.newsPrediction.outcome.includes('WORSE') ? 'destructive' : 'secondary'}
                   className="text-base px-3 py-1">
              {data.newsPrediction.outcome}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Score: {data.newsPrediction.score > 0 ? '+' : ''}{data.newsPrediction.score.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.newsPrediction.signals.map((signal, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {signal}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Economic Calendar */}
      {data.economicEvents.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Upcoming Economic Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.economicEvents.slice(0, 5).map((event, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/20 p-2 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant={event.importance === 'HIGH' ? 'destructive' : 'secondary'} className="text-xs">
                      {event.importance}
                    </Badge>
                    <span className="font-medium">{event.event}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>Exp: {event.consensus}</span>
                    <span>Prev: {event.previous}</span>
                    <Badge variant="outline">
                      {event.daysUntil === 0 ? 'Today' : event.daysUntil === 1 ? 'Tomorrow' : `${event.daysUntil}d`}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crypto Intelligence Section */}
      <div className="border-t border-border/50 pt-6">
        <CryptoSection />
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground">
        <p className="font-medium">⚠️ Risk Disclaimer</p>
        <p className="text-xs text-muted-foreground">
          Trade with institutions, not against them. This analysis is for educational purposes only. 
          Always use proper risk management and position sizing. Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  );
}
