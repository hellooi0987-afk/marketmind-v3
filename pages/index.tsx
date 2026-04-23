// pages/index.tsx - MarketMind v3 — All data from real APIs, zero hardcoded values
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// ── Static config only (not data) ──────────────────────────────────────────
const ASSETS = [
  { sym: 'BTCUSD', label: 'BTC/USD', type: 'CRYPTO' },
  { sym: 'ETHUSD', label: 'ETH/USD', type: 'CRYPTO' },
  { sym: 'XAUUSD', label: 'XAU/USD', type: 'GOLD'   },
  { sym: 'EURUSD', label: 'EUR/USD', type: 'FOREX'  },
  { sym: 'GBPUSD', label: 'GBP/USD', type: 'FOREX'  },
  { sym: 'USDJPY', label: 'USD/JPY', type: 'FOREX'  },
  { sym: 'SPX500', label: 'SPX 500', type: 'INDEX'  },
  { sym: 'CRUDE',  label: 'WTI Oil', type: 'COMMOD' },
];

const TV_SYMBOLS: Record<string, string> = {
  BTCUSD: 'COINBASE:BTCUSD', ETHUSD: 'COINBASE:ETHUSD',
  XAUUSD: 'OANDA:XAUUSD',   EURUSD: 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',      USDJPY: 'FX:USDJPY',
  SPX500: 'SP:SPX',          CRUDE:  'TVC:USOIL',
};

const AGENTS_META = [
  { id: 'maya',   name: 'Maya Chen',      role: 'Retail Trader',         model: 'Claude 3.5', color: '#00E5FF', emoji: '👤', desc: 'Momentum-driven retail trader. Buys breakouts, influenced by news sentiment, cuts losses slowly. Specialises in 1-4H timeframes.', edge: 'Catches momentum breakouts early. Loses on reversals.',     bestRegime: 'Bull trending markets' },
  { id: 'victor', name: 'Victor Hale',    role: 'Hedge Fund Macro',      model: 'GPT-4o',     color: '#5B6EF5', emoji: '💼', desc: '20-year macro veteran. Fades retail sentiment. Focuses on COT positioning, DXY correlation, and whether news is already priced in.', edge: 'Contrarian edge. Fades retail sentiment at extremes.',       bestRegime: 'High VIX, reversals' },
  { id: 'alpha',  name: 'Alpha-7',        role: 'Quant Algorithm',       model: 'Gemini 1.5', color: '#2DD4BF', emoji: '⚡', desc: 'Pure price action system. Ignores all news. Requires confirmed breakout with volume. Uses Z-scores and statistical edge detection.', edge: 'Highest frequency. Pure technicals, no narrative bias.',       bestRegime: 'Trending low-VIX' },
  { id: 'chen',   name: 'Dr. Sarah Chen', role: 'Central Bank Econ.',    model: 'Claude 3.5', color: '#C084FC', emoji: '🏛', desc: 'Focuses on inflation cycles, rate policy, and yield curve dynamics. Very long timeframe. Risk-averse institutional perspective.', edge: 'Best at macro regime changes. Low frequency, high accuracy.', bestRegime: 'Macro regime transitions' },
  { id: 'jake',   name: 'Jake Morrison',  role: 'Order Flow Specialist', model: 'GPT-4o',     color: '#F472B6', emoji: '📊', desc: 'Reads institutional footprint via volume delta, absorption zones, iceberg orders, and volume profile analysis at key levels.', edge: 'Spots institutional accumulation before price moves.',        bestRegime: 'Range-bound markets' },
  { id: 'aisha',  name: 'Aisha Okonkwo',  role: 'Smart Money Concepts',  model: 'Gemini 1.5', color: '#FFB800', emoji: '🎯', desc: 'Order blocks, fair value gaps, market structure shifts, and liquidity sweeps. Trades institutional footprint with SMC methodology.', edge: 'Identifies liquidity sweeps before direction change.',        bestRegime: 'Post-sweep continuation' },
];

// ── Types ──────────────────────────────────────────────────────────────────
interface MacroData {
  fedRate: number; fedDirection: string;
  cpi: number; cpiTrend: string;
  gdp: number; unemployment: number;
  yieldSpread: number; yieldInterpretation: string;
  dxy: number; dxyImpact: string;
  vix: number; vixRegime: string;
}
interface Indicators {
  rsi: number[]; macd: { histogram: number; signal: number; macd: number };
  atr: number; atrPct: number;
  bollinger: { upper: number; mid: number; lower: number; position: string };
  ema: { ema20: number; ema50: number; ema200: number; trend: string };
  volume: { current: number; avg20: number; pct: number };
  pivots: { r3: number; r2: number; r1: number; s1: number; s2: number; s3: number };
}
interface AgentPerf { totalPredictions: number; correctPredictions: number; winRate: number; avgConfidence: number; calibration: string; }

// ── Component ──────────────────────────────────────────────────────────────
export default function Home() {
  const [activeTab, setActiveTab]       = useState('simulate');
  const [asset, setAsset]               = useState('BTCUSD');
  const [tf, setTf]                     = useState('4h');
  const [loading, setLoading]           = useState(false);
  const [loadingMsg, setLoadingMsg]     = useState('');

  // Live price (fetched on asset select)
  const [price, setPrice]               = useState<number | null>(null);
  const [change, setChange]             = useState<number | null>(null);
  const [priceSource, setPriceSource]   = useState('');

  // Simulation results
  const [verdicts, setVerdicts]         = useState<any[]>([]);
  const [consensus, setConsensus]       = useState<any>(null);
  const [debateData, setDebateData]     = useState<any>(null);
  const [indicators, setIndicators]     = useState<Indicators | null>(null);

  // Macro tab
  const [macro, setMacro]               = useState<MacroData | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);

  // Agents tab — real performance from vector DB
  const [agentPerfs, setAgentPerfs]     = useState<Record<string, AgentPerf>>({});
  const [perfsLoading, setPerfsLoading] = useState(false);

  // History tab — stored in state after each simulation
  const [simHistory, setSimHistory]     = useState<any[]>([]);
  const [histFilter, setHistFilter]     = useState('all');

  const tvRef = useRef<any>(null);

  // Load TradingView chart
  useEffect(() => { setTimeout(() => loadTVChart('BTCUSD', '240'), 600); }, []);

  function loadTVChart(sym: string, interval: string) {
    if (typeof window === 'undefined' || !(window as any).TradingView) return;
    if (tvRef.current) { try { tvRef.current.remove(); } catch (e) {} }
    tvRef.current = new (window as any).TradingView.widget({
      container_id: 'tv-chart', symbol: TV_SYMBOLS[sym] || 'COINBASE:BTCUSD',
      interval, timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en',
      toolbar_bg: '#0A0D18', enable_publishing: false, hide_side_toolbar: false,
      allow_symbol_change: false, save_image: false, height: 360, width: '100%',
      backgroundColor: '#060810',
    });
  }

  // Fetch live price when asset changes
  async function fetchLivePrice(sym: string) {
    try {
      const res = await fetch(`/api/ingest?asset=${sym}&timeframe=4h`);
      const data = await res.json();
      if (!data.error) {
        setPrice(data.currentPrice);
        setChange(data.change24h);
        setPriceSource(data.agentContexts?.['Maya Chen']?.source || '');
        if (data.agentContexts?.['Maya Chen']?.indicators) {
          setIndicators(data.agentContexts['Maya Chen'].indicators);
        }
      }
    } catch (e) { /* silent */ }
  }

  async function selectAsset(sym: string) {
    setAsset(sym);
    setVerdicts([]); setConsensus(null); setDebateData(null);
    setPrice(null); setChange(null); setIndicators(null);
    loadTVChart(sym, '240');
    await fetchLivePrice(sym);
  }
<link rel="stylesheet" href="/responsive.css" />
  // Run full simulation
  async function runSimulation() {
    setLoading(true); setLoadingMsg('Fetching market data...');
    setVerdicts([]); setConsensus(null); setDebateData(null);
    try {
      setLoadingMsg('Assembling agent context...');
      const ctxRes  = await fetch(`/api/ingest?asset=${asset}&timeframe=${tf}`);
      const ctxData = await ctxRes.json();
      if (ctxData.error) throw new Error(ctxData.error);
      setPrice(ctxData.currentPrice);
      setChange(ctxData.change24h);
      if (ctxData.agentContexts?.['Maya Chen']?.indicators) {
        setIndicators(ctxData.agentContexts['Maya Chen'].indicators);
      }

      setLoadingMsg('Running 6 AI agents in parallel...');
      const simRes  = await fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, agentContexts: ctxData.agentContexts }),
      });
      const simData = await simRes.json();
      if (simData.error) throw new Error(simData.error);
      setVerdicts(simData.verdicts); setConsensus(simData.consensus);

      setLoadingMsg('Initiating agent debate...');
      const debRes  = await fetch('/api/debate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, verdicts: simData.verdicts, rounds: 2 }),
      });
      const debData = await debRes.json();
      if (debData.error) throw new Error(debData.error);
      setDebateData(debData);
      setVerdicts(debData.finalVerdicts);
      setConsensus(debData.finalConsensus);

      // Save to local history
      setSimHistory(prev => [{
        asset, tf, consensus: debData.finalConsensus,
        price: ctxData.currentPrice, change: ctxData.change24h,
        date: new Date().toLocaleString(), verdicts: debData.finalVerdicts,
      }, ...prev].slice(0, 20));
    } catch (err: any) { alert(`Simulation failed: ${err.message}`); }
    finally { setLoading(false); }
  }

  // Fetch macro when macro tab opens
  async function openMacro() {
    setActiveTab('macro');
    if (macro) return;
    setMacroLoading(true);
    try {
      const res  = await fetch(`/api/macro?asset=${asset}`);
      const data = await res.json();
      if (!data.error) setMacro(data.macro);
    } catch (e) { /* silent */ }
    finally { setMacroLoading(false); }
  }

  // Fetch agent performance from vector DB when agents tab opens
  async function openAgents() {
    setActiveTab('agents');
    if (Object.keys(agentPerfs).length > 0) return;
    setPerfsLoading(true);
    const perfs: Record<string, AgentPerf> = {};
    await Promise.all(AGENTS_META.map(async (a) => {
      try {
        const res  = await fetch(`/api/memory?agent=${encodeURIComponent(a.name)}&asset=${asset}`);
        const data = await res.json();
        if (data.performance) perfs[a.name] = data.performance;
      } catch (e) { /* silent */ }
    }));
    setAgentPerfs(perfs); setPerfsLoading(false);
  }

  const filteredHistory = histFilter === 'all' ? simHistory
    : simHistory.filter(h => h.consensus?.signal === histFilter);

  const rsiVal = indicators?.rsi?.[indicators.rsi.length - 1];

  return (
    <>
      <Head>
        <title>MarketMind v3 — Autonomous Market Intelligence</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
        <script src="https://s3.tradingview.com/tv.js" />
      </Head>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p className="loading-msg">{loadingMsg}</p>
        </div>
      )}
      <div className="scanline" />

      {/* ── HEADER ── */}
      <header className="header">
        <div className="logo"><div className="logo-icon"><div className="logo-dot" /></div>MarketMind v3</div>
        <nav className="nav">
          {([['simulate','◎','Simulate'],['backtest','◈','Backtest'],['macro','◐','Macro'],['agents','◇','Agents'],['history','◫','History']] as [string,string,string][]).map(([tab,icon,label]) => (
            <button key={tab} className={`nav-btn${activeTab===tab?' active':''}`}
              onClick={() => tab==='macro' ? openMacro() : tab==='agents' ? openAgents() : setActiveTab(tab)}>
              <span className="nav-icon">{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="badge v3">v3.0</span>
          <span className="badge live">Live</span>
        </div>
      </header>

      {/* ══ SIMULATE ══ */}
      {activeTab === 'simulate' && (
        <div className="sim-layout">
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="slab">Asset</div>
              <div className="asset-grid">
                {ASSETS.map(a => (
                  <button key={a.sym} className={`asset-btn${asset===a.sym?' active':''}`} onClick={() => selectAsset(a.sym)}>
                    <span className="sym">{a.label}</span><span className="typ">{a.type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live price card — real data only */}
            <div className="sidebar-section">
              <div className="slab">Market Data</div>
              <div className="live-card">
                {price ? (
                  <>
                    <div className="live-price">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <span className={`live-change ${change && change >= 0 ? 'up' : 'down'}`}>{change && change >= 0 ? '▲' : '▼'} {Math.abs(change ?? 0).toFixed(2)}%</span>
                    <div className="live-source">{priceSource}</div>
                    {indicators && (
                      <div className="live-indicators">
                        <div className="ind-row"><span>RSI(14)</span><span className={rsiVal && rsiVal > 70 ? 'warn' : rsiVal && rsiVal < 30 ? 'good' : ''}>{rsiVal?.toFixed(1)}</span></div>
                        <div className="ind-row"><span>ATR</span><span>{indicators.atr.toFixed(2)} ({indicators.atrPct.toFixed(1)}%)</span></div>
                        <div className="ind-row"><span>EMA trend</span><span>{indicators.ema.trend.split(' ')[0]}</span></div>
                        <div className="ind-row"><span>Vol vs avg</span><span className={indicators.volume.pct > 120 ? 'warn' : ''}>{indicators.volume.pct.toFixed(0)}%</span></div>
                        <div className="ind-row"><span>BB position</span><span>{indicators.bollinger.position}</span></div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="live-empty">Select an asset to load live data</div>
                )}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="slab">Timeframe</div>
              <div className="tf-tabs">
                {['1h','4h','1d'].map(t => (
                  <button key={t} className={`tf-tab${tf===t?' active':''}`} onClick={() => setTf(t)}>{t}</button>
                ))}
              </div>
            </div>

            <button className="run-btn" onClick={runSimulation} disabled={loading}>
              {loading ? '◌ Running...' : '▶ Run Autonomous Simulation'}
            </button>

            <div className="sidebar-section">
              <div className="slab">Active Agents</div>
              {AGENTS_META.map(a => (
                <div key={a.id} className="roster-item">
                  <div className="roster-dot" style={{ background: a.color }} />
                  <div style={{ flex: 1 }}>
                    <div className="roster-name">{a.name}</div>
                    <div className="roster-model">{a.model}</div>
                  </div>
                  <div className="roster-role">{a.role.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </aside>

          <main className="results-area">
            {/* TradingView chart */}
            <div className="chart-panel">
              <div className="chart-panel-head">
                <div className="chart-label"><span className="chart-live-dot" />Live Chart — {asset}</div>
                <div className="chart-tfs">
                  {[['60','1H'],['240','4H'],['D','1D'],['W','1W']].map(([v,l]) => (
                    <button key={v} className="chart-tf-btn" onClick={() => loadTVChart(asset, v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ height: 360 }} id="tv-chart" />
              {/* Real indicator strip */}
              {indicators && (
                <div className="pa-strip">
                  <div className="pa-cell">
                    <div className="pa-label">EMA Trend</div>
                    <div className="pa-val">{indicators.ema.trend}</div>
                  </div>
                  <div className="pa-cell">
                    <div className="pa-label">Key Levels (Pivot)</div>
                    <div style={{ fontSize: 11 }}>
                      <span className="pa-val up">R1 ${indicators.pivots.r1.toFixed(2)}</span>
                      <span style={{ color: '#2E3652' }}> · </span>
                      <span className="pa-val down">S1 ${indicators.pivots.s1.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="pa-cell">
                    <div className="pa-label">RSI · ATR%</div>
                    <div className="pa-val warn">RSI {rsiVal?.toFixed(1)} · ATR {indicators.atrPct.toFixed(2)}%</div>
                  </div>
                </div>
              )}
            </div>

            {/* Empty state */}
            {!verdicts.length && (
              <div className="empty-state">
                <div className="empty-ring"><div className="empty-ring-dot" /></div>
                <div className="empty-title">Ready to simulate</div>
                <div className="empty-body">Select an asset · choose timeframe · run 6-agent simulation with live macro context and agent debate</div>
              </div>
            )}

            {/* Consensus — real data */}
            {consensus && (
              <div className="consensus-block">
                <div className="consensus-top">
                  <div>
                    <div className={`consensus-verdict ${consensus.signal}`}>{consensus.signal}</div>
                    <div className="consensus-conf">
                      {debateData ? 'Post-debate · ' : ''}{consensus.strength?.toFixed(0)}% strength · avg confidence {consensus.averageConfidence?.toFixed(1)}/10
                    </div>
                  </div>
                  <div className="breakdown">
                    <span className="bd-buy">BUY <b>{consensus.breakdown?.buy}</b></span>
                    <span className="bd-sell">SELL <b>{consensus.breakdown?.sell}</b></span>
                    <span className="bd-hold">HOLD <b>{consensus.breakdown?.hold}</b></span>
                  </div>
                </div>
                <div className="score-bar">
                  {(consensus.breakdown?.buy  > 0) && <div className="score-seg buy"  style={{ flex: consensus.breakdown.buy  }}>BUY {consensus.breakdown.buy}</div>}
                  {(consensus.breakdown?.hold > 0) && <div className="score-seg hold" style={{ flex: consensus.breakdown.hold }}>HOLD {consensus.breakdown.hold}</div>}
                  {(consensus.breakdown?.sell > 0) && <div className="score-seg sell" style={{ flex: consensus.breakdown.sell }}>SELL {consensus.breakdown.sell}</div>}
                </div>
              </div>
            )}

            {/* Debate turning points */}
            {debateData?.turningPoints?.length > 0 && (
              <div className="debate-section">
                <div className="sec">🔄 Debate — Position Changes</div>
                {debateData.turningPoints.map((tp: any, i: number) => (
                  <div key={i} className="turning-point">
                    <div className="tp-top">
                      <strong>{tp.agent}</strong>
                      <span className="tp-round">Round {tp.round}</span>
                      <span className="tp-change">{tp.change}</span>
                    </div>
                    <p className="tp-reason">"{tp.reasoning}"</p>
                  </div>
                ))}
              </div>
            )}

            {/* Agent verdicts — real AI output */}
            {verdicts.length > 0 && (
              <div>
                <div className="sec">Agent Verdicts</div>
                <div className="agents-grid">
                  {verdicts.map((v: any, i: number) => {
                    const meta = AGENTS_META.find(a => a.name === v.agent);
                    return (
                      <div key={i} className="agent-card" style={{ borderTopColor: meta?.color || '#00E5FF' }}>
                        <div className="agent-card-head">
                          <div className="agent-emoji">{meta?.emoji}</div>
                          <div>
                            <div className="agent-name">{v.agent}</div>
                            <div className="agent-role">{v.role}</div>
                          </div>
                          <span className={`action-badge ${v.action?.toLowerCase()}`}>{v.action}</span>
                        </div>
                        <div className="conf-row">
                          <span className="conf-label">Confidence</span>
                          <span className="conf-val">{v.confidence}/10</span>
                        </div>
                        <div className="conf-bar">
                          <div className="conf-fill" style={{ width: `${v.confidence * 10}%`, background: meta?.color || '#00E5FF' }} />
                        </div>
                        <div className="verdict-details">
                          <div><span className="vd-label">Target</span><span>{v.priceTarget}</span></div>
                          <div><span className="vd-label">Stop</span><span>{v.stopLoss}</span></div>
                          <div><span className="vd-label">Time</span><span>{v.timeframe}</span></div>
                        </div>
                        <p className="reasoning">{v.reasoning}</p>
                        {v.keyRisk && <div className="risk-row">⚠ {v.keyRisk}</div>}
                        {v.historicalAnalogy && <div className="analogy-row">📚 {v.historicalAnalogy}</div>}
                        {v.macroAlignment && <div className="macro-row">🌐 {v.macroAlignment}</div>}
                        {v.positionChanged && <div className="changed-badge">✨ Position changed after debate</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ══ BACKTEST ══ */}
      {activeTab === 'backtest' && (
        <div className="page-layout"><div className="page-content">
          <div className="page-title">Backtesting Engine</div>
          <div className="page-sub">Phase 4 — Coming soon. Will replay historical price data through all 6 agents and score accuracy.</div>
          <div className="coming-soon-box">
            <div className="cs-icon">◈</div>
            <div className="cs-title">Backtest Engine — Phase 4</div>
            <div className="cs-body">This module will backtest all 6 agents across 5 years of OHLC data, compute per-agent win rates, Sharpe ratios, drawdowns, and best macro regimes — using the same AI models and prompts as the live simulation.</div>
          </div>
        </div></div>
      )}

      {/* ══ MACRO ══ */}
      {activeTab === 'macro' && (
        <div className="page-layout"><div className="page-content">
          <div className="macro-header-row">
            <div className="page-title">Macro Dashboard</div>
            {macro && <div className="regime-badge">{macro.vix > 25 ? '⚠ High Volatility' : macro.fedDirection === 'Hiking' ? '⚠ Rate Hike Cycle' : macro.yieldSpread < -50 ? '⚠ Deeply Inverted' : '◎ ' + macro.fedDirection}</div>}
          </div>
          {macroLoading && <div className="loading-inline">Loading macro data from FRED API...</div>}
          {!macroLoading && !macro && <div className="loading-inline">Click the Macro tab again or run a simulation first to load live data.</div>}
          {macro && (
            <>
              <div className="macro-grid">
                <div className="macro-big-card">
                  <div className="macro-big-label">Federal Funds Rate</div>
                  <div className="macro-big-val">{macro.fedRate.toFixed(2)}%</div>
                  <div className="macro-big-sub">Direction: {macro.fedDirection}</div>
                  <div className={`macro-trend ${macro.fedDirection==='Cutting'?'bull':macro.fedDirection==='Hiking'?'bear':'neutral'}`}>{macro.fedDirection==='Cutting'?'↓ Cutting':'→ '+macro.fedDirection}</div>
                </div>
                <div className="macro-big-card">
                  <div className="macro-big-label">CPI YoY Inflation</div>
                  <div className="macro-big-val">{macro.cpi.toFixed(2)}%</div>
                  <div className="macro-big-sub">Trend: {macro.cpiTrend}</div>
                  <div className={`macro-trend ${macro.cpiTrend==='Falling'?'bull':'bear'}`}>{macro.cpiTrend==='Falling'?'↓ Cooling':'↑ Rising'}</div>
                </div>
                <div className="macro-big-card">
                  <div className="macro-big-label">GDP Growth (QoQ)</div>
                  <div className="macro-big-val">{macro.gdp.toFixed(2)}%</div>
                  <div className="macro-big-sub">Annualised rate</div>
                  <div className={`macro-trend ${macro.gdp>2?'bull':macro.gdp<0?'bear':'neutral'}`}>{macro.gdp>2?'↑ Strong':macro.gdp<0?'↓ Contraction':'→ Moderate'}</div>
                </div>
                <div className="macro-big-card">
                  <div className="macro-big-label">Unemployment</div>
                  <div className="macro-big-val">{macro.unemployment.toFixed(1)}%</div>
                  <div className="macro-big-sub">US unemployment rate</div>
                  <div className={`macro-trend ${macro.unemployment<4?'bull':macro.unemployment>6?'bear':'neutral'}`}>{macro.unemployment<4?'◎ Near full employment':'→ '+macro.unemployment.toFixed(1)+'%'}</div>
                </div>
                <div className="macro-big-card">
                  <div className="macro-big-label">Yield Curve (10Y–2Y)</div>
                  <div className="macro-big-val">{macro.yieldSpread.toFixed(0)}bp</div>
                  <div className="macro-big-sub">{macro.yieldInterpretation}</div>
                  <div className={`macro-trend ${macro.yieldSpread<0?'bear':'bull'}`}>{macro.yieldSpread<0?'⚠ Inverted':'◎ Normal'}</div>
                </div>
                <div className="macro-big-card">
                  <div className="macro-big-label">VIX Fear Index</div>
                  <div className="macro-big-val">{macro.vix.toFixed(1)}</div>
                  <div className="macro-big-sub">{macro.vixRegime}</div>
                  <div className={`macro-trend ${macro.vix<15?'bull':macro.vix>25?'bear':'neutral'}`}>{macro.vix<15?'◎ Low vol':macro.vix>25?'⚠ High vol':'→ Moderate'}</div>
                </div>
              </div>
              <div className="macro-extra-row">
                <div className="macro-extra-card">
                  <div className="macro-big-label">DXY (Dollar Index)</div>
                  <div className="macro-big-val">{macro.dxy.toFixed(2)}</div>
                  <div className="macro-big-sub">Impact on {asset}: {macro.dxyImpact}</div>
                </div>
              </div>
            </>
          )}
        </div></div>
      )}

      {/* ══ AGENTS ══ */}
      {activeTab === 'agents' && (
        <div className="page-layout"><div className="page-content">
          <div className="page-title">Agent Profiles</div>
          <div className="page-sub">6 independent AI agents — different models, different trading psychology. Performance data from live simulation memory.</div>
          {perfsLoading && <div className="loading-inline">Loading performance data from vector memory...</div>}
          <div className="agent-profiles-grid">
            {AGENTS_META.map(a => {
              const perf = agentPerfs[a.name];
              return (
                <div key={a.id} className="ap-card">
                  <div className="ap-top">
                    <div className="ap-avatar" style={{ background: `${a.color}22`, border: `1px solid ${a.color}44` }}>{a.emoji}</div>
                    <div className="ap-info"><div className="ap-name">{a.name}</div><div className="ap-role">{a.role}</div></div>
                    <span className="ap-model">{a.model}</span>
                  </div>
                  <div className="ap-stats">
                    <div className="ap-stat">
                      <div className="ap-sv" style={{ color: '#00E676' }}>{perf && perf.totalPredictions > 0 ? `${perf.winRate.toFixed(0)}%` : '—'}</div>
                      <div className="ap-sl">Win rate</div>
                    </div>
                    <div className="ap-stat">
                      <div className="ap-sv" style={{ color: '#00E5FF' }}>{perf && perf.totalPredictions > 0 ? perf.avgConfidence.toFixed(1) : '—'}</div>
                      <div className="ap-sl">Avg conf</div>
                    </div>
                    <div className="ap-stat">
                      <div className="ap-sv">{perf ? perf.totalPredictions : 0}</div>
                      <div className="ap-sl">Predictions</div>
                    </div>
                  </div>
                  {perf && perf.totalPredictions > 0 && (
                    <div className="ap-calibration">Calibration: {perf.calibration}</div>
                  )}
                  {(!perf || perf.totalPredictions === 0) && (
                    <div className="ap-calibration muted">No predictions recorded yet — run a simulation to build memory</div>
                  )}
                  <div className="ap-desc">{a.desc}</div>
                  <div className="ap-edge"><span>Edge:</span> {a.edge}</div>
                  <div className="ap-best"><span>Best in:</span> {a.bestRegime}</div>
                </div>
              );
            })}
          </div>
        </div></div>
      )}

      {/* ══ HISTORY ══ */}
      {activeTab === 'history' && (
        <div className="page-layout"><div className="page-content">
          <div className="page-title">Simulation History</div>
          <div className="page-sub">Simulations run this session. History persists while the page is open.</div>
          {simHistory.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 300 }}>
              <div className="empty-ring"><div className="empty-ring-dot" /></div>
              <div className="empty-title">No simulations yet</div>
              <div className="empty-body">Run a simulation from the Simulate tab to see results here</div>
            </div>
          ) : (
            <>
              <div className="history-stats">
                <div className="hstat"><div className="hstat-val">{simHistory.length}</div><div className="hstat-label">Total Runs</div></div>
                <div className="hstat"><div className="hstat-val" style={{ color: '#00E676' }}>{simHistory.filter(h => h.consensus?.signal === 'BUY').length}</div><div className="hstat-label">BUY Signals</div></div>
                <div className="hstat"><div className="hstat-val" style={{ color: '#FF4B6E' }}>{simHistory.filter(h => h.consensus?.signal === 'SELL').length}</div><div className="hstat-label">SELL Signals</div></div>
                <div className="hstat"><div className="hstat-val" style={{ color: '#FFB800' }}>{simHistory.filter(h => h.consensus?.signal === 'HOLD').length}</div><div className="hstat-label">HOLD Signals</div></div>
              </div>
              <div className="hfilters">
                {[['all','All'],['BUY','BUY'],['SELL','SELL'],['HOLD','HOLD']].map(([f,l]) => (
                  <button key={f} className={`hfilter${histFilter===f?' active':''}`} onClick={() => setHistFilter(f)}>{l}</button>
                ))}
              </div>
              {filteredHistory.map((h, i) => (
                <div key={i} className={`history-item ${h.consensus?.signal}`}>
                  <div className="hi-top">
                    <span className="hi-asset">{h.asset}</span>
                    <span className={`hi-action ${h.consensus?.signal}`}>{h.consensus?.signal}</span>
                    <span className="hi-conf">{h.consensus?.strength?.toFixed(0)}% strength</span>
                    <span className="hi-tf">{h.tf}</span>
                    <span className="hi-date">{h.date}</span>
                  </div>
                  <div className="hi-body">
                    Price: ${h.price?.toLocaleString()} ({h.change >= 0 ? '+' : ''}{h.change?.toFixed(2)}%) · 
                    BUY {h.consensus?.breakdown?.buy} · SELL {h.consensus?.breakdown?.sell} · HOLD {h.consensus?.breakdown?.hold} · 
                    Avg confidence: {h.consensus?.averageConfidence?.toFixed(1)}/10
                  </div>
                  <div className="hi-agents">
                    {h.verdicts?.map((v: any) => (
                      <span key={v.agent} className={`hi-chip ${v.action?.toLowerCase()}`}>{v.agent.split(' ')[0]}: {v.action}</span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div></div>
      )}

      <style jsx global>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:#060810;color:#E2E8F8;font-family:'DM Sans',sans-serif;min-height:100vh;overflow-x:hidden}
        body::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(0,229,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.018) 1px,transparent 1px);background-size:52px 52px}
        body::after{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse 60% 40% at 20% -5%,rgba(91,110,245,0.09),transparent),radial-gradient(ellipse 40% 30% at 80% 100%,rgba(0,229,255,0.05),transparent)}
        .scanline{position:fixed;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)}
        .header{position:sticky;top:0;z-index:300;height:54px;padding:0 20px;display:flex;align-items:center;background:rgba(6,8,16,0.92);backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid rgba(255,255,255,0.055)}
        .logo{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#00E5FF;letter-spacing:0.04em;display:flex;align-items:center;gap:10px;margin-right:28px;text-transform:uppercase}
        .logo-icon{width:26px;height:26px;border-radius:6px;background:linear-gradient(135deg,rgba(0,229,255,0.2),rgba(91,110,245,0.2));border:1px solid rgba(0,229,255,0.35);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
        .logo-icon::before{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg,transparent 270deg,rgba(0,229,255,0.6) 360deg);animation:spin 3s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .logo-dot{width:8px;height:8px;border-radius:50%;background:#00E5FF;z-index:1;box-shadow:0 0 8px #00E5FF}
        .nav{display:flex;gap:1px;flex:1}
        .nav-btn{padding:0 16px;height:54px;display:flex;align-items:center;gap:7px;background:transparent;border:none;color:#4A5578;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all .18s;position:relative}
        .nav-btn:hover{color:#E2E8F8}
        .nav-btn.active{color:#00E5FF}
        .nav-btn.active::after{content:'';position:absolute;bottom:0;left:16px;right:16px;height:1.5px;background:#00E5FF;box-shadow:0 0 8px #00E5FF}
        .nav-icon{font-size:12px}
        .header-right{display:flex;align-items:center;gap:8px;margin-left:auto}
        .badge{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.1em;padding:3px 8px;border-radius:3px;text-transform:uppercase}
        .badge.v3{color:#5B6EF5;border:1px solid rgba(91,110,245,0.3)}
        .badge.live{color:#00E676;border:1px solid rgba(0,230,118,0.25);display:flex;align-items:center;gap:5px}
        .badge.live::before{content:'';width:5px;height:5px;border-radius:50%;background:#00E676;animation:pulse 2s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(0,230,118,0.4)}50%{opacity:.7;box-shadow:0 0 0 4px rgba(0,230,118,0)}}
        .sim-layout{display:grid;grid-template-columns:290px 1fr;min-height:calc(100vh - 54px);position:relative;z-index:2}
        .sidebar{border-right:1px solid rgba(255,255,255,0.055);background:#0A0D18;padding:18px 14px;overflow-y:auto;max-height:calc(100vh - 54px);position:sticky;top:54px}
        .sidebar-section{margin-bottom:18px}
        .slab{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;color:#4A5578;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px}
        .slab::before{content:'';width:14px;height:1px;background:#2E3652}
        .asset-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
        .asset-btn{padding:8px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.055);background:transparent;color:#4A5578;font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;transition:all .15s;text-align:center}
        .asset-btn:hover{border-color:rgba(255,255,255,0.1);color:#E2E8F8}
        .asset-btn.active{border-color:rgba(0,229,255,0.4);color:#00E5FF;background:rgba(0,229,255,0.06)}
        .sym{display:block;font-size:11px;font-weight:600;margin-bottom:2px}
        .typ{font-size:8px;color:#2E3652;letter-spacing:0.08em;text-transform:uppercase}
        .asset-btn.active .typ{color:rgba(0,229,255,0.5)}
        .live-card{background:#0F1320;border:1px solid rgba(255,255,255,0.055);border-radius:8px;padding:12px}
        .live-price{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:#00E5FF}
        .live-change{font-family:'IBM Plex Mono',monospace;font-size:11px;margin-left:6px}
        .live-change.up{color:#00E676}.live-change.down{color:#FF4B6E}
        .live-source{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2E3652;margin-top:4px}
        .live-empty{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#2E3652;text-align:center;padding:8px 0}
        .live-indicators{margin-top:10px;border-top:1px solid rgba(255,255,255,0.055);padding-top:10px}
        .ind-row{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4A5578;padding:3px 0}
        .ind-row .warn{color:#FFB800}
        .ind-row .good{color:#00E676}
        .tf-tabs{display:flex;gap:4px}
        .tf-tab{padding:5px 12px;border-radius:4px;border:1px solid rgba(255,255,255,0.055);background:transparent;color:#4A5578;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;transition:all .15s}
        .tf-tab:hover{color:#E2E8F8;border-color:rgba(255,255,255,0.1)}
        .tf-tab.active{color:#00E5FF;border-color:rgba(0,229,255,0.3);background:rgba(0,229,255,0.06)}
        .run-btn{width:100%;padding:11px;border-radius:7px;background:linear-gradient(135deg,rgba(0,229,255,0.12),rgba(91,110,245,0.12));border:1px solid rgba(0,229,255,0.3);color:#00E5FF;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;transition:all .2s;margin-bottom:18px}
        .run-btn:hover:not(:disabled){background:linear-gradient(135deg,rgba(0,229,255,0.2),rgba(91,110,245,0.2));border-color:rgba(0,229,255,.5);box-shadow:0 0 20px rgba(0,229,255,0.12)}
        .run-btn:disabled{opacity:.4;cursor:not-allowed}
        .roster-item{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.055)}
        .roster-item:last-child{border-bottom:none}
        .roster-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .roster-name{font-size:11px;font-weight:500}
        .roster-model{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4A5578}
        .roster-role{font-family:'IBM Plex Mono',monospace;font-size:8px;color:#2E3652}
        .results-area{padding:22px 24px;overflow-y:auto;max-height:calc(100vh - 54px);position:relative;z-index:2}
        .chart-panel{border-radius:10px;border:1px solid rgba(255,255,255,0.055);background:#0A0D18;overflow:hidden;margin-bottom:20px}
        .chart-panel-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.055);background:#0F1320}
        .chart-label{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4A5578;letter-spacing:.14em;text-transform:uppercase;display:flex;align-items:center;gap:7px}
        .chart-live-dot{width:6px;height:6px;border-radius:50%;background:#00E676;box-shadow:0 0 5px #00E676;animation:pulse 2s infinite}
        .chart-tfs{display:flex;gap:4px}
        .chart-tf-btn{font-family:'IBM Plex Mono',monospace;font-size:9px;padding:2px 8px;border-radius:3px;border:1px solid rgba(255,255,255,0.055);background:transparent;color:#4A5578;cursor:pointer;transition:all .15s}
        .chart-tf-btn:hover{color:#E2E8F8;border-color:rgba(255,255,255,0.1)}
        .pa-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,0.055);border-top:1px solid rgba(255,255,255,0.055)}
        .pa-cell{padding:10px 14px;background:#0A0D18}
        .pa-label{font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4A5578;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}
        .pa-val{font-size:11px;color:#E2E8F8;line-height:1.4}
        .pa-val.up{color:#00E676}.pa-val.down{color:#FF4B6E}.pa-val.warn{color:#FFB800}
        .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:280px;text-align:center}
        .empty-ring{width:72px;height:72px;border-radius:50%;border:1.5px solid #2E3652;display:flex;align-items:center;justify-content:center;margin-bottom:18px;position:relative}
        .empty-ring::before{content:'';position:absolute;inset:4px;border-radius:50%;border:1px dashed #2E3652;animation:spin 8s linear infinite}
        .empty-ring-dot{width:10px;height:10px;border-radius:50%;background:#2E3652}
        .empty-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:600;color:#4A5578;margin-bottom:8px}
        .empty-body{font-size:13px;line-height:1.6;max-width:360px;color:#2E3652}
        .consensus-block{border-radius:10px;padding:18px;border:1px solid rgba(255,255,255,0.055);background:#0A0D18;margin-bottom:20px}
        .consensus-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
        .consensus-verdict{font-family:'Syne',sans-serif;font-size:32px;font-weight:800}
        .consensus-verdict.BUY{color:#00E676}.consensus-verdict.SELL{color:#FF4B6E}.consensus-verdict.HOLD{color:#FFB800}
        .consensus-conf{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4A5578;margin-top:4px}
        .breakdown{display:flex;flex-direction:column;gap:4px;font-family:'IBM Plex Mono',monospace;font-size:11px}
        .bd-buy{color:#00E676}.bd-sell{color:#FF4B6E}.bd-hold{color:#FFB800}
        .score-bar{display:flex;gap:2px;border-radius:5px;overflow:hidden;height:24px}
        .score-seg{display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:600;padding:0 6px;border-radius:3px;white-space:nowrap}
        .score-seg.buy{background:rgba(0,230,118,0.2);color:#00E676}
        .score-seg.sell{background:rgba(255,75,110,0.2);color:#FF4B6E}
        .score-seg.hold{background:rgba(255,184,0,0.2);color:#FFB800}
        .debate-section{margin-bottom:24px}
        .sec{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:14px}
        .turning-point{background:#0F1320;border:1px solid rgba(255,255,255,0.055);border-left:3px solid #FFB800;border-radius:8px;padding:14px;margin-bottom:10px}
        .tp-top{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-family:'IBM Plex Mono',monospace;font-size:11px}
        .tp-round{color:#4A5578;font-size:9px}.tp-change{color:#FFB800;margin-left:auto}
        .tp-reason{font-size:12px;color:rgba(226,232,248,.45);font-style:italic;line-height:1.6}
        .agents-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:24px}
        .agent-card{background:#0F1320;border:1px solid rgba(255,255,255,0.055);border-top:2px solid #00E5FF;border-radius:10px;padding:16px;transition:all .2s}
        .agent-card:hover{border-color:rgba(255,255,255,0.12);transform:translateY(-2px)}
        .agent-card-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .agent-emoji{font-size:20px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#151B2C;border-radius:8px}
        .agent-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700}
        .agent-role{font-size:11px;color:#4A5578}
        .action-badge{margin-left:auto;padding:5px 10px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600}
        .action-badge.buy{background:rgba(0,230,118,0.12);color:#00E676;border:1px solid rgba(0,230,118,0.3)}
        .action-badge.sell{background:rgba(255,75,110,0.12);color:#FF4B6E;border:1px solid rgba(255,75,110,0.3)}
        .action-badge.hold{background:rgba(255,184,0,0.12);color:#FFB800;border:1px solid rgba(255,184,0,0.3)}
        .conf-row{display:flex;justify-content:space-between;margin-bottom:5px}
        .conf-label{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4A5578;text-transform:uppercase;letter-spacing:.1em}
        .conf-val{font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600}
        .conf-bar{height:4px;background:#151B2C;border-radius:2px;overflow:hidden;margin-bottom:12px}
        .conf-fill{height:100%;transition:width .5s}
        .verdict-details{background:#151B2C;border-radius:6px;padding:10px;margin-bottom:12px;font-family:'IBM Plex Mono',monospace;font-size:10px}
        .verdict-details div{display:flex;justify-content:space-between;margin-bottom:4px}
        .verdict-details div:last-child{margin-bottom:0}
        .vd-label{color:#4A5578}
        .reasoning{font-size:12px;line-height:1.6;color:rgba(226,232,248,.7);margin-bottom:8px}
        .risk-row{font-size:11px;color:#FFB800;background:rgba(255,184,0,0.08);border:1px solid rgba(255,184,0,0.2);border-radius:5px;padding:6px 10px;margin-bottom:6px}
        .analogy-row{font-size:11px;color:#818CF8;background:rgba(129,140,248,0.08);border:1px solid rgba(129,140,248,0.2);border-radius:5px;padding:6px 10px;margin-bottom:6px}
        .macro-row{font-size:11px;color:#2DD4BF;background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.2);border-radius:5px;padding:6px 10px;margin-bottom:6px}
        .changed-badge{background:rgba(255,184,0,0.1);border:1px solid rgba(255,184,0,0.3);color:#FFB800;padding:6px;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-size:9px;text-align:center}
        .page-layout{position:relative;z-index:2;padding:28px 32px}
        .page-content{max-width:1100px;margin:0 auto}
        .page-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;margin-bottom:4px}
        .page-sub{font-size:13px;color:#4A5578;margin-bottom:24px}
        .loading-inline{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4A5578;padding:20px 0;text-align:center;animation:pulse 2s infinite}
        .coming-soon-box{border-radius:12px;border:1px solid rgba(255,255,255,0.055);background:#0A0D18;padding:40px;text-align:center}
        .cs-icon{font-size:36px;margin-bottom:16px;color:#4A5578}
        .cs-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:12px}
        .cs-body{font-size:13px;color:#4A5578;line-height:1.7;max-width:500px;margin:0 auto}
        .macro-header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
        .regime-badge{font-family:'IBM Plex Mono',monospace;font-size:9px;padding:5px 12px;border-radius:4px;background:rgba(255,184,0,0.1);border:1px solid rgba(255,184,0,0.3);color:#FFB800}
        .macro-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
        .macro-extra-row{margin-bottom:24px}
        .macro-extra-card{border-radius:9px;padding:16px;border:1px solid rgba(255,255,255,0.055);background:#0A0D18;display:inline-block;min-width:220px}
        .macro-big-card{border-radius:9px;padding:16px;border:1px solid rgba(255,255,255,0.055);background:#0A0D18}
        .macro-big-label{font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4A5578;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
        .macro-big-val{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;margin-bottom:4px}
        .macro-big-sub{font-size:10px;color:#4A5578;margin-bottom:8px}
        .macro-trend{font-family:'IBM Plex Mono',monospace;font-size:10px}
        .macro-trend.bull{color:#00E676}.macro-trend.bear{color:#FF4B6E}.macro-trend.neutral{color:#FFB800}
        .agent-profiles-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .ap-card{background:#0A0D18;border:1px solid rgba(255,255,255,0.055);border-radius:10px;padding:18px}
        .ap-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
        .ap-avatar{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px}
        .ap-info{flex:1}
        .ap-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700}
        .ap-role{font-size:11px;color:#4A5578}
        .ap-model{font-family:'IBM Plex Mono',monospace;font-size:8px;padding:2px 7px;border-radius:3px;background:#151B2C;border:1px solid rgba(255,255,255,0.055);color:#4A5578}
        .ap-stats{display:flex;margin-bottom:12px;border-radius:7px;overflow:hidden;border:1px solid rgba(255,255,255,0.055)}
        .ap-stat{flex:1;padding:10px;text-align:center;background:#0F1320;border-right:1px solid rgba(255,255,255,0.055)}
        .ap-stat:last-child{border-right:none}
        .ap-sv{font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;margin-bottom:2px}
        .ap-sl{font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4A5578;text-transform:uppercase;letter-spacing:.08em}
        .ap-calibration{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#00E5FF;margin-bottom:10px;padding:5px 8px;background:rgba(0,229,255,0.06);border-radius:4px}
        .ap-calibration.muted{color:#2E3652;background:transparent;padding:0}
        .ap-desc{font-size:12px;line-height:1.6;color:rgba(226,232,248,.55);margin-bottom:10px}
        .ap-edge{font-size:11px;color:#4A5578;margin-bottom:6px}
        .ap-edge span{color:#00E5FF;font-weight:600}
        .ap-best{font-size:11px;color:#4A5578}
        .ap-best span{color:#FFB800;font-weight:600}
        .history-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
        .hstat{border-radius:8px;padding:14px;border:1px solid rgba(255,255,255,0.055);background:#0A0D18}
        .hstat-val{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;margin-bottom:4px}
        .hstat-label{font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4A5578;letter-spacing:.1em;text-transform:uppercase}
        .hfilters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .hfilter{padding:4px 12px;border-radius:4px;border:1px solid rgba(255,255,255,0.055);background:transparent;color:#4A5578;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;transition:all .15s}
        .hfilter:hover{color:#E2E8F8}
        .hfilter.active{color:#00E5FF;border-color:rgba(0,229,255,.3);background:rgba(0,229,255,.06)}
        .history-item{border-radius:9px;padding:16px;border:1px solid rgba(255,255,255,0.055);background:#0A0D18;margin-bottom:10px}
        .history-item.BUY{border-left:2px solid #00E676}.history-item.SELL{border-left:2px solid #FF4B6E}.history-item.HOLD{border-left:2px solid #FFB800}
        .hi-top{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}
        .hi-asset{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:#00E5FF}
        .hi-action{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700}
        .hi-action.BUY{color:#00E676}.hi-action.SELL{color:#FF4B6E}.hi-action.HOLD{color:#FFB800}
        .hi-conf,.hi-tf{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4A5578}
        .hi-date{font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2E3652;margin-left:auto}
        .hi-body{font-size:12px;color:rgba(226,232,248,.45);line-height:1.5;margin-bottom:8px}
        .hi-agents{display:flex;gap:5px;flex-wrap:wrap}
        .hi-chip{font-family:'IBM Plex Mono',monospace;font-size:8px;padding:2px 6px;border-radius:3px;border:1px solid rgba(255,255,255,0.055);color:#4A5578}
        .hi-chip.buy{color:#00E676;border-color:rgba(0,230,118,0.2)}.hi-chip.sell{color:#FF4B6E;border-color:rgba(255,75,110,0.2)}.hi-chip.hold{color:#FFB800;border-color:rgba(255,184,0,0.2)}
        .loading-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .loading-spinner{width:50px;height:50px;border:2px solid rgba(0,229,255,0.2);border-top-color:#00E5FF;border-radius:50%;animation:spin 1s linear infinite}
        .loading-msg{color:#00E5FF;margin-top:20px;font-family:'IBM Plex Mono',monospace;font-size:13px}
        @media(max-width:900px){.sim-layout{grid-template-columns:1fr}.sidebar{position:static;max-height:none}.macro-grid,.agent-profiles-grid,.history-stats{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.agents-grid,.agent-profiles-grid{grid-template-columns:1fr}.macro-grid,.history-stats{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
