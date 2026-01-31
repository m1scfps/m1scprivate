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

// Convert between different tickers
export function convert(
  value: number,
  fromTicker: string,
  toTicker: string,
  marketData: MarketData,
  params: MarketParams
): number | null {
  if (fromTicker === toTicker) return value;

  // Calculate market-based ratios
  const ratios: Record<string, number> = {
    'QQQ-NQ': marketData.nq / marketData.qqq,
    'NQ-QQQ': marketData.qqq / marketData.nq,
    'SPY-ES': marketData.es / marketData.spy,
    'ES-SPY': marketData.spy / marketData.es,
    // GLD tracks ~1/10 oz of gold, so GLD × ~10.9 ≈ GC
    'GLD-GC': marketData.gc / marketData.gld,
    'GC-GLD': marketData.gld / marketData.gc,
  };

  // Check direct conversion first
  const conversionKey = `${fromTicker}-${toTicker}`;
  if (ratios[conversionKey]) {
    return value * ratios[conversionKey];
  }

  // NDX to NQ: Apply cost of carry formula
  if (fromTicker === 'NDX' && toTicker === 'NQ') {
    return calculateCarryPremium(value, params.riskFreeRate, params.ndxDivYield, params.daysToExp);
  }

  // NQ to NDX: Reverse cost of carry
  if (fromTicker === 'NQ' && toTicker === 'NDX') {
    const t = params.daysToExp / 365.0;
    const r = params.riskFreeRate / 100.0;
    const d = params.ndxDivYield / 100.0;
    const carryMultiplier = Math.exp((r - d) * t);
    return value / carryMultiplier;
  }

  // SPX to ES: Apply cost of carry formula
  if (fromTicker === 'SPX' && toTicker === 'ES') {
    return calculateCarryPremium(value, params.riskFreeRate, params.spxDivYield, params.daysToExp);
  }

  // ES to SPX: Reverse cost of carry
  if (fromTicker === 'ES' && toTicker === 'SPX') {
    const t = params.daysToExp / 365.0;
    const r = params.riskFreeRate / 100.0;
    const d = params.spxDivYield / 100.0;
    const carryMultiplier = Math.exp((r - d) * t);
    return value / carryMultiplier;
  }

  // QQQ to NDX or NDX to QQQ (use simple ratio)
  if (fromTicker === 'QQQ' && toTicker === 'NDX') {
    return value * (marketData.ndx / marketData.qqq);
  }
  if (fromTicker === 'NDX' && toTicker === 'QQQ') {
    return value * (marketData.qqq / marketData.ndx);
  }

  // SPY to SPX or SPX to SPY (use simple ratio)
  if (fromTicker === 'SPY' && toTicker === 'SPX') {
    return value * (marketData.spx / marketData.spy);
  }
  if (fromTicker === 'SPX' && toTicker === 'SPY') {
    return value * (marketData.spy / marketData.spx);
  }

  // Chain conversions for QQQ <-> NQ through NDX
  if (fromTicker === 'QQQ' && toTicker === 'NQ') {
    const ndxValue = value * (marketData.ndx / marketData.qqq);
    return calculateCarryPremium(ndxValue, params.riskFreeRate, params.ndxDivYield, params.daysToExp);
  }
  if (fromTicker === 'NQ' && toTicker === 'QQQ') {
    const t = params.daysToExp / 365.0;
    const r = params.riskFreeRate / 100.0;
    const d = params.ndxDivYield / 100.0;
    const carryMultiplier = Math.exp((r - d) * t);
    const ndxValue = value / carryMultiplier;
    return ndxValue * (marketData.qqq / marketData.ndx);
  }

  // Chain conversions for SPY <-> ES through SPX
  if (fromTicker === 'SPY' && toTicker === 'ES') {
    const spxValue = value * (marketData.spx / marketData.spy);
    return calculateCarryPremium(spxValue, params.riskFreeRate, params.spxDivYield, params.daysToExp);
  }
  if (fromTicker === 'ES' && toTicker === 'SPY') {
    const t = params.daysToExp / 365.0;
    const r = params.riskFreeRate / 100.0;
    const d = params.spxDivYield / 100.0;
    const carryMultiplier = Math.exp((r - d) * t);
    const spxValue = value / carryMultiplier;
    return spxValue * (marketData.spy / marketData.spx);
  }

  return value;
}

// Cross-index conversion (BETA) - converts between ES/NQ and SPX/NDX
export function convertCrossIndex(
  value: number,
  fromTicker: string,
  toTicker: string,
  marketData: MarketData,
  params: MarketParams
): number | null {
  if (fromTicker === toTicker) return value;

  // Get the spot values for each index
  const getSpotValue = (ticker: string): number | null => {
    switch (ticker) {
      case 'ES': {
        const t = params.daysToExp / 365.0;
        const r = params.riskFreeRate / 100.0;
        const d = params.spxDivYield / 100.0;
        return marketData.es / Math.exp((r - d) * t); // ES → SPX equivalent
      }
      case 'NQ': {
        const t = params.daysToExp / 365.0;
        const r = params.riskFreeRate / 100.0;
        const d = params.ndxDivYield / 100.0;
        return marketData.nq / Math.exp((r - d) * t); // NQ → NDX equivalent
      }
      case 'SPX': return marketData.spx;
      case 'NDX': return marketData.ndx;
      default: return null;
    }
  };

  // Calculate NDX/SPX ratio from current market
  const ndxSpxRatio = marketData.ndx / marketData.spx;

  // Convert input to SPX equivalent first
  let spxEquivalent: number;
  switch (fromTicker) {
    case 'ES': {
      const t = params.daysToExp / 365.0;
      const r = params.riskFreeRate / 100.0;
      const d = params.spxDivYield / 100.0;
      spxEquivalent = value / Math.exp((r - d) * t);
      break;
    }
    case 'NQ': {
      const t = params.daysToExp / 365.0;
      const r = params.riskFreeRate / 100.0;
      const d = params.ndxDivYield / 100.0;
      const ndxEquivalent = value / Math.exp((r - d) * t);
      spxEquivalent = ndxEquivalent / ndxSpxRatio;
      break;
    }
    case 'SPX':
      spxEquivalent = value;
      break;
    case 'NDX':
      spxEquivalent = value / ndxSpxRatio;
      break;
    default:
      return null;
  }

  // Convert SPX equivalent to target
  switch (toTicker) {
    case 'ES': {
      const t = params.daysToExp / 365.0;
      const r = params.riskFreeRate / 100.0;
      const d = params.spxDivYield / 100.0;
      return spxEquivalent * Math.exp((r - d) * t);
    }
    case 'NQ': {
      const ndxEquivalent = spxEquivalent * ndxSpxRatio;
      const t = params.daysToExp / 365.0;
      const r = params.riskFreeRate / 100.0;
      const d = params.ndxDivYield / 100.0;
      return ndxEquivalent * Math.exp((r - d) * t);
    }
    case 'SPX':
      return spxEquivalent;
    case 'NDX':
      return spxEquivalent * ndxSpxRatio;
    default:
      return null;
  }
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
