import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OHLCVBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
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

interface PredictionResult {
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
  sectorRotation: {
    strongestSector: string;
    weakestSector: string;
    techMomentum: number;
    sectorStrength: Record<string, number>;
  } | null;
  economicEvents: Array<{
    date: string;
    event: string;
    importance: string;
    consensus: string;
    previous: string;
    daysUntil: number;
  }>;
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

// Fetch Yahoo Finance OHLCV data
async function fetchOHLCV(symbol: string, days: number = 90): Promise<OHLCVBar[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    
    const bars: OHLCVBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.close?.[i] != null) {
        bars.push({
          open: quote.open?.[i] || quote.close[i],
          high: quote.high?.[i] || quote.close[i],
          low: quote.low?.[i] || quote.close[i],
          close: quote.close[i],
          volume: quote.volume?.[i] || 0,
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        });
      }
    }

    return bars;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return [];
  }
}

// Calculate Gamma Exposure Levels
function calculateGammaExposure(currentPrice: number, vixLevel: number): {
  regime: string;
  impact: string;
  support: number;
  resistance: number;
  keyResistance: number;
  keySupport: number;
} {
  const base = Math.floor(currentPrice / 100) * 100;
  const strikes = Array.from({ length: 11 }, (_, i) => base + (i - 5) * 100);

  const keyResistance = strikes.find(s => s > currentPrice) || currentPrice + 100;
  const keySupport = [...strikes].reverse().find(s => s < currentPrice) || currentPrice - 100;

  if (vixLevel < 15) {
    return {
      regime: 'HIGH_GAMMA',
      impact: 'Dealers will sell rallies and buy dips (range-bound)',
      support: currentPrice - 50,
      resistance: currentPrice + 50,
      keyResistance,
      keySupport,
    };
  } else if (vixLevel > 25) {
    return {
      regime: 'LOW_GAMMA',
      impact: 'Dealers will amplify moves (trend continuation)',
      support: currentPrice - 150,
      resistance: currentPrice + 150,
      keyResistance,
      keySupport,
    };
  }

  return {
    regime: 'NEUTRAL_GAMMA',
    impact: 'Normal hedging flow',
    support: currentPrice - 100,
    resistance: currentPrice + 100,
    keyResistance,
    keySupport,
  };
}

// Analyze volatility
function analyzeVolatility(vixBars: OHLCVBar[], nqBars: OHLCVBar[]): VolatilityData {
  const defaultData: VolatilityData = {
    vixCurrent: 20,
    vix20dAvg: 20,
    vixChange1d: 0,
    vixChange5d: 0,
    vixTrend: 'STABLE',
    vixSignal: '🟡 NORMAL VOL - Trade Setups',
    vixHistory: [],
    nqVolatility: 22,
    esVolatility: 18,
    volatilityRegime: 'NORMAL',
  };

  if (vixBars.length < 20) return defaultData;

  const vixCurrent = vixBars[vixBars.length - 1].close;
  const vix20dAvg = vixBars.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20;
  
  const vixChange1d = vixBars.length >= 2 
    ? ((vixCurrent - vixBars[vixBars.length - 2].close) / vixBars[vixBars.length - 2].close) * 100 
    : 0;
  
  const vixChange5d = vixBars.length >= 5 
    ? ((vixCurrent - vixBars[vixBars.length - 5].close) / vixBars[vixBars.length - 5].close) * 100 
    : 0;

  // Determine trend
  let vixTrend = 'STABLE';
  if (vixChange5d > 10) vixTrend = 'RISING';
  else if (vixChange5d < -10) vixTrend = 'FALLING';

  // Generate signal for NQ/ES
  let vixSignal = '🟡 NORMAL VOL - Trade Setups';
  let volatilityRegime = 'NORMAL';
  
  if (vixCurrent < 15) {
    vixSignal = '🟢 LOW VOL - Favor Long NQ/ES, buy dips';
    volatilityRegime = 'LOW';
  } else if (vixCurrent > 25) {
    vixSignal = '🔴 HIGH VOL - Caution, reduce size, hedges';
    volatilityRegime = 'HIGH';
  } else if (vixCurrent > 20 && vixTrend === 'RISING') {
    vixSignal = '🟠 RISING VOL - Tighten stops, reduce exposure';
    volatilityRegime = 'ELEVATED';
  }

  // Build VIX history for chart
  const vixHistory = vixBars.slice(-20).map(bar => ({
    date: bar.date,
    value: bar.close,
  }));

  // Calculate NQ implied volatility (approximation)
  const nqVolatility = vixCurrent * 1.1; // NQ typically 10% more volatile than SPX
  const esVolatility = vixCurrent * 0.95;

  return {
    vixCurrent,
    vix20dAvg,
    vixChange1d,
    vixChange5d,
    vixTrend,
    vixSignal,
    vixHistory,
    nqVolatility,
    esVolatility,
    volatilityRegime,
  };
}

// Enhanced market breadth analysis
async function analyzeMarketBreadth(vixBars: OHLCVBar[], spyBars: OHLCVBar[], nqBars: OHLCVBar[]): Promise<{
  vixRegime: string;
  marketSentiment: string;
  internalsScore: number;
  nqSpyCorrelation: number;
  advanceDecline: number;
  newHighsLows: number;
  breadthThrust: string;
}> {
  let internalsScore = 0;
  let vixRegime = 'UNKNOWN';
  let marketSentiment = 'NEUTRAL';
  let nqSpyCorrelation = 0;
  let advanceDecline = 0;
  let newHighsLows = 0;
  let breadthThrust = 'NEUTRAL';

  if (vixBars.length >= 20) {
    const vixCurrent = vixBars[vixBars.length - 1].close;
    const vix20dAvg = vixBars.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20;

    if (vixCurrent < 15) {
      vixRegime = 'LOW_FEAR';
      internalsScore += 2;
    } else if (vixCurrent > 25) {
      vixRegime = 'HIGH_FEAR';
      internalsScore -= 2;
    } else if (vixCurrent > 20) {
      vixRegime = 'ELEVATED';
      internalsScore -= 1;
    } else {
      vixRegime = 'NORMAL';
    }

    const vixSlope = (vixCurrent - vix20dAvg) / vix20dAvg;
    if (vixSlope < -0.15) {
      marketSentiment = 'RISK_ON';
      internalsScore += 2;
      breadthThrust = 'BULLISH';
    } else if (vixSlope > 0.15) {
      marketSentiment = 'RISK_OFF';
      internalsScore -= 2;
      breadthThrust = 'BEARISH';
    } else if (vixSlope < -0.05) {
      marketSentiment = 'RISK_ON';
      internalsScore += 1;
    } else if (vixSlope > 0.05) {
      marketSentiment = 'RISK_OFF';
      internalsScore -= 1;
    }
  }

  // Calculate NQ/SPY correlation
  if (nqBars.length >= 20 && spyBars.length >= 20) {
    const nqReturns = nqBars.slice(-20).map((b, i, arr) => 
      i > 0 ? (b.close - arr[i-1].close) / arr[i-1].close : 0
    ).slice(1);
    const spyReturns = spyBars.slice(-20).map((b, i, arr) => 
      i > 0 ? (b.close - arr[i-1].close) / arr[i-1].close : 0
    ).slice(1);

    const nqMean = nqReturns.reduce((a, b) => a + b, 0) / nqReturns.length;
    const spyMean = spyReturns.reduce((a, b) => a + b, 0) / spyReturns.length;

    let cov = 0, nqVar = 0, spyVar = 0;
    for (let i = 0; i < nqReturns.length; i++) {
      cov += (nqReturns[i] - nqMean) * (spyReturns[i] - spyMean);
      nqVar += Math.pow(nqReturns[i] - nqMean, 2);
      spyVar += Math.pow(spyReturns[i] - spyMean, 2);
    }

    nqSpyCorrelation = cov / (Math.sqrt(nqVar) * Math.sqrt(spyVar));

    if (nqSpyCorrelation > 0.9) {
      internalsScore += 1;
    } else if (nqSpyCorrelation < 0.7) {
      internalsScore -= 1;
    }

    // Estimate advance/decline from price action
    const recentUp = nqBars.slice(-5).filter((b, i, arr) => i > 0 && b.close > arr[i-1].close).length;
    advanceDecline = (recentUp / 4 - 0.5) * 2; // Normalize to -1 to 1
  }

  return { vixRegime, marketSentiment, internalsScore, nqSpyCorrelation, advanceDecline, newHighsLows, breadthThrust };
}

// Analyze sector rotation
async function analyzeSectorRotation(): Promise<{
  strongestSector: string;
  weakestSector: string;
  techMomentum: number;
  sectorStrength: Record<string, number>;
} | null> {
  const sectors: Record<string, string> = {
    'Tech': 'XLK',
    'Finance': 'XLF',
    'Energy': 'XLE',
    'Healthcare': 'XLV',
    'Consumer': 'XLY',
    'Utilities': 'XLU',
    'Materials': 'XLB',
  };

  const sectorStrength: Record<string, number> = {};

  const promises = Object.entries(sectors).map(async ([name, ticker]) => {
    const bars = await fetchOHLCV(ticker, 10);
    if (bars.length >= 5) {
      const momentum = (bars[bars.length - 1].close / bars[bars.length - 5].close - 1) * 100;
      sectorStrength[name] = momentum;
    }
  });

  await Promise.all(promises);

  if (Object.keys(sectorStrength).length === 0) return null;

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

// Get economic calendar - dynamically computed based on known schedules
function getEconomicCalendar(): Array<{
  date: string;
  event: string;
  importance: string;
  consensus: string;
  previous: string;
  daysUntil: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const events: Array<{
    date: Date;
    event: string;
    importance: string;
    consensus: string;
    previous: string;
  }> = [];

  // Helper: get Nth weekday of month (0=Sunday, 1=Monday, ..., 5=Friday)
  function getNthWeekday(year: number, month: number, weekday: number, n: number): Date {
    const first = new Date(year, month, 1);
    let day = 1 + ((weekday - first.getDay() + 7) % 7);
    day += (n - 1) * 7;
    return new Date(year, month, day);
  }

  // Helper: get specific date or nearest business day
  function getBusinessDay(year: number, month: number, day: number): Date {
    const d = new Date(year, month, day);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sunday -> Monday
    if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
    return d;
  }

  // Generate events for current month and next month
  for (let offset = -1; offset <= 2; offset++) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    // NFP - First Friday of the month
    const nfp = getNthWeekday(year, month, 5, 1);
    events.push({ date: nfp, event: 'Non-Farm Payrolls (NFP)', importance: 'HIGH', consensus: 'TBD', previous: 'TBD' });

    // CPI - Usually around the 10th-13th of the month
    const cpi = getBusinessDay(year, month, 12);
    events.push({ date: cpi, event: 'CPI', importance: 'HIGH', consensus: 'TBD', previous: 'TBD' });

    // PPI - Usually day after CPI or 1-2 days later
    const ppi = new Date(cpi);
    ppi.setDate(ppi.getDate() + 1);
    if (ppi.getDay() === 0) ppi.setDate(ppi.getDate() + 1);
    if (ppi.getDay() === 6) ppi.setDate(ppi.getDate() + 2);
    events.push({ date: ppi, event: 'PPI', importance: 'HIGH', consensus: 'TBD', previous: 'TBD' });

    // Retail Sales - Usually around 15th-17th
    const retail = getBusinessDay(year, month, 16);
    events.push({ date: retail, event: 'Retail Sales', importance: 'MEDIUM', consensus: 'TBD', previous: 'TBD' });

    // FOMC - meets ~8 times a year (Jan, Mar, May, Jun, Jul, Sep, Nov, Dec)
    const fomcMonths = [0, 2, 4, 5, 6, 8, 10, 11]; // 0-indexed months
    if (fomcMonths.includes(month)) {
      // FOMC typically on 3rd Wednesday, announcement day
      const fomc = getNthWeekday(year, month, 3, 3);
      events.push({ date: fomc, event: 'FOMC Rate Decision', importance: 'HIGH', consensus: 'TBD', previous: 'TBD' });
    }

    // FOMC Minutes - released ~3 weeks after the meeting (in off months)
    const fomcMinutesMonths = [1, 3, 5, 7, 8, 10]; // months when minutes typically come out
    if (fomcMinutesMonths.includes(month)) {
      const minutes = getNthWeekday(year, month, 3, 3); // ~3rd Wednesday
      events.push({ date: minutes, event: 'FOMC Minutes', importance: 'HIGH', consensus: 'N/A', previous: 'N/A' });
    }

    // PCE - Last Friday of month (Fed's preferred inflation gauge)
    const lastDay = new Date(year, month + 1, 0);
    let pce = new Date(lastDay);
    while (pce.getDay() !== 5) pce.setDate(pce.getDate() - 1);
    events.push({ date: pce, event: 'Core PCE', importance: 'HIGH', consensus: 'TBD', previous: 'TBD' });
  }

  // Format and filter
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return events
    .map(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...event, date: formatDate(event.date), daysUntil };
    })
    .filter(event => event.daysUntil >= 0 && event.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    // Remove duplicates (same event type within 2 days)
    .filter((event, i, arr) => {
      const prev = arr.slice(0, i).find(e => e.event === event.event);
      return !prev || Math.abs(prev.daysUntil - event.daysUntil) > 2;
    });
}

// Generate institutional news prediction
function predictNewsOutcome(
  vixLevel: number,
  vixTrend: string,
  marketSentiment: string,
  internalsScore: number
): { outcome: string; score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  if (vixLevel < 18) {
    score += 1;
    signals.push('Low VIX (complacent)');
  } else if (vixLevel > 22) {
    score -= 1;
    signals.push('Elevated VIX (fearful)');
  }

  if (vixTrend === 'FALLING') {
    score += 1.5;
    signals.push('Falling volatility');
  } else if (vixTrend === 'RISING') {
    score -= 1.5;
    signals.push('Rising volatility');
  }

  if (marketSentiment === 'RISK_ON') {
    score += 1;
    signals.push('Risk-on sentiment');
  } else if (marketSentiment === 'RISK_OFF') {
    score -= 1;
    signals.push('Risk-off sentiment');
  }

  score += internalsScore * 0.5;

  let outcome: string;
  if (score >= 2) {
    outcome = 'LIKELY BETTER THAN EXPECTED';
  } else if (score <= -2) {
    outcome = 'LIKELY WORSE THAN EXPECTED';
  } else {
    outcome = 'IN-LINE EXPECTED';
  }

  return { outcome, score, signals };
}

// Generate 9:30 open prediction
function predictOpen(
  vixLevel: number,
  vixTrend: string,
  marketSentiment: string,
  internalsScore: number,
  techMomentum: number,
  gammaSupport: number,
  gammaResistance: number
): {
  direction: string;
  confidence: string;
  score: number;
  signals: string[];
  strategy: string;
} {
  let score = 0;
  const signals: string[] = [];

  // VIX signals
  if (vixLevel < 15) {
    score += 2;
    signals.push('✅ Low VIX environment');
  } else if (vixLevel > 25) {
    score -= 2;
    signals.push('❌ High VIX caution');
  }

  if (vixTrend === 'FALLING') {
    score += 1.5;
    signals.push('✅ VIX falling');
  } else if (vixTrend === 'RISING') {
    score -= 1.5;
    signals.push('❌ VIX rising');
  }

  // Sentiment
  if (marketSentiment === 'RISK_ON') {
    score += 2;
    signals.push('✅ Risk-on sentiment');
  } else if (marketSentiment === 'RISK_OFF') {
    score -= 2;
    signals.push('❌ Risk-off sentiment');
  }

  // Tech momentum
  if (techMomentum > 1) {
    score += 1.5;
    signals.push('✅ Strong tech momentum');
  } else if (techMomentum < -1) {
    score -= 1.5;
    signals.push('❌ Weak tech momentum');
  }

  score += internalsScore;

  let direction: string;
  let confidence: string;
  let strategy: string;

  if (score >= 5) {
    direction = '📈 STRONG BULLISH';
    confidence = 'High';
    strategy = `BUY dips, target gamma resistance ${gammaResistance.toFixed(0)}`;
  } else if (score >= 2) {
    direction = '📈 BULLISH';
    confidence = 'Medium';
    strategy = 'BUY on confirmation, tight stops';
  } else if (score <= -5) {
    direction = '📉 STRONG BEARISH';
    confidence = 'High';
    strategy = `SELL rallies, target gamma support ${gammaSupport.toFixed(0)}`;
  } else if (score <= -2) {
    direction = '📉 BEARISH';
    confidence = 'Medium';
    strategy = 'SELL on confirmation, reduce exposure';
  } else {
    direction = '↔️ NEUTRAL';
    confidence = 'Low';
    strategy = `RANGE trade gamma levels ${gammaSupport.toFixed(0)} - ${gammaResistance.toFixed(0)}`;
  }

  return { direction, confidence, score, signals, strategy };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting NQ prediction analysis with volatility focus...');

    // Fetch all market data in parallel
    const [nqBars, vixBars, spyBars, sectorRotation] = await Promise.all([
      fetchOHLCV('NQ=F', 90),
      fetchOHLCV('%5EVIX', 30),
      fetchOHLCV('SPY', 30),
      analyzeSectorRotation(),
    ]);

    // Fallback to QQQ if NQ=F fails
    const primaryBars = nqBars.length > 0 ? nqBars : await fetchOHLCV('QQQ', 90);

    if (primaryBars.length === 0) {
      throw new Error('Unable to fetch market data');
    }

    const currentPrice = primaryBars[primaryBars.length - 1].close;
    const vixLevel = vixBars.length > 0 ? vixBars[vixBars.length - 1].close : 20;

    // Analyze volatility
    const volatility = analyzeVolatility(vixBars, primaryBars);

    // Calculate Gamma Exposure
    const gamma = calculateGammaExposure(currentPrice, vixLevel);

    // Analyze Market Breadth
    const breadth = await analyzeMarketBreadth(vixBars, spyBars, primaryBars);

    // VIX analysis for options flow
    const vix20dAvg = vixBars.length >= 20 
      ? vixBars.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20 
      : vixLevel;
    const vixVsAverage = ((vixLevel / vix20dAvg) - 1) * 100;

    let positioning: string;
    let optionsBias: number;
    if (vixLevel > vix20dAvg * 1.15) {
      positioning = 'DEFENSIVE - Heavy put buying';
      optionsBias = -1;
    } else if (vixLevel < vix20dAvg * 0.85) {
      positioning = 'COMPLACENT - Call buying dominant';
      optionsBias = 1;
    } else {
      positioning = 'NEUTRAL - Balanced positioning';
      optionsBias = 0;
    }

    // Pre-market data
    const prevClose = primaryBars.length >= 2 ? primaryBars[primaryBars.length - 2].close : currentPrice;
    const premarketChange = ((currentPrice - prevClose) / prevClose) * 100;

    // Economic calendar
    const economicEvents = getEconomicCalendar();
    const nextMajorEvent = economicEvents.find(e => 
      ['CPI', 'NFP', 'FOMC', 'PPI'].some(key => e.event.includes(key))
    );
    const newsType = nextMajorEvent?.event || 'Economic Data';

    // Generate predictions
    const techMomentum = sectorRotation?.techMomentum || 0;
    
    const newsPrediction = predictNewsOutcome(
      vixLevel,
      volatility.vixTrend,
      breadth.marketSentiment,
      breadth.internalsScore
    );

    const openPrediction = predictOpen(
      vixLevel,
      volatility.vixTrend,
      breadth.marketSentiment,
      breadth.internalsScore,
      techMomentum,
      gamma.support,
      gamma.resistance
    );

    const response: PredictionResult = {
      timestamp: new Date().toISOString(),
      currentPrice,
      premarket: {
        currentPrice,
        prevClose,
        premarketChange,
      },
      optionsFlow: {
        positioning,
        bias: optionsBias,
        vixVsAverage,
        vixLevel,
        gammaRegime: gamma.regime,
        gammaImpact: gamma.impact,
        gammaSupport: gamma.support,
        gammaResistance: gamma.resistance,
        keyResistance: gamma.keyResistance,
        keySupport: gamma.keySupport,
      },
      volatility,
      marketBreadth: {
        vixRegime: breadth.vixRegime,
        marketSentiment: breadth.marketSentiment,
        internalsScore: breadth.internalsScore,
        nqSpyCorrelation: breadth.nqSpyCorrelation,
        advanceDecline: breadth.advanceDecline,
        newHighsLows: breadth.newHighsLows,
        breadthThrust: breadth.breadthThrust,
      },
      sectorRotation,
      economicEvents,
      newsPrediction: {
        newsType,
        outcome: newsPrediction.outcome,
        score: newsPrediction.score,
        signals: newsPrediction.signals,
      },
      openPrediction,
    };

    console.log('Volatility-focused analysis complete');

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
