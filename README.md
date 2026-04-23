# MarketMind v3 - Full Stack Application

Autonomous Multi-Agent Market Intelligence System with 6 AI agents that debate and communicate with each other.

![MarketMind v3](https://img.shields.io/badge/version-3.0-cyan) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

## 🚀 Live Demo

Deploy your own: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/marketmind-v3)

## ✨ Features

- **6 AI Agents** running on different models (Claude, GPT-4o, Gemini)
- **Multi-Round Debate System** - Agents communicate and influence each other
- **Real-time Market Data** - OHLC, Technical Indicators, Macro Data
- **Memory System** - Agents learn from past predictions
- **Beautiful UI** - Dark cyberpunk aesthetic with animations
- **Full TypeScript** - Type-safe throughout
- **Production Ready** - Deploy to Vercel in one click

## 🏗️ Architecture

```
Frontend (React/Next.js)
    ↓
API Routes (/api/*)
    ↓
AI Agent Layer (6 parallel agents)
    ↓
Data Layer (Market Data + Indicators)
    ↓
Storage (Redis Cache + Vector Memory)
```

## 📦 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/marketmind-v3.git
cd marketmind-v3
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create `.env.local`:

```bash
# AI Models
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GEMINI_API_KEY=...

# Market Data
TWELVE_DATA_API_KEY=...
FRED_API_KEY=...

# Database
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=...
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy to Vercel

### Via GitHub

1. Push code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add environment variables
5. Deploy!

### Via CLI

```bash
npm i -g vercel
vercel
```

Then add environment variables in the Vercel dashboard.

## 🔑 API Keys

You'll need accounts for (most have free tiers):

| Service | Purpose | Free Tier | Link |
|---------|---------|-----------|------|
| Anthropic | Claude AI | Yes | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | GPT-4o | Pay-as-you-go | [platform.openai.com](https://platform.openai.com) |
| Google AI | Gemini | Yes | [ai.google.dev](https://ai.google.dev) |
| Twelve Data | Market Data | 800 calls/day | [twelvedata.com](https://twelvedata.com) |
| FRED | Macro Data | Unlimited | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |
| Upstash | Redis + Vector | 10K requests/day | [upstash.com](https://upstash.com) |

## 🎯 How It Works

### 1. User Selects Asset

Choose from BTCUSD, ETHUSD, XAUUSD, EURUSD, GBPUSD, USDJPY, SPX500, CRUDE

### 2. System Fetches Data

- Historical OHLC data (Binance/Twelve Data)
- Technical indicators (RSI, MACD, ATR, Bollinger, EMA)
- Macro data (Fed rate, CPI, GDP, yields, VIX)
- Asset-specific context (Fear & Greed, BTC dominance, etc.)

### 3. 6 AI Agents Analyze Independently

Each agent has a unique trading personality:
- **Maya Chen** (Claude) - Retail Sentiment Trader
- **Victor Hale** (GPT-4o) - Hedge Fund Macro Trader
- **Alpha-7** (Gemini) - Quantitative Algorithm
- **Dr. Sarah Chen** (Claude) - Central Bank Economist
- **Jake Morrison** (GPT-4o) - Order Flow Specialist
- **Aisha Okonkwo** (Gemini) - Smart Money Concepts

### 4. Agents Debate (2 Rounds)

Agents review each other's positions and can:
- Hold their position with justification
- Change their position if convinced
- Adjust confidence levels

### 5. Final Consensus

System calculates final consensus with strength percentage and breakdown.

## 📊 Example Output

```json
{
  "consensus": {
    "signal": "BUY",
    "strength": 83.3,
    "breakdown": { "buy": 5, "sell": 0, "hold": 1 }
  },
  "turningPoints": [
    {
      "agent": "Victor Hale",
      "change": "SELL → BUY",
      "reasoning": "Alpha-7's volume confirmation is compelling..."
    }
  ]
}
```

## 📁 Project Structure

```
marketmind-v3-fullstack/
├── lib/                  # Core services
│   ├── agents.ts         # Agent definitions
│   ├── ai-models.ts      # AI client wrappers
│   ├── market-data.ts    # Data fetching
│   ├── indicators.ts     # Technical indicators
│   ├── macro-data.ts     # FRED API
│   ├── redis.ts          # Cache layer
│   └── vector.ts         # Agent memory
├── pages/
│   ├── index.tsx         # Frontend UI
│   └── api/              # Backend endpoints
│       ├── historical.ts
│       ├── macro.ts
│       ├── ingest.ts
│       ├── simulate.ts   # Run agents
│       ├── debate.ts     # Agent debate
│       └── memory.ts
├── types/
│   └── index.ts          # TypeScript definitions
├── package.json
├── tsconfig.json
└── next.config.js
```

## 💰 Cost Estimate

Per simulation (6 agents + 2 debate rounds):
- Claude: ~$0.006
- GPT-4o: ~$0.012
- Gemini: ~$0.002

**Total: ~$0.02 per simulation**

100 simulations/day = ~$2/day = ~$60/month

## 🔧 Tech Stack

- **Frontend**: React 18, Next.js 14, TypeScript
- **Backend**: Next.js API Routes (serverless)
- **AI**: Anthropic Claude, OpenAI GPT-4o, Google Gemini
- **Database**: Upstash Redis (cache) + Upstash Vector (memory)
- **Data**: Binance, Twelve Data, FRED, CoinGecko
- **Deployment**: Vercel

## 📚 API Documentation

Visit `/api` endpoints:

- `GET /api/historical?asset=BTCUSD` - OHLC + indicators
- `GET /api/macro?asset=BTCUSD` - Economic data
- `GET /api/ingest?asset=BTCUSD` - Full context
- `POST /api/simulate` - Run 6 agents
- `POST /api/debate` - Multi-round debate
- `GET /api/memory?agent=Maya Chen&asset=BTCUSD` - Performance

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📄 License

MIT

## 🙏 Acknowledgments

- Anthropic, OpenAI, Google for AI APIs
- Binance, Twelve Data, FRED for market data
- Upstash for database infrastructure

---

**Built with ❤️ for autonomous market intelligence**

Deploy now: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/marketmind-v3)
