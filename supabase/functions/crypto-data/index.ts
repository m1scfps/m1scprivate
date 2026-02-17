import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
}

interface CryptoSector {
  name: string;
  performance24h: number;
  topCoin: string;
}

interface CryptoData {
  timestamp: string;
  btc: CryptoAsset;
  eth: CryptoAsset;
  topAltcoins: CryptoAsset[];
  btcDominance: number;
  ethDominance: number;
  totalMarketCap: number;
  totalVolume24h: number;
  fearGreedIndex: { value: number; label: string };
  sectorRotation: CryptoSector[];
  btcEtfFlow: {
    signal: string;
    description: string;
  };
  moneyFlow: {
    direction: string;
    signal: string;
    btcVsAlts: string;
    defiTvlTrend: string;
  };
}

// Fetch from CoinGecko free API
async function fetchCoinGeckoMarkets(): Promise<any[]> {
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d';
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      console.error('CoinGecko markets error:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return [];
  }
}

// Fetch global data (dominance, total market cap)
async function fetchGlobalData(): Promise<any> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.data || null;
  } catch (error) {
    console.error('Global data error:', error);
    return null;
  }
}

// Fetch Fear & Greed Index
async function fetchFearGreed(): Promise<{ value: number; label: string }> {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!response.ok) return { value: 50, label: 'Neutral' };
    const data = await response.json();
    const entry = data?.data?.[0];
    return {
      value: parseInt(entry?.value || '50'),
      label: entry?.value_classification || 'Neutral',
    };
  } catch {
    return { value: 50, label: 'Neutral' };
  }
}

// Categorize coins into sectors
function categorizeSectors(coins: any[]): CryptoSector[] {
  const sectorMap: Record<string, { ids: string[]; label: string }> = {
    'Majors': { ids: ['bitcoin', 'ethereum', 'solana', 'cardano', 'avalanche-2', 'polkadot', 'chainlink'], label: 'Majors' },
    'DeFi': { ids: ['uniswap', 'aave', 'maker', 'lido-dao', 'jupiter-exchange-solana', 'raydium', 'curve-dao-token', 'compound-governance-token'], label: 'DeFi' },
    'Layer 2': { ids: ['matic-network', 'arbitrum', 'optimism', 'starknet', 'immutable-x'], label: 'Layer 2' },
    'Memes': { ids: ['dogecoin', 'shiba-inu', 'pepe', 'floki', 'bonk', 'dogwifcoin', 'brett'], label: 'Memes' },
    'AI & Data': { ids: ['render-token', 'fetch-ai', 'the-graph', 'ocean-protocol', 'singularitynet', 'bittensor', 'near'], label: 'AI & Data' },
    'Gaming': { ids: ['immutable-x', 'axie-infinity', 'the-sandbox', 'gala', 'illuvium', 'beam-2'], label: 'Gaming' },
  };

  const sectors: CryptoSector[] = [];

  for (const [sectorName, config] of Object.entries(sectorMap)) {
    const sectorCoins = coins.filter(c => config.ids.includes(c.id));
    if (sectorCoins.length === 0) continue;

    const avgPerf = sectorCoins.reduce((sum: number, c: any) => sum + (c.price_change_percentage_24h_in_currency || 0), 0) / sectorCoins.length;
    const topCoin = sectorCoins.reduce((best: any, c: any) =>
      (c.price_change_percentage_24h_in_currency || 0) > (best.price_change_percentage_24h_in_currency || 0) ? c : best
    );

    sectors.push({
      name: sectorName,
      performance24h: avgPerf,
      topCoin: `${topCoin.symbol.toUpperCase()} (${(topCoin.price_change_percentage_24h_in_currency || 0).toFixed(1)}%)`,
    });
  }

  return sectors.sort((a, b) => b.performance24h - a.performance24h);
}

function mapCoin(coin: any): CryptoAsset {
  return {
    id: coin.id,
    symbol: coin.symbol?.toUpperCase() || '',
    name: coin.name || '',
    price: coin.current_price || 0,
    change24h: coin.price_change_percentage_24h_in_currency || coin.price_change_percentage_24h || 0,
    change7d: coin.price_change_percentage_7d_in_currency || 0,
    marketCap: coin.market_cap || 0,
    volume24h: coin.total_volume || 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching crypto data...');

    const [markets, globalData, fearGreed] = await Promise.all([
      fetchCoinGeckoMarkets(),
      fetchGlobalData(),
      fetchFearGreed(),
    ]);

    const btcData = markets.find((c: any) => c.id === 'bitcoin');
    const ethData = markets.find((c: any) => c.id === 'ethereum');

    const btc: CryptoAsset = btcData ? mapCoin(btcData) : { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 0, change24h: 0, change7d: 0, marketCap: 0, volume24h: 0 };
    const eth: CryptoAsset = ethData ? mapCoin(ethData) : { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 0, change24h: 0, change7d: 0, marketCap: 0, volume24h: 0 };

    // Top altcoins (exclude BTC, ETH, stablecoins)
    const stableIds = ['tether', 'usd-coin', 'dai', 'first-digital-usd', 'ethena-usde', 'usds'];
    const topAltcoins = markets
      .filter((c: any) => !['bitcoin', 'ethereum'].includes(c.id) && !stableIds.includes(c.id))
      .slice(0, 10)
      .map(mapCoin);

    const btcDominance = globalData?.market_cap_percentage?.btc || 0;
    const ethDominance = globalData?.market_cap_percentage?.eth || 0;
    const totalMarketCap = globalData?.total_market_cap?.usd || 0;
    const totalVolume24h = globalData?.total_volume?.usd || 0;

    // Sector rotation
    const sectorRotation = categorizeSectors(markets);

    // ETF flow signal (derived from BTC price action + volume)
    const btcVolRatio = btcData ? (btcData.total_volume / btcData.market_cap) : 0;
    let etfSignal = 'NEUTRAL';
    let etfDescription = 'Normal trading volume';
    if (btcVolRatio > 0.05 && btc.change24h > 1) {
      etfSignal = 'INFLOW';
      etfDescription = 'High volume + price up suggests strong ETF inflows';
    } else if (btcVolRatio > 0.05 && btc.change24h < -1) {
      etfSignal = 'OUTFLOW';
      etfDescription = 'High volume + price down suggests ETF outflows';
    } else if (btc.change24h > 2) {
      etfSignal = 'LIKELY INFLOW';
      etfDescription = 'Strong price action suggests accumulation';
    } else if (btc.change24h < -2) {
      etfSignal = 'LIKELY OUTFLOW';
      etfDescription = 'Weak price action suggests distribution';
    }

    // Money flow analysis
    const altAvgChange = topAltcoins.length > 0
      ? topAltcoins.reduce((sum, a) => sum + a.change24h, 0) / topAltcoins.length
      : 0;

    let moneyDirection = 'NEUTRAL';
    let moneySignal = 'Balanced flows';
    let btcVsAlts = 'NEUTRAL';

    if (btc.change24h > 1 && altAvgChange > btc.change24h) {
      moneyDirection = 'RISK-ON';
      moneySignal = '🟢 Money flowing into alts - risk appetite increasing';
      btcVsAlts = 'ALTS OUTPERFORM';
    } else if (btc.change24h > 1 && altAvgChange < btc.change24h) {
      moneyDirection = 'BTC ACCUMULATION';
      moneySignal = '🟡 BTC outperforming - flight to quality within crypto';
      btcVsAlts = 'BTC OUTPERFORMS';
    } else if (btc.change24h < -1 && altAvgChange < btc.change24h) {
      moneyDirection = 'RISK-OFF';
      moneySignal = '🔴 Alts dumping harder - risk-off environment';
      btcVsAlts = 'ALTS UNDERPERFORM';
    } else if (btc.change24h < -1) {
      moneyDirection = 'BROAD SELLING';
      moneySignal = '🔴 Broad market selling pressure';
      btcVsAlts = 'CORRELATED SELL';
    }

    // DeFi TVL trend estimation from DeFi sector performance
    const defiSector = sectorRotation.find(s => s.name === 'DeFi');
    const defiTvlTrend = defiSector
      ? (defiSector.performance24h > 1 ? 'GROWING' : defiSector.performance24h < -1 ? 'DECLINING' : 'STABLE')
      : 'UNKNOWN';

    const response: CryptoData = {
      timestamp: new Date().toISOString(),
      btc,
      eth,
      topAltcoins,
      btcDominance,
      ethDominance,
      totalMarketCap,
      totalVolume24h,
      fearGreedIndex: fearGreed,
      sectorRotation,
      btcEtfFlow: { signal: etfSignal, description: etfDescription },
      moneyFlow: {
        direction: moneyDirection,
        signal: moneySignal,
        btcVsAlts,
        defiTvlTrend,
      },
    };

    console.log('Crypto data fetched successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Crypto data error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
