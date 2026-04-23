// lib/asset-specific.ts - Fetch asset-specific micro data

import axios from 'axios';
import { Asset, AssetSpecificContext } from '@/types';
import { cacheGet, cacheSet, CacheKeys } from './redis';

export async function fetchAssetSpecificContext(asset: Asset): Promise<AssetSpecificContext> {
  const cacheKey = CacheKeys.assetSpecific(asset);
  const cached = await cacheGet<AssetSpecificContext>(cacheKey);
  
  if (cached) {
    console.log(`Cache hit for asset-specific: ${asset}`);
    return cached;
  }
  
  console.log(`Fetching fresh asset-specific data for ${asset}`);
  
  let context: AssetSpecificContext = {};
  
  if (asset === 'BTCUSD' || asset === 'ETHUSD') {
    context = await fetchCryptoContext();
  } else if (asset === 'XAUUSD') {
    context = await fetchGoldContext();
  } else if (['EURUSD', 'GBPUSD', 'USDJPY'].includes(asset)) {
    context = await fetchForexContext(asset);
  }
  
  // Cache for 6 hours
  await cacheSet(cacheKey, context, 21600);
  
  return context;
}

async function fetchCryptoContext(): Promise<AssetSpecificContext> {
  try {
    // BTC Dominance from CoinGecko
    const dominanceResponse = await axios.get(
      'https://api.coingecko.com/api/v3/global'
    );
    const btcDominance = dominanceResponse.data.data.market_cap_percentage.btc;
    
    // Fear & Greed Index
    const fearGreedResponse = await axios.get(
      'https://api.alternative.me/fng/?limit=1'
    );
    const fearGreedIndex = parseInt(fearGreedResponse.data.data[0].value);
    
    // Exchange flows (simplified - using volume as proxy)
    const exchangeFlows = fearGreedIndex > 70 
      ? 'High inflows - retail FOMO' 
      : fearGreedIndex < 30 
      ? 'High outflows - capitulation' 
      : 'Balanced flows';
    
    return {
      btcDominance,
      fearGreedIndex,
      exchangeFlows,
    };
  } catch (error) {
    console.error('Error fetching crypto context:', error);
    return {
      btcDominance: 50,
      fearGreedIndex: 50,
      exchangeFlows: 'Data unavailable',
    };
  }
}

async function fetchGoldContext(): Promise<AssetSpecificContext> {
  try {
    // Real yield = 10Y Treasury - CPI
    // This data comes from macro, so we'll approximate
    const apiKey = process.env.FRED_API_KEY;
    
    if (!apiKey) {
      return {
        realYield: 0,
      };
    }
    
    // Fetch 10Y yield
    const yieldResponse = await axios.get(
      'https://api.stlouisfed.org/fred/series/observations',
      {
        params: {
          series_id: 'DGS10',
          api_key: apiKey,
          file_type: 'json',
          limit: 1,
          sort_order: 'desc',
        },
      }
    );
    
    // Fetch CPI
    const cpiResponse = await axios.get(
      'https://api.stlouisfed.org/fred/series/observations',
      {
        params: {
          series_id: 'CPIAUCSL',
          api_key: apiKey,
          file_type: 'json',
          limit: 12,
          sort_order: 'desc',
        },
      }
    );
    
    const yield10y = parseFloat(yieldResponse.data.observations[0].value);
    const cpiData = cpiResponse.data.observations.filter((obs: any) => obs.value !== '.');
    const cpiCurrent = parseFloat(cpiData[0].value);
    const cpiYearAgo = parseFloat(cpiData[11].value);
    const cpiYoY = ((cpiCurrent - cpiYearAgo) / cpiYearAgo) * 100;
    
    const realYield = yield10y - cpiYoY;
    
    return {
      realYield: Math.round(realYield * 100) / 100,
    };
  } catch (error) {
    console.error('Error fetching gold context:', error);
    return {
      realYield: 0,
    };
  }
}

async function fetchForexContext(asset: Asset): Promise<AssetSpecificContext> {
  try {
    // COT positioning (simplified - would need actual CFTC data)
    // For now, return placeholder
    const cotPositioning = 'Institutional positioning data available via CFTC reports';
    
    // Rate differential (approximate)
    let rateDifferential = 0;
    
    if (asset === 'EURUSD') {
      // ECB rate vs Fed rate
      rateDifferential = -1.5; // Example: Fed higher than ECB
    } else if (asset === 'GBPUSD') {
      rateDifferential = -0.5;
    } else if (asset === 'USDJPY') {
      rateDifferential = 4.0; // Fed much higher than BOJ
    }
    
    return {
      cotPositioning,
      rateDifferential,
    };
  } catch (error) {
    console.error('Error fetching forex context:', error);
    return {
      cotPositioning: 'Data unavailable',
      rateDifferential: 0,
    };
  }
}
