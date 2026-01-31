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
  lastUpdate: string;
}

interface MarketParams {
  riskFreeRate: number;
  ndxDivYield: number;
  spxDivYield: number;
  daysToExp: number;
  nextExpiration: string;
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

// Fetch dividend yield for ETF
async function fetchDividendYield(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const summaryDetail = data?.quoteSummary?.result?.[0]?.summaryDetail;
    
    if (summaryDetail?.dividendYield?.raw) {
      return Math.round(summaryDetail.dividendYield.raw * 10000) / 100; // Convert to percentage
    }

    if (summaryDetail?.trailingAnnualDividendYield?.raw) {
      return Math.round(summaryDetail.trailingAnnualDividendYield.raw * 10000) / 100;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching dividend yield for ${symbol}:`, error);
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
      console.log('Fetching market prices...');
      
      // Fetch all prices in parallel
      const [qqq, nq, ndx, spy, es, spx, gld, gc] = await Promise.all([
        fetchYahooQuote('QQQ'),
        fetchYahooQuote('NQ=F'),
        fetchYahooQuote('%5ENDX'),
        fetchYahooQuote('SPY'),
        fetchYahooQuote('ES=F'),
        fetchYahooQuote('%5EGSPC'),
        fetchYahooQuote('GLD'),
        fetchYahooQuote('GC=F'),
      ]);

      console.log('Prices fetched:', { qqq, nq, ndx, spy, es, spx, gld, gc });

      const marketData: MarketData = {
        qqq: qqq || 529.0,
        nq: nq || 22000.0,
        ndx: ndx || 21800.0,
        spy: spy || 595.0,
        es: es || 5961.0,
        spx: spx || 5950.0,
        gld: gld || 305.0,
        gc: gc || 3050.0,
        lastUpdate: new Date().toISOString(),
      };

      if (endpoint === 'prices') {
        return new Response(JSON.stringify(marketData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If 'all', continue to fetch params
      const [riskFreeRate, ndxDivYield, spxDivYield] = await Promise.all([
        fetchRiskFreeRate(),
        fetchDividendYield('QQQ'),
        fetchDividendYield('SPY'),
      ]);

      const expiration = getNextQuarterlyExpiration();

      const params: MarketParams = {
        riskFreeRate,
        ndxDivYield: ndxDivYield || 0.66,
        spxDivYield: spxDivYield || 1.13,
        daysToExp: expiration.days,
        nextExpiration: expiration.date,
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
      
      const [riskFreeRate, ndxDivYield, spxDivYield] = await Promise.all([
        fetchRiskFreeRate(),
        fetchDividendYield('QQQ'),
        fetchDividendYield('SPY'),
      ]);

      const expiration = getNextQuarterlyExpiration();

      const params: MarketParams = {
        riskFreeRate,
        ndxDivYield: ndxDivYield || 0.66,
        spxDivYield: spxDivYield || 1.13,
        daysToExp: expiration.days,
        nextExpiration: expiration.date,
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
