# 🚀 Quick Start Guide

Get MarketMind v3 running in 5 minutes!

## Option 1: Deploy to Vercel (Recommended)

**Fastest way to get live:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/marketmind-v3)

1. Click button above
2. Fork repository
3. Add environment variables (see below)
4. Deploy!

---

## Option 2: Local Development

### Step 1: Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/marketmind-v3.git
cd marketmind-v3
npm install
```

### Step 2: Environment Variables

Create `.env.local`:

```bash
# Copy template
cp .env.example .env.local

# Edit with your keys
nano .env.local
```

### Step 3: Run

```bash
npm run dev
```

Open http://localhost:3000

---

## 🔑 Get API Keys (5 minutes)

### Required Keys

1. **Anthropic Claude** (Free trial)
   - Go to: https://console.anthropic.com
   - Sign up → API Keys → Create Key
   - Copy: `ANTHROPIC_API_KEY=sk-ant-...`

2. **OpenAI GPT-4o** (Pay-as-you-go, $5 credit for new users)
   - Go to: https://platform.openai.com
   - API Keys → Create new secret key
   - Copy: `OPENAI_API_KEY=sk-...`

3. **Google Gemini** (Free)
   - Go to: https://ai.google.dev
   - Get API Key
   - Copy: `GOOGLE_GEMINI_API_KEY=...`

4. **Twelve Data** (Free 800 calls/day)
   - Go to: https://twelvedata.com
   - Sign up → API Key
   - Copy: `TWELVE_DATA_API_KEY=...`

5. **FRED** (Free unlimited)
   - Go to: https://fred.stlouisfed.org/docs/api/api_key.html
   - Request API key
   - Copy: `FRED_API_KEY=...`

6. **Upstash Redis + Vector** (Free 10K requests/day)
   - Go to: https://upstash.com
   - Create Redis Database → Copy URL and Token
   - Create Vector Index (1536 dimensions) → Copy URL and Token
   - Copy all 4 values

---

## ✅ Test Your Setup

### In Browser

1. Select asset: BTCUSD
2. Click "Run Simulation"
3. Watch agents analyze!

Expected: ~30 seconds for complete analysis

### Check Console

Should see:
```
✓ Fetching market data...
✓ Assembling agent context...
✓ Running 6 AI agents in parallel...
✓ Initiating agent debate...
```

---

## 🎯 First Simulation

1. **Select Asset**: Start with BTCUSD (most active)
2. **Choose Timeframe**: 4h is good default
3. **Run Simulation**: Click the big button
4. **Wait**: ~20-30 seconds
5. **View Results**:
   - Initial consensus
   - Agent verdicts
   - Debate changes
   - Final consensus

---

## 💡 Tips

### Best Assets to Start With

- **BTCUSD**: Most volatile, interesting debates
- **XAUUSD**: Macro-heavy analysis
- **EURUSD**: Good for testing forex agents

### Optimal Timeframes

- **1h**: Quick momentum plays
- **4h**: Best balance (recommended)
- **1d**: Longer-term setups

### Understanding Results

- **High consensus (80%+)**: Strong agreement
- **Split decision (40-60%)**: Market uncertainty
- **Position changes**: Pay attention to reasoning

---

## 🐛 Troubleshooting

### "Simulation failed"

Check:
1. All API keys are valid
2. No rate limits hit
3. Browser console for errors

### "Loading forever"

Check:
1. Vercel function logs (if deployed)
2. Terminal for errors (if local)
3. Try different asset

### Slow Response

Normal! Each simulation:
- Fetches live data
- Runs 6 AI models
- 2 debate rounds
- ~20-30 seconds total

---

## 📊 Cost Per Simulation

- Free tier testing: ~100 simulations/day
- Paid: ~$0.02 per simulation
- Monthly (100/day): ~$60

---

## 🎓 Next Steps

1. ✅ Run your first simulation
2. ✅ Try different assets
3. ✅ Watch debate changes
4. ✅ Deploy to production
5. ✅ Share with friends!

---

**Need help?** Check:
- README.md - Full documentation
- DEPLOY.md - Deployment guide
- GitHub Issues

**Ready to deploy?** See DEPLOY.md

---

🎉 **Enjoy your AI-powered market intelligence system!**
