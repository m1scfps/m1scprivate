import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketDataResult {
  nq: { close: number[]; volume: number[]; dates: string[] } | null;
  vix: { close: number[] } | null;
  sectors: Record<string, number>;
}

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

interface Signal {
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
}

interface PredictionModel {
  model: string;
  prediction: string;
  confidence: number;
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
  daysUntil?: number;
}

// Fetch Yahoo Finance quote
async function fetchYahooQuote(symbol: string, days: number = 5): Promise<{ close: number[]; volume: number[]; dates: string[] } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) return null;

    const closes = result.indicators?.quote?.[0]?.close?.filter((c: number | null) => c !== null) || [];
    const volumes = result.indicators?.quote?.[0]?.volume?.filter((v: number | null) => v !== null) || [];
    const timestamps = result.timestamp || [];
    const dates = timestamps.map((t: number) => new Date(t * 1000).toISOString().split('T')[0]);

    return { close: closes, volume: volumes, dates };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

// Fetch current price for a ticker
async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    
    return meta?.regularMarketPrice || null;
  } catch (error) {
    console.error(`Error fetching current price for ${symbol}:`, error);
    return null;
  }
}

// Get pre-market data
async function getPremarketData(): Promise<PremarketData | null> {
  console.log('Fetching pre-market data...');
  
  try {
    const [currentPrice, historicalData] = await Promise.all([
      fetchCurrentPrice('NQ=F'),
      fetchYahooQuote('NQ=F', 5),
    ]);

    if (!currentPrice || !historicalData || historicalData.close.length < 2) {
      return null;
    }

    const prevClose = historicalData.close[historicalData.close.length - 2];
    const premarketChange = ((currentPrice - prevClose) / prevClose) * 100;

    return {
      currentPrice,
      prevClose,
      premarketChange,
      premarketVolume: historicalData.volume.reduce((a, b) => a + b, 0),
    };
  } catch (error) {
    console.error('Error fetching pre-market data:', error);
    return null;
  }
}

// Analyze options flow using VIX as proxy
function analyzeOptionsFlow(vixData: { close: number[] } | null): OptionsFlow {
  console.log('Analyzing options positioning...');
  
  if (!vixData || vixData.close.length < 20) {
    return { positioning: 'Unknown', bias: 0, vixVsAverage: 0 };
  }

  const vixCurrent = vixData.close[vixData.close.length - 1];
  const vixSma = vixData.close.slice(-20).reduce((a, b) => a + b, 0) / 20;

  let positioning: string;
  let bias: number;

  if (vixCurrent > vixSma * 1.15) {
    positioning = 'DEFENSIVE - Heavy put buying';
    bias = -1;
  } else if (vixCurrent < vixSma * 0.85) {
    positioning = 'COMPLACENT - Call buying dominant';
    bias = 1;
  } else {
    positioning = 'NEUTRAL - Balanced positioning';
    bias = 0;
  }

  return {
    positioning,
    bias,
    vixVsAverage: ((vixCurrent / vixSma) - 1) * 100,
  };
}

// Analyze sector rotation
async function analyzeSectorRotation(): Promise<SectorRotation | null> {
  console.log('Analyzing sector rotation...');
  
  const sectors: Record<string, string> = {
    'Tech': 'XLK',
    'Finance': 'XLF',
    'Energy': 'XLE',
    'Healthcare': 'XLV',
    'Consumer': 'XLY',
  };

  const sectorStrength: Record<string, number> = {};

  const promises = Object.entries(sectors).map(async ([name, ticker]) => {
    const data = await fetchYahooQuote(ticker, 5);
    if (data && data.close.length >= 2) {
      const momentum = (data.close[data.close.length - 1] / data.close[0] - 1) * 100;
      sectorStrength[name] = momentum;
    }
  });

  await Promise.all(promises);

  if (Object.keys(sectorStrength).length === 0) {
    return null;
  }

  const entries = Object.entries(sectorStrength);
  const strongest = entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
  const weakest = entries.reduce((a, b) => a[1] < b[1] ? a : b)[0];

  return {
    strongestSector: strongest,
    weakestSector: weakest,
    techMomentum: sectorStrength['Tech'] || 0,
    sectorStrength,
  };
}

// Calculate gamma exposure
function calculateGammaExposure(vixLevel: number): GammaExposure {
  if (vixLevel < 15) {
    return {
      regime: 'HIGH GAMMA - Dealers provide support',
      impact: 'Dampens volatility, range-bound likely',
      score: 1,
    };
  } else if (vixLevel > 25) {
    return {
      regime: 'LOW GAMMA - Dealers amplify moves',
      impact: 'Increases volatility, trend continuation',
      score: 0,
    };
  } else {
    return {
      regime: 'MODERATE GAMMA',
      impact: 'Normal volatility regime',
      score: 0.5,
    };
  }
}

// Get upcoming economic events
function getEconomicCalendar(): EconomicEvent[] {
  // In production, this would connect to an economic calendar API
  const upcomingEvents: EconomicEvent[] = [
    { date: '2026-02-12', event: 'CPI', importance: 'HIGH', consensus: '2.8%', previous: '2.9%' },
    { date: '2026-02-14', event: 'PPI', importance: 'HIGH', consensus: '2.3%', previous: '2.4%' },
    { date: '2026-02-07', event: 'NFP', importance: 'HIGH', consensus: '180K', previous: '200K' },
    { date: '2026-02-19', event: 'FOMC Minutes', importance: 'HIGH', consensus: 'N/A', previous: 'N/A' },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return upcomingEvents
    .map(event => {
      const eventDate = new Date(event.date);
      const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...event, daysUntil };
    })
    .filter(event => event.daysUntil !== undefined && event.daysUntil >= 0 && event.daysUntil <= 14)
    .sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0));
}

// Calculate RSI
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  const deltas = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = deltas.map(d => d > 0 ? d : 0);
  const losses = deltas.map(d => d < 0 ? -d : 0);

  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate MACD
function calculateMACD(closes: number[]): number {
  if (closes.length < 26) return 0;

  const ema = (data: number[], period: number): number => {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  return ema12 - ema26;
}

// Generate news prediction
function generateNewsPrediction(
  newsType: string,
  vixLevel: number,
  momentum5d: number,
  premarket: PremarketData | null,
  optionsFlow: OptionsFlow
): PredictionModel[] {
  const models: PredictionModel[] = [];

  // Model 1: Volatility Model
  if (vixLevel > 25 && momentum5d < -3) {
    models.push({
      model: 'Volatility Model',
      prediction: `${newsType} likely WORSE than expected`,
      confidence: 0.65,
    });
  } else if (vixLevel < 15 && momentum5d > 2) {
    models.push({
      model: 'Volatility Model',
      prediction: `${newsType} likely BETTER than expected`,
      confidence: 0.60,
    });
  } else {
    models.push({
      model: 'Volatility Model',
      prediction: `${newsType} likely IN-LINE`,
      confidence: 0.50,
    });
  }

  // Model 2: Pre-market Model
  if (premarket && Math.abs(premarket.premarketChange) > 0.5) {
    const direction = premarket.premarketChange < 0 ? 'WORSE' : 'BETTER';
    models.push({
      model: 'Pre-market Model',
      prediction: `${newsType} pricing in ${direction} outcome`,
      confidence: 0.55,
    });
  }

  // Model 3: Options Flow Model
  if (optionsFlow.bias !== 0) {
    const direction = optionsFlow.bias < 0 ? 'WORSE' : 'BETTER';
    models.push({
      model: 'Options Flow Model',
      prediction: `Institutions positioning for ${direction} outcome`,
      confidence: 0.58,
    });
  }

  return models;
}

// Generate 9:30 open prediction
function generate930Prediction(
  nqData: { close: number[] } | null,
  vixLevel: number,
  premarket: PremarketData | null,
  optionsFlow: OptionsFlow,
  sectorRotation: SectorRotation | null
): {
  direction: string;
  confidence: string;
  score: number;
  signals: Signal;
  strategy: string;
} {
  const signals: Signal = {
    shortTerm: [],
    mediumTerm: [],
    longTerm: [],
  };

  let score = 0;

  if (nqData && nqData.close.length >= 20) {
    // RSI signal
    const rsi = calculateRSI(nqData.close);
    if (rsi < 30) {
      signals.shortTerm.push('RSI Oversold - Bullish reversal potential');
      score += 2;
    } else if (rsi > 70) {
      signals.shortTerm.push('RSI Overbought - Bearish reversal potential');
      score -= 2;
    } else {
      signals.shortTerm.push(`RSI Neutral (${rsi.toFixed(1)})`);
    }

    // MACD signal
    const macd = calculateMACD(nqData.close);
    if (macd > 0) {
      signals.mediumTerm.push('MACD Positive - Uptrend momentum');
      score += 1;
    } else {
      signals.mediumTerm.push('MACD Negative - Downtrend momentum');
      score -= 1;
    }

    // Market regime
    const sma50 = nqData.close.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, nqData.close.length);
    const current = nqData.close[nqData.close.length - 1];
    
    if (current > sma50) {
      signals.longTerm.push('Trading above 50-day average - Bull regime');
      score += 0.5;
    } else {
      signals.longTerm.push('Trading below 50-day average - Bear regime');
      score -= 0.5;
    }
  }

  // Pre-market signal
  if (premarket) {
    const pmChange = premarket.premarketChange;
    if (Math.abs(pmChange) > 0.5) {
      const direction = pmChange > 0 ? 'Bullish' : 'Bearish';
      signals.shortTerm.push(`Pre-market ${direction} (${pmChange > 0 ? '+' : ''}${pmChange.toFixed(2)}%)`);
      score += pmChange > 0 ? 1.5 : -1.5;
    } else {
      signals.shortTerm.push(`Pre-market flat (${pmChange > 0 ? '+' : ''}${pmChange.toFixed(2)}%)`);
    }
  }

  // Sector rotation signal
  if (sectorRotation) {
    if (sectorRotation.techMomentum > 1) {
      signals.mediumTerm.push(`Tech sector strong (+${sectorRotation.techMomentum.toFixed(1)}%)`);
      score += 1.5;
    } else if (sectorRotation.techMomentum < -1) {
      signals.mediumTerm.push(`Tech sector weak (${sectorRotation.techMomentum.toFixed(1)}%)`);
      score -= 1.5;
    } else {
      signals.mediumTerm.push(`Tech sector neutral (${sectorRotation.techMomentum.toFixed(1)}%)`);
    }
  }

  // Options flow signal
  if (optionsFlow.bias !== 0) {
    const direction = optionsFlow.bias > 0 ? 'Bullish' : 'Bearish';
    signals.longTerm.push(`Institutional ${direction} positioning`);
    score += optionsFlow.bias;
  } else {
    signals.longTerm.push('Institutional positioning neutral');
  }

  // VIX signal
  if (vixLevel > 25) {
    signals.shortTerm.push(`VIX elevated (${vixLevel.toFixed(1)}) - High volatility expected`);
  } else if (vixLevel < 15) {
    signals.shortTerm.push(`VIX low (${vixLevel.toFixed(1)}) - Complacency detected`);
  }

  // Generate final prediction
  let direction: string;
  let confidence: string;
  let strategy: string;

  if (score >= 3) {
    direction = '📈 STRONG BULLISH';
    confidence = 'High';
    strategy = 'Look for dip-buying opportunities on open';
  } else if (score >= 1.5) {
    direction = '📈 BULLISH';
    confidence = 'Medium';
    strategy = 'Wait for confirmation, then go long';
  } else if (score <= -3) {
    direction = '📉 STRONG BEARISH';
    confidence = 'High';
    strategy = 'Look for short opportunities on bounces';
  } else if (score <= -1.5) {
    direction = '📉 BEARISH';
    confidence = 'Medium';
    strategy = 'Wait for confirmation, consider shorts';
  } else {
    direction = '↔️ NEUTRAL';
    confidence = 'Low';
    strategy = 'Stay flat, wait for direction';
  }

  return { direction, confidence, score, signals, strategy };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting NQ prediction analysis...');

    // Fetch all data in parallel
    const [nqData, vixData, premarket, sectorRotation] = await Promise.all([
      fetchYahooQuote('NQ=F', 60),
      fetchYahooQuote('%5EVIX', 30),
      getPremarketData(),
      analyzeSectorRotation(),
    ]);

    // Calculate derived metrics
    const vixLevel = vixData?.close?.[vixData.close.length - 1] || 20;
    const optionsFlow = analyzeOptionsFlow(vixData);
    const gamma = calculateGammaExposure(vixLevel);
    const economicEvents = getEconomicCalendar();

    // Calculate momentum
    let momentum5d = 0;
    if (nqData && nqData.close.length >= 5) {
      const current = nqData.close[nqData.close.length - 1];
      const fiveDaysAgo = nqData.close[nqData.close.length - 5];
      momentum5d = ((current / fiveDaysAgo) - 1) * 100;
    }

    // Find next major event for news prediction
    const nextMajorEvent = economicEvents.find(e => ['CPI', 'NFP', 'FOMC', 'PPI'].some(key => e.event.includes(key)));
    const newsType = nextMajorEvent?.event || 'Economic Data';

    // Generate predictions
    const newsPrediction = generateNewsPrediction(newsType, vixLevel, momentum5d, premarket, optionsFlow);
    const openPrediction = generate930Prediction(nqData, vixLevel, premarket, optionsFlow, sectorRotation);

    const avgConfidence = newsPrediction.length > 0
      ? newsPrediction.reduce((sum, m) => sum + m.confidence, 0) / newsPrediction.length
      : 0.5;

    const response = {
      timestamp: new Date().toISOString(),
      premarket,
      optionsFlow,
      gamma,
      sectorRotation,
      economicEvents,
      vixLevel,
      momentum5d,
      newsPrediction: {
        newsType,
        models: newsPrediction,
        consensusConfidence: avgConfidence,
      },
      openPrediction,
    };

    console.log('Analysis complete:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Prediction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
