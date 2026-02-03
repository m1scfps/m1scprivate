import { useState, useEffect } from "react";
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
  ArrowUpDown,
  Layers
} from "lucide-react";

interface VolumeProfile {
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  biggestBuyersBelow: number;
  biggestSellersAbove: number;
}

interface OrderFlowData {
  cvd: number;
  recentDelta: number;
  deltaDirection: string;
  orderFlowImbalance: number;
  aggressorSide: string;
  vwap: number;
  vwapPosition: string;
  vwapUpperBand: number;
  vwapLowerBand: number;
  dailyProfile: VolumeProfile;
  weeklyProfile: VolumeProfile;
  monthlyProfile: VolumeProfile;
  blockFlow: number;
  blockDirection: string;
}

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
  orderFlow: OrderFlowData;
  marketBreadth: {
    vixRegime: string;
    marketSentiment: string;
    internalsScore: number;
    nqSpyCorrelation: number;
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

  const formatLargeNumber = (num: number) => {
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(0);
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

      {/* ORDER FLOW SECTION */}
      <div className="space-y-4">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <ArrowUpDown className="h-5 w-5 text-accent" />
          Order Flow
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* CVD & Delta */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cumulative Volume Delta (CVD)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">CVD</span>
                <span className={`font-mono font-bold ${data.orderFlow.cvd >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {data.orderFlow.cvd >= 0 ? '+' : ''}{formatLargeNumber(data.orderFlow.cvd)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recent Delta (5-bar)</span>
                <span className={`font-mono font-bold ${data.orderFlow.recentDelta >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {data.orderFlow.recentDelta >= 0 ? '+' : ''}{formatLargeNumber(data.orderFlow.recentDelta)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Delta Direction</span>
                <Badge variant={data.orderFlow.deltaDirection === 'BUYING' ? 'default' : 
                               data.orderFlow.deltaDirection === 'SELLING' ? 'destructive' : 'secondary'}>
                  {data.orderFlow.deltaDirection}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Order Flow Imbalance & Blocks */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Imbalance & Institutional Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">OFI</span>
                <span className={`font-mono font-bold ${data.orderFlow.orderFlowImbalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {data.orderFlow.orderFlowImbalance >= 0 ? '+' : ''}{data.orderFlow.orderFlowImbalance.toFixed(3)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Aggressor</span>
                <Badge variant={data.orderFlow.aggressorSide === 'BUYERS' ? 'default' : 
                               data.orderFlow.aggressorSide === 'SELLERS' ? 'destructive' : 'secondary'}>
                  {data.orderFlow.aggressorSide}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Block Flow</span>
                <span className="font-mono">{data.orderFlow.blockFlow}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Smart Money</span>
                <Badge variant={data.orderFlow.blockDirection.includes('BUYING') ? 'default' : 
                               data.orderFlow.blockDirection.includes('SELLING') ? 'destructive' : 'secondary'}>
                  {data.orderFlow.blockDirection}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* VWAP */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                VWAP Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">VWAP</span>
                <span className="font-mono font-bold">{formatNumber(data.orderFlow.vwap)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Position</span>
                <Badge variant={data.orderFlow.vwapPosition === 'ABOVE' ? 'default' : 'destructive'}>
                  {data.orderFlow.vwapPosition}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Upper Band</span>
                  <p className="font-mono text-destructive">{formatNumber(data.orderFlow.vwapUpperBand)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Lower Band</span>
                  <p className="font-mono text-success">{formatNumber(data.orderFlow.vwapLowerBand)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volume Profiles */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Layers className="h-4 w-4" />
                Volume Profiles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Daily Profile */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Daily</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">VAH</span>
                    <p className="font-mono text-destructive">{formatNumber(data.orderFlow.dailyProfile.valueAreaHigh)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">POC</span>
                    <p className="font-mono font-bold">{formatNumber(data.orderFlow.dailyProfile.poc)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">VAL</span>
                    <p className="font-mono text-success">{formatNumber(data.orderFlow.dailyProfile.valueAreaLow)}</p>
                  </div>
                </div>
              </div>

              {/* Weekly Profile */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Weekly</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">VAH</span>
                    <p className="font-mono text-destructive">{formatNumber(data.orderFlow.weeklyProfile.valueAreaHigh)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">POC</span>
                    <p className="font-mono font-bold">{formatNumber(data.orderFlow.weeklyProfile.poc)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">VAL</span>
                    <p className="font-mono text-success">{formatNumber(data.orderFlow.weeklyProfile.valueAreaLow)}</p>
                  </div>
                </div>
              </div>

              {/* Monthly Profile */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Monthly</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">VAH</span>
                    <p className="font-mono text-destructive">{formatNumber(data.orderFlow.monthlyProfile.valueAreaHigh)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">POC</span>
                    <p className="font-mono font-bold">{formatNumber(data.orderFlow.monthlyProfile.poc)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">VAL</span>
                    <p className="font-mono text-success">{formatNumber(data.orderFlow.monthlyProfile.valueAreaLow)}</p>
                  </div>
                </div>
              </div>

              {/* Imbalance Zones */}
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Imbalance Zones (Monthly)</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Sellers Above VAH</span>
                    <p className="font-mono text-destructive">
                      {data.orderFlow.monthlyProfile.biggestSellersAbove > 0 
                        ? formatNumber(data.orderFlow.monthlyProfile.biggestSellersAbove) 
                        : 'None'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buyers Below VAL</span>
                    <p className="font-mono text-success">
                      {data.orderFlow.monthlyProfile.biggestBuyersBelow > 0 
                        ? formatNumber(data.orderFlow.monthlyProfile.biggestBuyersBelow) 
                        : 'None'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Market Breadth & Sector Rotation */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Market Breadth */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Market Breadth
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VIX Regime</span>
              <Badge variant="outline">{data.marketBreadth.vixRegime.replace('_', ' ')}</Badge>
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
              <span className={`font-mono ${data.marketBreadth.internalsScore > 0 ? 'text-success' : 
                              data.marketBreadth.internalsScore < 0 ? 'text-destructive' : ''}`}>
                {data.marketBreadth.internalsScore > 0 ? '+' : ''}{data.marketBreadth.internalsScore}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">NQ/SPY Correl</span>
              <span className="font-mono">{data.marketBreadth.nqSpyCorrelation.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Sector Rotation */}
        {data.sectorRotation && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                Sector Rotation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
                <span className={`font-mono ${data.sectorRotation.techMomentum >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {data.sectorRotation.techMomentum >= 0 ? '+' : ''}{data.sectorRotation.techMomentum.toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}
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
