import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptionContract {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  contractSymbol: string;
  expiration: string;
}

interface OptionsAnalysis {
  ticker: string;
  spotPrice: number;
  putCallRatio: number;
  putCallOIRatio: number;
  maxPain: number;
  totalCallVolume: number;
  totalPutVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  ivRank: number;
  avgCallIV: number;
  avgPutIV: number;
  ivSkew: number;
  gammaExposure: {
    regime: string;
    netGEX: number;
    dealerPosition: string;
    flipPoint: number;
    keyLevels: { strike: number; gex: number }[];
  };
  flowSentiment: {
    direction: string;
    score: number;
    signals: string[];
  };
  unusualActivity: {
    strike: number;
    type: string;
    volume: number;
    openInterest: number;
    ratio: number;
    sentiment: string;
  }[];
  topStrikes: {
    calls: { strike: number; volume: number; oi: number }[];
    puts: { strike: number; volume: number; oi: number }[];
  };
  expirations: string[];
  lastUpdate: string;
}

// Map user-facing tickers to Yahoo Finance symbols
function getYahooSymbol(ticker: string): string {
  const map: Record<string, string> = {
    'SPX': '^SPX',
    'NDX': '^NDX',
    'SPY': 'SPY',
    'QQQ': 'QQQ',
    'IWM': 'IWM',
    'AAPL': 'AAPL',
    'TSLA': 'TSLA',
    'NVDA': 'NVDA',
    'AMZN': 'AMZN',
    'META': 'META',
    'MSFT': 'MSFT',
    'GOOGL': 'GOOGL',
  };
  return map[ticker.toUpperCase()] || ticker.toUpperCase();
}

// Fetch options chain from Yahoo Finance
async function fetchOptionsChain(ticker: string, expDate?: string): Promise<any> {
  const yahooSymbol = getYahooSymbol(ticker);
  let url = `https://query1.finance.yahoo.com/v7/finance/options/${yahooSymbol}`;
  if (expDate) {
    url += `?date=${expDate}`;
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status}`);
  }

  const data = await response.json();
  return data?.optionChain?.result?.[0] || null;
}

// Parse option contracts from Yahoo data
function parseContracts(contracts: any[], expDateStr: string): OptionContract[] {
  if (!contracts || !Array.isArray(contracts)) return [];
  return contracts.map((c: any) => ({
    strike: c.strike ?? 0,
    lastPrice: c.lastPrice ?? 0,
    bid: c.bid ?? 0,
    ask: c.ask ?? 0,
    volume: c.volume ?? 0,
    openInterest: c.openInterest ?? 0,
    impliedVolatility: c.impliedVolatility ?? 0,
    inTheMoney: c.inTheMoney ?? false,
    contractSymbol: c.contractSymbol ?? '',
    expiration: expDateStr,
  }));
}

// Calculate max pain - strike where total dollar losses for option holders is maximized
function calculateMaxPain(calls: OptionContract[], puts: OptionContract[]): number {
  const allStrikes = [...new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])].sort((a, b) => a - b);
  if (allStrikes.length === 0) return 0;

  let minPain = Infinity;
  let maxPainStrike = allStrikes[Math.floor(allStrikes.length / 2)];

  for (const testStrike of allStrikes) {
    let totalPain = 0;

    // Call holder losses: max(0, strike - testStrike) * OI for ITM calls
    for (const call of calls) {
      if (testStrike > call.strike) {
        totalPain += (testStrike - call.strike) * call.openInterest;
      }
    }

    // Put holder losses: max(0, testStrike - strike) * OI for ITM puts
    for (const put of puts) {
      if (testStrike < put.strike) {
        totalPain += (put.strike - testStrike) * put.openInterest;
      }
    }

    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = testStrike;
    }
  }

  return maxPainStrike;
}

// Estimate gamma exposure per strike
function calculateGammaExposure(calls: OptionContract[], puts: OptionContract[], spotPrice: number) {
  const gexByStrike: Record<number, number> = {};

  // Simplified GEX: call OI contributes positive gamma, put OI contributes negative gamma
  // Dealers are short options, so they hedge: short calls = long delta (positive gamma), short puts = short delta (negative gamma)
  for (const call of calls) {
    if (call.openInterest > 0) {
      // Call gamma: positive for dealers (they bought shares to hedge)
      const moneyness = Math.abs(spotPrice - call.strike) / spotPrice;
      const gammaWeight = Math.exp(-moneyness * moneyness * 50); // ATM has most gamma
      gexByStrike[call.strike] = (gexByStrike[call.strike] || 0) + call.openInterest * gammaWeight * 100;
    }
  }

  for (const put of puts) {
    if (put.openInterest > 0) {
      const moneyness = Math.abs(spotPrice - put.strike) / spotPrice;
      const gammaWeight = Math.exp(-moneyness * moneyness * 50);
      // Put gamma: negative for dealers
      gexByStrike[put.strike] = (gexByStrike[put.strike] || 0) - put.openInterest * gammaWeight * 100;
    }
  }

  // Net GEX
  let netGEX = 0;
  const keyLevels: { strike: number; gex: number }[] = [];

  for (const [strikeStr, gex] of Object.entries(gexByStrike)) {
    const strike = parseFloat(strikeStr);
    netGEX += gex;
    keyLevels.push({ strike, gex });
  }

  // Sort by absolute GEX magnitude
  keyLevels.sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex));
  const topLevels = keyLevels.slice(0, 10);

  // Find gamma flip point (where cumulative GEX crosses zero)
  const sortedByStrike = [...keyLevels].sort((a, b) => a.strike - b.strike);
  let cumGEX = 0;
  let flipPoint = spotPrice;
  for (const level of sortedByStrike) {
    const prevCum = cumGEX;
    cumGEX += level.gex;
    if (prevCum < 0 && cumGEX >= 0) {
      flipPoint = level.strike;
      break;
    }
  }

  // Determine regime
  let regime = 'NEUTRAL';
  let dealerPosition = 'Mixed positioning';
  if (netGEX > 0) {
    regime = 'POSITIVE_GAMMA';
    dealerPosition = 'Dealers are LONG gamma — will sell rallies & buy dips (mean-reverting, lower volatility)';
  } else if (netGEX < 0) {
    regime = 'NEGATIVE_GAMMA';
    dealerPosition = 'Dealers are SHORT gamma — will buy rallies & sell dips (trend-following, higher volatility)';
  }

  return {
    regime,
    netGEX: Math.round(netGEX),
    dealerPosition,
    flipPoint,
    keyLevels: topLevels,
  };
}

// Detect unusual options activity
function detectUnusualActivity(calls: OptionContract[], puts: OptionContract[]): any[] {
  const unusual: any[] = [];

  const processContracts = (contracts: OptionContract[], type: string) => {
    for (const c of contracts) {
      if (c.openInterest > 0 && c.volume > 0) {
        const ratio = c.volume / c.openInterest;
        if (ratio > 2 && c.volume > 500) {
          unusual.push({
            strike: c.strike,
            type,
            volume: c.volume,
            openInterest: c.openInterest,
            ratio: Math.round(ratio * 100) / 100,
            sentiment: type === 'CALL' ? 'BULLISH' : 'BEARISH',
          });
        }
      }
    }
  };

  processContracts(calls, 'CALL');
  processContracts(puts, 'PUT');

  // Sort by volume/OI ratio
  unusual.sort((a, b) => b.ratio - a.ratio);
  return unusual.slice(0, 10);
}

// Calculate flow sentiment
function calculateFlowSentiment(
  calls: OptionContract[],
  puts: OptionContract[],
  spotPrice: number,
  putCallRatio: number,
  maxPain: number,
  gammaRegime: string
): { direction: string; score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  // 1. Put/Call volume ratio
  if (putCallRatio < 0.7) {
    score += 2;
    signals.push(`Low P/C ratio (${putCallRatio.toFixed(2)}) — bullish call activity`);
  } else if (putCallRatio > 1.2) {
    score -= 2;
    signals.push(`High P/C ratio (${putCallRatio.toFixed(2)}) — bearish put activity`);
  } else {
    signals.push(`Neutral P/C ratio (${putCallRatio.toFixed(2)})`);
  }

  // 2. Max pain vs spot
  const maxPainDiff = ((maxPain - spotPrice) / spotPrice) * 100;
  if (maxPainDiff > 0.5) {
    score += 1;
    signals.push(`Max pain ${maxPain.toFixed(0)} above spot — gravitational pull higher`);
  } else if (maxPainDiff < -0.5) {
    score -= 1;
    signals.push(`Max pain ${maxPain.toFixed(0)} below spot — gravitational pull lower`);
  }

  // 3. Gamma regime
  if (gammaRegime === 'POSITIVE_GAMMA') {
    score += 1;
    signals.push('Positive gamma — dealers suppress moves (range-bound, bullish bias)');
  } else if (gammaRegime === 'NEGATIVE_GAMMA') {
    score -= 1;
    signals.push('Negative gamma — dealers amplify moves (volatile, directional risk)');
  }

  // 4. Call vs put OI near ATM
  const atmRange = spotPrice * 0.02; // 2% around spot
  const atmCalls = calls.filter(c => Math.abs(c.strike - spotPrice) <= atmRange);
  const atmPuts = puts.filter(p => Math.abs(p.strike - spotPrice) <= atmRange);
  const atmCallOI = atmCalls.reduce((s, c) => s + c.openInterest, 0);
  const atmPutOI = atmPuts.reduce((s, p) => s + p.openInterest, 0);

  if (atmCallOI > 0 && atmPutOI > 0) {
    const atmRatio = atmCallOI / atmPutOI;
    if (atmRatio > 1.5) {
      score += 1;
      signals.push(`ATM call OI dominance (${atmRatio.toFixed(1)}x) — call wall support`);
    } else if (atmRatio < 0.67) {
      score -= 1;
      signals.push(`ATM put OI dominance (${(1 / atmRatio).toFixed(1)}x) — put wall overhead`);
    }
  }

  // 5. IV skew (OTM put IV vs OTM call IV)
  const otmPuts = puts.filter(p => p.strike < spotPrice && p.impliedVolatility > 0);
  const otmCalls = calls.filter(c => c.strike > spotPrice && c.impliedVolatility > 0);
  if (otmPuts.length > 0 && otmCalls.length > 0) {
    const avgPutIV = otmPuts.reduce((s, p) => s + p.impliedVolatility, 0) / otmPuts.length;
    const avgCallIV = otmCalls.reduce((s, c) => s + c.impliedVolatility, 0) / otmCalls.length;
    const skew = avgPutIV - avgCallIV;
    if (skew > 0.05) {
      score -= 1;
      signals.push('Put skew elevated — hedging demand / downside fear');
    } else if (skew < -0.02) {
      score += 1;
      signals.push('Call skew elevated — upside demand');
    }
  }

  let direction = 'NEUTRAL';
  if (score >= 3) direction = 'STRONG BULLISH';
  else if (score >= 1) direction = 'BULLISH';
  else if (score <= -3) direction = 'STRONG BEARISH';
  else if (score <= -1) direction = 'BEARISH';

  return { direction, score, signals };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker = 'SPY' } = await req.json().catch(() => ({}));
    const upperTicker = ticker.toUpperCase();

    console.log(`Fetching options data for ${upperTicker}...`);

    // Fetch the first expiration to get list of all expirations + spot price
    const chainData = await fetchOptionsChain(upperTicker);
    if (!chainData) {
      throw new Error(`No options data found for ${upperTicker}`);
    }

    const spotPrice = chainData.quote?.regularMarketPrice ?? chainData.quote?.previousClose ?? 0;
    const expirationTimestamps: number[] = chainData.expirationDates || [];
    const expirations = expirationTimestamps.map((ts: number) => {
      const d = new Date(ts * 1000);
      return d.toISOString().split('T')[0];
    });

    // Use nearest expiration for analysis
    const options = chainData.options?.[0];
    if (!options) {
      throw new Error('No options chain available');
    }

    const expDateStr = expirations[0] || '';
    const calls = parseContracts(options.calls, expDateStr);
    const puts = parseContracts(options.puts, expDateStr);

    // Also fetch next week expiration if available for broader view
    let calls2: OptionContract[] = [];
    let puts2: OptionContract[] = [];
    if (expirationTimestamps.length > 1) {
      try {
        const chain2 = await fetchOptionsChain(upperTicker, String(expirationTimestamps[1]));
        if (chain2?.options?.[0]) {
          const exp2Str = expirations[1] || '';
          calls2 = parseContracts(chain2.options[0].calls, exp2Str);
          puts2 = parseContracts(chain2.options[0].puts, exp2Str);
        }
      } catch {
        // ignore, use single expiration
      }
    }

    // Combine for analysis
    const allCalls = [...calls, ...calls2];
    const allPuts = [...puts, ...puts2];

    // Calculate metrics
    const totalCallVolume = allCalls.reduce((s, c) => s + c.volume, 0);
    const totalPutVolume = allPuts.reduce((s, p) => s + p.volume, 0);
    const totalCallOI = allCalls.reduce((s, c) => s + c.openInterest, 0);
    const totalPutOI = allPuts.reduce((s, p) => s + p.openInterest, 0);

    const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;
    const putCallOIRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;

    const maxPain = calculateMaxPain(allCalls, allPuts);
    const gammaExposure = calculateGammaExposure(allCalls, allPuts, spotPrice);
    const unusualActivity = detectUnusualActivity(allCalls, allPuts);

    // IV calculations
    const callsWithIV = allCalls.filter(c => c.impliedVolatility > 0);
    const putsWithIV = allPuts.filter(p => p.impliedVolatility > 0);
    const avgCallIV = callsWithIV.length > 0
      ? callsWithIV.reduce((s, c) => s + c.impliedVolatility, 0) / callsWithIV.length
      : 0;
    const avgPutIV = putsWithIV.length > 0
      ? putsWithIV.reduce((s, p) => s + p.impliedVolatility, 0) / putsWithIV.length
      : 0;
    const ivSkew = avgPutIV - avgCallIV;

    // Flow sentiment
    const flowSentiment = calculateFlowSentiment(
      allCalls, allPuts, spotPrice, putCallRatio, maxPain, gammaExposure.regime
    );

    // Top strikes by volume
    const topCallStrikes = [...allCalls]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map(c => ({ strike: c.strike, volume: c.volume, oi: c.openInterest }));
    const topPutStrikes = [...allPuts]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map(p => ({ strike: p.strike, volume: p.volume, oi: p.openInterest }));

    const analysis: OptionsAnalysis = {
      ticker: upperTicker,
      spotPrice,
      putCallRatio: Math.round(putCallRatio * 1000) / 1000,
      putCallOIRatio: Math.round(putCallOIRatio * 1000) / 1000,
      maxPain,
      totalCallVolume,
      totalPutVolume,
      totalCallOI,
      totalPutOI,
      ivRank: 0, // Would need historical IV data
      avgCallIV: Math.round(avgCallIV * 10000) / 100,
      avgPutIV: Math.round(avgPutIV * 10000) / 100,
      ivSkew: Math.round(ivSkew * 10000) / 100,
      gammaExposure,
      flowSentiment,
      unusualActivity,
      topStrikes: { calls: topCallStrikes, puts: topPutStrikes },
      expirations: expirations.slice(0, 8),
      lastUpdate: new Date().toISOString(),
    };

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Options data error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch options data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
