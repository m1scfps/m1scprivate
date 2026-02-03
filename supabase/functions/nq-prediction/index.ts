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

interface PredictionResult {
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

// Calculate VWAP and bands
function calculateVWAP(bars: OHLCVBar[]): { vwap: number; upperBand: number; lowerBand: number } {
  if (bars.length === 0) return { vwap: 0, upperBand: 0, lowerBand: 0 };

  let cumVolume = 0;
  let cumTPVolume = 0;
  let cumTPSquared = 0;

  for (const bar of bars) {
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumVolume += bar.volume;
    cumTPVolume += tp * bar.volume;
    cumTPSquared += (tp * tp) * bar.volume;
  }

  if (cumVolume === 0) {
    const lastClose = bars[bars.length - 1]?.close || 0;
    return { vwap: lastClose, upperBand: lastClose + 50, lowerBand: lastClose - 50 };
  }

  const vwap = cumTPVolume / cumVolume;
  const variance = (cumTPSquared / cumVolume) - (vwap * vwap);
  const stdDev = Math.sqrt(Math.max(variance, 0));

  return {
    vwap,
    upperBand: vwap + stdDev,
    lowerBand: vwap - stdDev,
  };
}

// Calculate Cumulative Volume Delta (CVD)
function calculateCVD(bars: OHLCVBar[]): { cvd: number; recentDelta: number; direction: string } {
  if (bars.length < 2) return { cvd: 0, recentDelta: 0, direction: 'NEUTRAL' };

  let cvd = 0;
  const deltas: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const priceChange = bars[i].close - bars[i - 1].close;
    const delta = priceChange > 0 ? bars[i].volume : -bars[i].volume;
    cvd += delta;
    deltas.push(delta);
  }

  const recentDelta = deltas.slice(-5).reduce((a, b) => a + b, 0);
  const direction = recentDelta > 0 ? 'BUYING' : recentDelta < 0 ? 'SELLING' : 'NEUTRAL';

  return { cvd, recentDelta, direction };
}

// Calculate Order Flow Imbalance
function calculateOrderFlowImbalance(bars: OHLCVBar[]): { ofi: number; aggressor: string } {
  if (bars.length === 0) return { ofi: 0, aggressor: 'BALANCED' };

  const recentBars = bars.slice(-10);
  let totalOFI = 0;

  for (const bar of recentBars) {
    const range = bar.high - bar.low;
    if (range === 0) continue;
    
    const closePosition = (bar.close - bar.low) / range;
    const buyVolume = bar.volume * closePosition;
    const sellVolume = bar.volume * (1 - closePosition);
    totalOFI += (buyVolume - sellVolume) / bar.volume;
  }

  const avgOFI = totalOFI / recentBars.length;
  const aggressor = avgOFI > 0.1 ? 'BUYERS' : avgOFI < -0.1 ? 'SELLERS' : 'BALANCED';

  return { ofi: avgOFI, aggressor };
}

// Calculate Volume Profile with POC, VAH, VAL, and imbalance zones
function calculateVolumeProfile(bars: OHLCVBar[], bins: number = 50): VolumeProfile {
  if (bars.length === 0) {
    return { poc: 0, valueAreaHigh: 0, valueAreaLow: 0, biggestBuyersBelow: 0, biggestSellersAbove: 0 };
  }

  const minPrice = Math.min(...bars.map(b => b.low));
  const maxPrice = Math.max(...bars.map(b => b.high));
  const priceRange = maxPrice - minPrice || 1;
  const binSize = priceRange / bins;

  const volumeAtPrice: Record<number, { total: number; buy: number; sell: number }> = {};

  for (const bar of bars) {
    const midPrice = (bar.high + bar.low) / 2;
    const binIdx = Math.min(Math.max(Math.floor((midPrice - minPrice) / binSize), 0), bins - 1);
    
    if (!volumeAtPrice[binIdx]) {
      volumeAtPrice[binIdx] = { total: 0, buy: 0, sell: 0 };
    }
    
    volumeAtPrice[binIdx].total += bar.volume;
    
    // Estimate buy/sell based on close position
    const range = bar.high - bar.low || 1;
    const closePosition = (bar.close - bar.low) / range;
    volumeAtPrice[binIdx].buy += bar.volume * closePosition;
    volumeAtPrice[binIdx].sell += bar.volume * (1 - closePosition);
  }

  // Find POC (Point of Control)
  let pocBin = 0;
  let maxVolume = 0;
  for (const [bin, data] of Object.entries(volumeAtPrice)) {
    if (data.total > maxVolume) {
      maxVolume = data.total;
      pocBin = parseInt(bin);
    }
  }
  const poc = minPrice + (pocBin + 0.5) * binSize;

  // Calculate Value Area (70% of volume)
  const totalVolume = Object.values(volumeAtPrice).reduce((sum, d) => sum + d.total, 0);
  const sortedBins = Object.entries(volumeAtPrice)
    .sort((a, b) => b[1].total - a[1].total);

  let cumVolume = 0;
  const valueAreaBins: number[] = [];
  for (const [bin, data] of sortedBins) {
    cumVolume += data.total;
    valueAreaBins.push(parseInt(bin));
    if (cumVolume >= totalVolume * 0.70) break;
  }

  const valueAreaHigh = minPrice + (Math.max(...valueAreaBins) + 1) * binSize;
  const valueAreaLow = minPrice + Math.min(...valueAreaBins) * binSize;

  // Find biggest buyers below VAL and sellers above VAH
  let biggestBuyersBelow = 0;
  let biggestSellersAbove = 0;
  const valBin = Math.floor((valueAreaLow - minPrice) / binSize);
  const vahBin = Math.floor((valueAreaHigh - minPrice) / binSize);

  for (const [bin, data] of Object.entries(volumeAtPrice)) {
    const binNum = parseInt(bin);
    if (binNum < valBin && data.buy > biggestBuyersBelow) {
      biggestBuyersBelow = minPrice + (binNum + 0.5) * binSize;
    }
    if (binNum > vahBin && data.sell > biggestSellersAbove) {
      biggestSellersAbove = minPrice + (binNum + 0.5) * binSize;
    }
  }

  return { poc, valueAreaHigh, valueAreaLow, biggestBuyersBelow, biggestSellersAbove };
}

// Detect large block trades
function analyzeBlockTrades(bars: OHLCVBar[]): { blockFlow: number; direction: string } {
  if (bars.length < 20) return { blockFlow: 0, direction: 'NEUTRAL' };

  const volumes = bars.map(b => b.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const stdVolume = Math.sqrt(
    volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length
  );

  let blockFlow = 0;
  const recentBars = bars.slice(-10);

  for (const bar of recentBars) {
    const zScore = (bar.volume - avgVolume) / (stdVolume || 1);
    if (zScore > 2) {
      blockFlow += bar.close > bar.open ? 1 : -1;
    }
  }

  const direction = blockFlow > 0 ? 'INSTITUTIONAL BUYING' : 
                    blockFlow < 0 ? 'INSTITUTIONAL SELLING' : 'NEUTRAL';

  return { blockFlow, direction };
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

// Analyze market breadth
async function analyzeMarketBreadth(vixBars: OHLCVBar[], spyBars: OHLCVBar[], nqBars: OHLCVBar[]): Promise<{
  vixRegime: string;
  marketSentiment: string;
  internalsScore: number;
  nqSpyCorrelation: number;
}> {
  let internalsScore = 0;
  let vixRegime = 'UNKNOWN';
  let marketSentiment = 'NEUTRAL';
  let nqSpyCorrelation = 0;

  if (vixBars.length >= 20) {
    const vixCurrent = vixBars[vixBars.length - 1].close;
    const vix20dAvg = vixBars.slice(-20).reduce((sum, b) => sum + b.close, 0) / 20;

    if (vixCurrent < 15) {
      vixRegime = 'LOW_FEAR';
      internalsScore += 1;
    } else if (vixCurrent > 25) {
      vixRegime = 'HIGH_FEAR';
      internalsScore -= 1;
    } else {
      vixRegime = 'NORMAL';
    }

    const vixSlope = (vixCurrent - vix20dAvg) / vix20dAvg;
    if (vixSlope < -0.1) {
      marketSentiment = 'RISK_ON';
      internalsScore += 1;
    } else if (vixSlope > 0.1) {
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
  }

  return { vixRegime, marketSentiment, internalsScore, nqSpyCorrelation };
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
  };

  const sectorStrength: Record<string, number> = {};

  const promises = Object.entries(sectors).map(async ([name, ticker]) => {
    const bars = await fetchOHLCV(ticker, 5);
    if (bars.length >= 2) {
      const momentum = (bars[bars.length - 1].close / bars[0].close - 1) * 100;
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

// Get economic calendar
function getEconomicCalendar(): Array<{
  date: string;
  event: string;
  importance: string;
  consensus: string;
  previous: string;
  daysUntil: number;
}> {
  const upcomingEvents = [
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
    .filter(event => event.daysUntil >= 0 && event.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// Generate institutional news prediction
function predictNewsOutcome(
  vwapPosition: string,
  recentDelta: number,
  blockFlow: number,
  ofi: number,
  internalsScore: number
): { outcome: string; score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  if (vwapPosition === 'ABOVE') {
    score += 1;
    signals.push('Price above VWAP');
  } else {
    score -= 1;
    signals.push('Price below VWAP');
  }

  if (recentDelta > 0) {
    score += 2;
    signals.push('Positive delta');
  } else {
    score -= 2;
    signals.push('Negative delta');
  }

  if (blockFlow > 0) {
    score += 1.5;
    signals.push('Institutional buying');
  } else if (blockFlow < 0) {
    score -= 1.5;
    signals.push('Institutional selling');
  }

  if (ofi > 0.1) {
    score += 1;
    signals.push('Aggressive buying');
  } else if (ofi < -0.1) {
    score -= 1;
    signals.push('Aggressive selling');
  }

  score += internalsScore;

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
  vwapPosition: string,
  recentDelta: number,
  blockFlow: number,
  internalsScore: number,
  poc: number,
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

  if (vwapPosition === 'ABOVE') {
    score += 2;
    signals.push('✅ Above VWAP');
  } else {
    score -= 2;
    signals.push('❌ Below VWAP');
  }

  if (recentDelta > 0) {
    score += 2;
    signals.push('✅ Positive delta');
  } else {
    score -= 2;
    signals.push('❌ Negative delta');
  }

  if (blockFlow > 0) {
    score += 2;
    signals.push('✅ Institutional buying');
  } else if (blockFlow < 0) {
    score -= 2;
    signals.push('❌ Institutional selling');
  }

  score += internalsScore;

  let direction: string;
  let confidence: string;
  let strategy: string;

  if (score >= 5) {
    direction = '📈 STRONG BULLISH';
    confidence = 'High';
    strategy = `BUY dips to VWAP, target POC ${poc.toFixed(0)}`;
  } else if (score >= 2) {
    direction = '📈 BULLISH';
    confidence = 'Medium';
    strategy = 'BUY on confirmation above VWAP';
  } else if (score <= -5) {
    direction = '📉 STRONG BEARISH';
    confidence = 'High';
    strategy = `SELL rallies to VWAP, target POC ${poc.toFixed(0)}`;
  } else if (score <= -2) {
    direction = '📉 BEARISH';
    confidence = 'Medium';
    strategy = 'SELL on confirmation below VWAP';
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
    console.log('Starting institutional NQ prediction analysis...');

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

    // Calculate Order Flow indicators
    const vwapData = calculateVWAP(primaryBars.slice(-20));
    const cvdData = calculateCVD(primaryBars);
    const ofiData = calculateOrderFlowImbalance(primaryBars);
    const blockData = analyzeBlockTrades(primaryBars);

    // Calculate Volume Profiles (daily, weekly, monthly)
    const dailyProfile = calculateVolumeProfile(primaryBars.slice(-1));
    const weeklyProfile = calculateVolumeProfile(primaryBars.slice(-5));
    const monthlyProfile = calculateVolumeProfile(primaryBars.slice(-22));

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

    // VWAP position
    const vwapPosition = currentPrice > vwapData.vwap ? 'ABOVE' : 'BELOW';

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
    const newsPrediction = predictNewsOutcome(
      vwapPosition,
      cvdData.recentDelta,
      blockData.blockFlow,
      ofiData.ofi,
      breadth.internalsScore
    );

    const openPrediction = predictOpen(
      vwapPosition,
      cvdData.recentDelta,
      blockData.blockFlow,
      breadth.internalsScore,
      monthlyProfile.poc,
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
      orderFlow: {
        cvd: cvdData.cvd,
        recentDelta: cvdData.recentDelta,
        deltaDirection: cvdData.direction,
        orderFlowImbalance: ofiData.ofi,
        aggressorSide: ofiData.aggressor,
        vwap: vwapData.vwap,
        vwapPosition,
        vwapUpperBand: vwapData.upperBand,
        vwapLowerBand: vwapData.lowerBand,
        dailyProfile,
        weeklyProfile,
        monthlyProfile,
        blockFlow: blockData.blockFlow,
        blockDirection: blockData.direction,
      },
      marketBreadth: {
        vixRegime: breadth.vixRegime,
        marketSentiment: breadth.marketSentiment,
        internalsScore: breadth.internalsScore,
        nqSpyCorrelation: breadth.nqSpyCorrelation,
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

    console.log('Institutional analysis complete');

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
