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

// Fetch index dividend yield from Yahoo Finance quoteSummary
async function fetchIndexDividendYield(symbol: string): Promise<number | null> {
  try {
    // For indices, we need to use the index symbol with proper encoding
    const encodedSymbol = encodeURIComponent(symbol);
    
    // Try to get dividend yield from the chart endpoint with events
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1d&range=1y&events=div`;
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
        console.log(`${symbol} calculated yield from dividends: ${yieldPct.toFixed(4)}%`);
        return Math.round(yieldPct * 10000) / 10000;
      }
    }

    // For indices like ^NDX and ^GSPC, use known institutional values
    // These are updated less frequently but more accurate
    if (symbol === '^NDX' || symbol === '%5ENDX') {
      console.log('Using institutional NDX dividend yield: 0.70%');
      return 0.70; // Nasdaq 100 index yield ~0.70%
    }
    if (symbol === '^GSPC' || symbol === '%5EGSPC') {
      console.log('Using institutional SPX dividend yield: 1.22%');
      return 1.22; // S&P 500 index yield ~1.22%
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

// Fetch Treasury rate (risk-free proxy)
async function fetchRiskFreeRate(): Promise<number> {
  try {
    // Try 13-week T-Bill rate
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
        // Add 0.5% spread and round to 1 decimal
        return Math.round((rate + 0.5) * 10) / 10;
      }
    }
  } catch (error) {
    console.error('Error fetching risk-free rate:', error);
  }
  
  return 4.5; // Default fallback
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

      // If 'all', continue to fetch params including real-time INDEX dividend yields
      console.log('Fetching INDEX dividend yields and risk-free rate...');
      const [riskFreeRate, ndxDivYield, spxDivYield] = await Promise.all([
        fetchRiskFreeRate(),
        fetchIndexDividendYield('%5ENDX'),
        fetchIndexDividendYield('%5EGSPC'),
      ]);

      console.log('Index yields fetched:', { riskFreeRate, ndxDivYield, spxDivYield });

      const expiration = getNextQuarterlyExpiration();

      const params: MarketParams = {
        riskFreeRate,
        ndxDivYield: ndxDivYield || 0.70,
        spxDivYield: spxDivYield || 1.22,
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
      const [riskFreeRate, ndxDivYield, spxDivYield, qqqPrevClose, spyPrevClose, ndxPrevClose, spxPrevClose] = await Promise.all([
        fetchRiskFreeRate(),
        fetchIndexDividendYield('%5ENDX'),
        fetchIndexDividendYield('%5EGSPC'),
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
        ndxDivYield: ndxDivYield || 0.70,
        spxDivYield: spxDivYield || 1.22,
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
