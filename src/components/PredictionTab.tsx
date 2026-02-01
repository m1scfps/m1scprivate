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
  Target
} from "lucide-react";

interface PremarketData {
  currentPrice: number;
  prevClose: number;
  premarketChange: number;
  premarketVolume: number;
}

interface OptionsFlow {
  positioning: string;
  bias: number;
  vixVsAverage: number;
}

interface GammaExposure {
  regime: string;
  impact: string;
  score: number;
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

interface PredictionModel {
  model: string;
  prediction: string;
  confidence: number;
}

interface Signal {
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
}

interface PredictionData {
  timestamp: string;
  premarket: PremarketData | null;
  optionsFlow: OptionsFlow;
  gamma: GammaExposure;
  sectorRotation: SectorRotation | null;
  economicEvents: EconomicEvent[];
  vixLevel: number;
  momentum5d: number;
  newsPrediction: {
    newsType: string;
    models: PredictionModel[];
    consensusConfidence: number;
  };
  openPrediction: {
    direction: string;
    confidence: string;
    score: number;
    signals: Signal;
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🤖 NQ Prediction Bot</h2>
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
          <h2 className="text-lg font-semibold">🤖 NQ Prediction Bot</h2>
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
          <h2 className="text-lg font-semibold">🤖 NQ Prediction Bot</h2>
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

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Composite Score:</span>
            <Badge variant={data.openPrediction.score > 0 ? 'default' : data.openPrediction.score < 0 ? 'destructive' : 'secondary'}>
              {data.openPrediction.score > 0 ? '+' : ''}{data.openPrediction.score.toFixed(1)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Signals Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Zap className="h-4 w-4" />
              Short-Term (Intraday)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.openPrediction.signals.shortTerm.map((signal, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {signal}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Medium-Term (Swing)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.openPrediction.signals.mediumTerm.map((signal, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent">•</span>
                  {signal}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Long-Term (Position)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.openPrediction.signals.longTerm.map((signal, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-success">•</span>
                  {signal}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Pre-market & Market Data */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Pre-market Status */}
        {data.premarket && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                🌅 Pre-Market Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Price</span>
                <span className="font-mono font-bold">{data.premarket.currentPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prev Close</span>
                <span className="font-mono">{data.premarket.prevClose.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Change</span>
                <span className={`font-mono font-bold ${data.premarket.premarketChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {data.premarket.premarketChange >= 0 ? '+' : ''}{data.premarket.premarketChange.toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Options Positioning */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              📊 Options Positioning
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{data.optionsFlow.positioning}</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VIX Level</span>
              <span className="font-mono">{data.vixLevel.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VIX vs Average</span>
              <span className={`font-mono ${data.optionsFlow.vixVsAverage >= 0 ? 'text-destructive' : 'text-success'}`}>
                {data.optionsFlow.vixVsAverage >= 0 ? '+' : ''}{data.optionsFlow.vixVsAverage.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gamma & Sector Rotation */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gamma Exposure */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              ⚡ Gamma Exposure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{data.gamma.regime}</p>
            <p className="text-sm text-muted-foreground">{data.gamma.impact}</p>
          </CardContent>
        </Card>

        {/* Sector Rotation */}
        {data.sectorRotation && (
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                🔄 Sector Rotation
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
          <div className="grid gap-3 md:grid-cols-3">
            {data.newsPrediction.models.map((model, i) => (
              <div key={i} className="rounded-lg bg-secondary/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">{model.model}</p>
                <p className="text-sm font-semibold">{model.prediction}</p>
                <p className="text-xs text-muted-foreground">
                  Confidence: {(model.confidence * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ensemble Confidence:</span>
            <Badge variant="secondary">
              {(data.newsPrediction.consensusConfidence * 100).toFixed(0)}%
            </Badge>
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
          This analysis is for educational purposes only. Always use proper risk management and position sizing.
          Past performance does not guarantee future results.
        </p>
      </div>
    </div>
  );
}
