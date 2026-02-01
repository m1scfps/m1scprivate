// Futures converter logic matching the Python implementation

export interface MarketData {
  qqq: number;
  nq: number;
  ndx: number;
  spy: number;
  es: number;
  spx: number;
  gld: number;
  gc: number;
  lastUpdate: Date;
}

export interface MarketParams {
  riskFreeRate: number;
  ndxDivYield: number;
  spxDivYield: number;
  daysToExp: number;
  nextExpiration: string;
  lastParamUpdate: Date;
}

export interface PremiumInfo {
  points: number;
  percent: number;
  dollars: number;
  theoretical: number;
  actual: number;
}

// Get next quarterly expiration (3rd Friday of Mar/Jun/Sep/Dec)
export function getNextQuarterlyExpiration(): { date: string; days: number } {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JS months are 0-indexed

  // Quarterly expiration months
  const expirationMonths = [3, 6, 9, 12];

  // Find next expiration month
  let nextMonth: number | null = null;
  let expirationYear = year;

  for (const month of expirationMonths) {
    if (month > currentMonth) {
      nextMonth = month;
      break;
    }
  }

  // If no month found this year, use March next year
  if (nextMonth === null) {
    nextMonth = 3;
    expirationYear = year + 1;
  }

  // Get 3rd Friday of the month
  const firstDay = new Date(expirationYear, nextMonth - 1, 1);
  const firstDayOfWeek = firstDay.getDay();

  // Calculate days until first Friday (Friday = 5)
  let daysUntilFriday = (5 - firstDayOfWeek + 7) % 7;
  if (daysUntilFriday === 0) {
    daysUntilFriday = 7;
  }

  // 3rd Friday = first Friday + 14 days
  const thirdFriday = new Date(firstDay);
  thirdFriday.setDate(firstDay.getDate() + daysUntilFriday + 14);

  // Calculate days to expiration
  const timeDiff = thirdFriday.getTime() - now.getTime();
  let daysToExp = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  daysToExp = Math.max(daysToExp, 1); // Minimum 1 day

  const dateStr = thirdFriday.toISOString().split('T')[0];

  return {
    date: dateStr,
    days: daysToExp,
  };
}

// Calculate theoretical futures price using cost of carry formula
export function calculateCarryPremium(
  spotPrice: number,
  rate: number,
  divYield: number,
  daysToExp: number
): number {
  const t = daysToExp / 365.0; // Convert days to years
  const r = rate / 100.0; // Convert percentage to decimal
  const d = divYield / 100.0; // Convert percentage to decimal

  // Formula: Futures = Spot × e^((r - d) × t)
  const carryMultiplier = Math.exp((r - d) * t);
  return spotPrice * carryMultiplier;
}

// Convert between different tickers using live market data
export function convert(
  value: number,
  fromTicker: string,
  toTicker: string,
  marketData: MarketData,
  params: MarketParams
): number | null {
  if (fromTicker === toTicker) return value;

  // Gold conversions - use simple live market ratio
  // GLD tracks ~1/10 oz gold, so GLD * ratio ≈ GC
  if (fromTicker === 'GLD' && toTicker === 'GC') {
    const ratio = marketData.gc / marketData.gld;
    return value * ratio;
  }
  if (fromTicker === 'GC' && toTicker === 'GLD') {
    const ratio = marketData.gld / marketData.gc;
    return value * ratio;
  }

  // ETF to ETF conversions (QQQ, SPY)
  if (fromTicker === 'QQQ' && toTicker === 'SPY') {
    return value * (marketData.spy / marketData.qqq);
  }
  if (fromTicker === 'SPY' && toTicker === 'QQQ') {
    return value * (marketData.qqq / marketData.spy);
  }

  // Index to Index (NDX, SPX)
  if (fromTicker === 'NDX' && toTicker === 'SPX') {
    return value * (marketData.spx / marketData.ndx);
  }
  if (fromTicker === 'SPX' && toTicker === 'NDX') {
    return value * (marketData.ndx / marketData.spx);
  }

  // Futures to Futures (NQ, ES)
  if (fromTicker === 'NQ' && toTicker === 'ES') {
    return value * (marketData.es / marketData.nq);
  }
  if (fromTicker === 'ES' && toTicker === 'NQ') {
    return value * (marketData.nq / marketData.es);
  }

  // ETF to Index (simple ratio - no cost of carry needed)
  if (fromTicker === 'QQQ' && toTicker === 'NDX') {
    return value * (marketData.ndx / marketData.qqq);
  }
  if (fromTicker === 'NDX' && toTicker === 'QQQ') {
    return value * (marketData.qqq / marketData.ndx);
  }
  if (fromTicker === 'SPY' && toTicker === 'SPX') {
    return value * (marketData.spx / marketData.spy);
  }
  if (fromTicker === 'SPX' && toTicker === 'SPY') {
    return value * (marketData.spy / marketData.spx);
  }

  // ETF to Futures (use live market ratio directly)
  if (fromTicker === 'QQQ' && toTicker === 'NQ') {
    return value * (marketData.nq / marketData.qqq);
  }
  if (fromTicker === 'NQ' && toTicker === 'QQQ') {
    return value * (marketData.qqq / marketData.nq);
  }
  if (fromTicker === 'SPY' && toTicker === 'ES') {
    return value * (marketData.es / marketData.spy);
  }
  if (fromTicker === 'ES' && toTicker === 'SPY') {
    return value * (marketData.spy / marketData.es);
  }

  // Index to Futures - apply cost of carry formula
  if (fromTicker === 'NDX' && toTicker === 'NQ') {
    return calculateCarryPremium(value, params.riskFreeRate, params.ndxDivYield, params.daysToExp);
  }
  if (fromTicker === 'NQ' && toTicker === 'NDX') {
    const t = params.daysToExp / 365.0;
    const r = params.riskFreeRate / 100.0;
    const d = params.ndxDivYield / 100.0;
    const carryMultiplier = Math.exp((r - d) * t);
    return value / carryMultiplier;
  }
  if (fromTicker === 'SPX' && toTicker === 'ES') {
    return calculateCarryPremium(value, params.riskFreeRate, params.spxDivYield, params.daysToExp);
  }
  if (fromTicker === 'ES' && toTicker === 'SPX') {
    const t = params.daysToExp / 365.0;
    const r = params.riskFreeRate / 100.0;
    const d = params.spxDivYield / 100.0;
    const carryMultiplier = Math.exp((r - d) * t);
    return value / carryMultiplier;
  }

  return value;
}

// Cross-index conversion (BETA) - converts between ES/NQ and SPX/NDX
// Uses the underlying index ratio (NDX/SPX) as the basis for all cross-index conversions
export function convertCrossIndex(
  value: number,
  fromTicker: string,
  toTicker: string,
  marketData: MarketData,
  _params: MarketParams
): number | null {
  if (fromTicker === toTicker) return value;

  // The key insight: NDX/SPX ratio is the fundamental relationship
  // All cross-index conversions should preserve this ratio
  const ndxSpxRatio = marketData.ndx / marketData.spx;

  // Map each ticker to its "index equivalent" for ratio calculation
  // NQ tracks NDX, ES tracks SPX
  const toNdxEquivalent = (ticker: string, val: number): number => {
    switch (ticker) {
      case 'NDX': return val;
      case 'NQ': return val; // NQ ≈ NDX (small premium, but use directly for simplicity)
      case 'SPX': return val * ndxSpxRatio;
      case 'ES': return val * ndxSpxRatio; // ES ≈ SPX, scale to NDX
      default: return val;
    }
  };

  const fromNdxEquivalent = (ticker: string, ndxVal: number): number => {
    switch (ticker) {
      case 'NDX': return ndxVal;
      case 'NQ': return ndxVal;
      case 'SPX': return ndxVal / ndxSpxRatio;
      case 'ES': return ndxVal / ndxSpxRatio;
      default: return ndxVal;
    }
  };

  // Convert: from -> NDX equivalent -> to
  const ndxEquiv = toNdxEquivalent(fromTicker, value);
  const result = fromNdxEquivalent(toTicker, ndxEquiv);

  return result;
}

// Calculate premium information
export function calculatePremiumInfo(
  spot: number,
  futures: number,
  tickerType: 'NQ' | 'ES' | 'GC',
  params: MarketParams
): PremiumInfo {
  // Gold has no dividend yield (storage cost is typically included in futures)
  const divYield = tickerType === 'NQ' ? params.ndxDivYield : tickerType === 'ES' ? params.spxDivYield : 0;
  const theoreticalFutures = calculateCarryPremium(
    spot,
    params.riskFreeRate,
    divYield,
    params.daysToExp
  );

  const premium = theoreticalFutures - spot;
  const premiumPct = (premium / spot) * 100;
  // GC contract is 100 oz, GLD is 1/10 oz equivalent
  const multiplier = tickerType === 'NQ' ? 20 : tickerType === 'ES' ? 50 : 100;
  const premiumDollars = premium * multiplier;

  return {
    points: Math.round(premium * 100) / 100,
    percent: Math.round(premiumPct * 10000) / 10000,
    dollars: Math.round(premiumDollars * 100) / 100,
    theoretical: Math.round(theoreticalFutures * 100) / 100,
    actual: Math.round(futures * 100) / 100,
  };
}

// Default market data (will be updated by user or API)
export function getDefaultMarketData(): MarketData {
  return {
    qqq: 629.0,
    nq: 25993.25,
    ndx: 25748.49,
    spy: 595.0,
    es: 5961.9,
    spx: 5950.0,
    gld: 305.0,
    gc: 3050.0,
    lastUpdate: new Date(),
  };
}

// Default market parameters
export function getDefaultParams(): MarketParams {
  const expiration = getNextQuarterlyExpiration();
  return {
    riskFreeRate: 4.5,
    ndxDivYield: 0.66,
    spxDivYield: 1.13,
    daysToExp: expiration.days,
    nextExpiration: expiration.date,
    lastParamUpdate: new Date(),
  };
}
