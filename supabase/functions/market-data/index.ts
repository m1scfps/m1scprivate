import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketData {
  qqq: number;
  nq: number;
  ndx: number;
  spy: number;
  es: number;
  spx: number;
  gld: number;
  gc: number;
  qqqPrevClose: number;
  spyPrevClose: number;
  ndxPrevClose: number;
  spxPrevClose: number;
  lastUpdate: string;
}

interface MarketParams {
  riskFreeRate: number;
  ndxDivYield: number;
  spxDivYield: number;
  daysToExp: number;
  nextExpiration: string;
  ndxQqqRatio: number;
  spxSpyRatio: number;
}

// Fetch quote data from Yahoo Finance
async function fetchYahooQuote(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) {
      console.error(`No result for ${symbol}`);
      return null;
    }

    // Get the most recent price
    const meta = result.meta;
    const regularMarketPrice = meta?.regularMarketPrice;
    
    if (regularMarketPrice !== undefined && regularMarketPrice !== null) {
      return Math.round(regularMarketPrice * 100) / 100;
    }

    // Fallback to last close from indicators
    const closes = result.indicators?.quote?.[0]?.close;
    if (closes && closes.length > 0) {
      const lastClose = closes.filter((c: number | null) => c !== null).pop();
      if (lastClose) {
        return Math.round(lastClose * 100) / 100;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

// Fetch ETF dividend yield from Yahoo Finance (QQQ, SPY)
async function fetchETFDividendYield(symbol: string): Promise<number | null> {
  try {
    // Use the chart endpoint with events to get dividend data
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y&events=div`;
    const chartResponse = await fetch(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (chartResponse.ok) {
      const chartData = await chartResponse.json();
      const meta = chartData?.chart?.result?.[0]?.meta;
      const events = chartData?.chart?.result?.[0]?.events?.dividends;
      const currentPrice = meta?.regularMarketPrice;

      if (events && currentPrice) {
        // Calculate trailing 12m dividend yield from events
        const oneYearAgo = Date.now() / 1000 - 365 * 24 * 60 * 60;
        let totalDividends = 0;
        for (const div of Object.values(events) as Array<{ date: number; amount: number }>) {
          if (div.date > oneYearAgo) {
            totalDividends += div.amount;
          }
        }
        const yieldPct = (totalDividends / currentPrice) * 100;
        console.log(`${symbol} calculated yield from dividends: ${yieldPct.toFixed(3)}%`);
        return Math.round(yieldPct * 1000) / 1000;
      }
    }

    // Fallback defaults based on institutional data
    if (symbol === 'QQQ') {
      console.log('Using fallback QQQ dividend yield: 0.660%');
      return 0.660;
    }
    if (symbol === 'SPY') {
      console.log('Using fallback SPY dividend yield: 1.130%');
      return 1.130;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching dividend yield for ${symbol}:`, error);
    return null;
  }
}

// Fetch previous day's close price
async function fetchPreviousClose(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch previous close for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) {
      return null;
    }

    // Get previous close from meta
    const previousClose = result.meta?.chartPreviousClose || result.meta?.previousClose;
    if (previousClose) {
      console.log(`${symbol} previous close from meta: ${previousClose}`);
      return Math.round(previousClose * 100) / 100;
    }

    // Fallback: get second-to-last close from history
    const closes = result.indicators?.quote?.[0]?.close;
    if (closes && closes.length >= 2) {
      const validCloses = closes.filter((c: number | null) => c !== null);
      if (validCloses.length >= 2) {
        const prevClose = validCloses[validCloses.length - 2];
        console.log(`${symbol} previous close from history: ${prevClose}`);
        return Math.round(prevClose * 100) / 100;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching previous close for ${symbol}:`, error);
    return null;
  }
}

// FRED API configuration for 3-month T-Bill rate
const FRED_API_KEY = "1d62462ccff3f459aeef7976a002bb0a";
const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

// Fetch Treasury rate (risk-free proxy) from FRED API
async function fetchRiskFreeRate(): Promise<number> {
  try {
    // FRED series ID: DGS3MO (Market Yield on U.S. Treasury Securities at 3-Month Constant Maturity)
    const params = new URLSearchParams({
      series_id: 'DGS3MO',
      api_key: FRED_API_KEY,
      file_type: 'json',
      sort_order: 'desc',
      limit: '1',
    });

    const response = await fetch(`${FRED_BASE_URL}?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.observations?.length > 0) {
        const latest = data.observations[0];
        if (latest.value !== '.') { // FRED uses '.' for missing data
          const rate = parseFloat(latest.value);
          if (rate >= 0.1 && rate <= 10.0) { // Sanity check
            console.log(`FRED 3M T-Bill rate: ${rate}%`);
            return Math.round(rate * 1000) / 1000;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching FRED rate:', error);
  }

  // Fallback to Yahoo Finance 13-week T-Bill
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EIRX?interval=1d&range=5d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const rate = meta?.regularMarketPrice;
      
      if (rate && rate >= 2.0 && rate <= 8.0) {
        console.log(`Yahoo IRX fallback rate: ${rate}%`);
        return Math.round(rate * 1000) / 1000;
      }
    }
  } catch (error) {
    console.error('Error fetching Yahoo IRX rate:', error);
  }
  
  return 4.31; // Default fallback (current approximate)
}

// Calculate next quarterly expiration (3rd Friday of Mar/Jun/Sep/Dec)
function getNextQuarterlyExpiration(): { date: string; days: number } {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const expirationMonths = [3, 6, 9, 12];
  let nextMonth: number | null = null;
  let expirationYear = year;

  for (const month of expirationMonths) {
    if (month > currentMonth) {
      nextMonth = month;
      break;
    }
  }

  if (nextMonth === null) {
    nextMonth = 3;
    expirationYear = year + 1;
  }

  // Get 3rd Friday of the month
  const firstDay = new Date(expirationYear, nextMonth - 1, 1);
  const firstDayOfWeek = firstDay.getDay();
  let daysUntilFriday = (5 - firstDayOfWeek + 7) % 7;
  if (daysUntilFriday === 0) {
    daysUntilFriday = 7;
  }

  const thirdFriday = new Date(firstDay);
  thirdFriday.setDate(firstDay.getDate() + daysUntilFriday + 14);

  const timeDiff = thirdFriday.getTime() - now.getTime();
  let daysToExp = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  daysToExp = Math.max(daysToExp, 1);

  return {
    date: thirdFriday.toISOString().split('T')[0],
    days: daysToExp,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || 'all';

    if (endpoint === 'prices' || endpoint === 'all') {
      console.log('Fetching market prices and previous closes...');
      
      // Fetch all prices and previous closes in parallel (including NDX and SPX closes)
      const [qqq, nq, ndx, spy, es, spx, gld, gc, qqqPrevClose, spyPrevClose, ndxPrevClose, spxPrevClose] = await Promise.all([
        fetchYahooQuote('QQQ'),
        fetchYahooQuote('NQ=F'),
        fetchYahooQuote('%5ENDX'),
        fetchYahooQuote('SPY'),
        fetchYahooQuote('ES=F'),
        fetchYahooQuote('%5EGSPC'),
        fetchYahooQuote('GLD'),
        fetchYahooQuote('GC=F'),
        fetchPreviousClose('QQQ'),
        fetchPreviousClose('SPY'),
        fetchPreviousClose('%5ENDX'),
        fetchPreviousClose('%5EGSPC'),
      ]);

      console.log('Prices fetched:', { qqq, nq, ndx, spy, es, spx, gld, gc });
      console.log('Previous closes:', { qqqPrevClose, spyPrevClose, ndxPrevClose, spxPrevClose });

      // Calculate NDX/QQQ and SPX/SPY ratios from previous close
      const ndxQqqRatio = (ndxPrevClose && qqqPrevClose) 
        ? Math.round((ndxPrevClose / qqqPrevClose) * 10000) / 10000 
        : 41.1180; // Fallback ratio
      const spxSpyRatio = (spxPrevClose && spyPrevClose) 
        ? Math.round((spxPrevClose / spyPrevClose) * 10000) / 10000 
        : 10.0;

      console.log('Calculated ratios:', { ndxQqqRatio, spxSpyRatio });

      const marketData: MarketData = {
        qqq: qqq || 529.0,
        nq: nq || 22000.0,
        ndx: ndx || 21800.0,
        spy: spy || 595.0,
        es: es || 5961.0,
        spx: spx || 5950.0,
        gld: gld || 305.0,
        gc: gc || 3050.0,
        qqqPrevClose: qqqPrevClose || qqq || 529.0,
        spyPrevClose: spyPrevClose || spy || 595.0,
        ndxPrevClose: ndxPrevClose || ndx || 21800.0,
        spxPrevClose: spxPrevClose || spx || 5950.0,
        lastUpdate: new Date().toISOString(),
      };

      if (endpoint === 'prices') {
        return new Response(JSON.stringify(marketData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If 'all', continue to fetch params including QQQ/SPY dividend yields
      console.log('Fetching QQQ/SPY dividend yields and risk-free rate...');
      const [riskFreeRate, qqqDivYield, spyDivYield] = await Promise.all([
        fetchRiskFreeRate(),
        fetchETFDividendYield('QQQ'),
        fetchETFDividendYield('SPY'),
      ]);

      console.log('ETF yields fetched:', { riskFreeRate, qqqDivYield, spyDivYield });

      const expiration = getNextQuarterlyExpiration();

      const params: MarketParams = {
        riskFreeRate,
        ndxDivYield: qqqDivYield || 0.660,
        spxDivYield: spyDivYield || 1.130,
        daysToExp: expiration.days,
        nextExpiration: expiration.date,
        ndxQqqRatio,
        spxSpyRatio,
      };

      return new Response(
        JSON.stringify({ marketData, params }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (endpoint === 'params') {
      console.log('Fetching market parameters...');
      
      // Need previous closes for ratio calculation
      const [riskFreeRate, qqqDivYield, spyDivYield, qqqPrevClose, spyPrevClose, ndxPrevClose, spxPrevClose] = await Promise.all([
        fetchRiskFreeRate(),
        fetchETFDividendYield('QQQ'),
        fetchETFDividendYield('SPY'),
        fetchPreviousClose('QQQ'),
        fetchPreviousClose('SPY'),
        fetchPreviousClose('%5ENDX'),
        fetchPreviousClose('%5EGSPC'),
      ]);

      const ndxQqqRatio = (ndxPrevClose && qqqPrevClose) 
        ? Math.round((ndxPrevClose / qqqPrevClose) * 10000) / 10000 
        : 41.1180;
      const spxSpyRatio = (spxPrevClose && spyPrevClose) 
        ? Math.round((spxPrevClose / spyPrevClose) * 10000) / 10000 
        : 10.0;

      const expiration = getNextQuarterlyExpiration();

      const params: MarketParams = {
        riskFreeRate,
        ndxDivYield: qqqDivYield || 0.660,
        spxDivYield: spyDivYield || 1.130,
        daysToExp: expiration.days,
        nextExpiration: expiration.date,
        ndxQqqRatio,
        spxSpyRatio,
      };

      console.log('Params fetched:', params);

      return new Response(JSON.stringify(params), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint. Use: prices, params, or all' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Edge function error:', error);
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
