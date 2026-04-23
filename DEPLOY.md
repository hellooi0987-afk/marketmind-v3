# GitHub + Vercel Deployment Guide

## 🎯 Goal

Deploy MarketMind v3 to Vercel via GitHub for free hosting with auto-deployment.

## 📋 Prerequisites

- GitHub account
- Vercel account (free)
- All API keys ready

---

## Step 1: Create GitHub Repository

### Option A: Via GitHub Website

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `marketmind-v3`
3. Description: "Autonomous Multi-Agent Market Intelligence System"
4. Public or Private (your choice)
5. **DON'T** initialize with README (we already have one)
6. Click "Create repository"

### Option B: Via GitHub CLI

```bash
gh repo create marketmind-v3 --public --source=. --remote=origin --push
```

---

## Step 2: Push Code to GitHub

From your project folder:

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - MarketMind v3 Full Stack"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/marketmind-v3.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 3: Connect Vercel to GitHub

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New Project"
4. Click "Import Git Repository"
5. Select your `marketmind-v3` repository
6. Click "Import"

---

## Step 4: Configure Project

Vercel will auto-detect Next.js. Just confirm:

- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `next build`
- **Output Directory**: `.next`

Click "Deploy" (but it will fail without env vars)

---

## Step 5: Add Environment Variables

In Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add each variable:

### AI Models

```
ANTHROPIC_API_KEY = sk-ant-your-key-here
OPENAI_API_KEY = sk-your-key-here
GOOGLE_GEMINI_API_KEY = your-key-here
```

### Market Data

```
TWELVE_DATA_API_KEY = your-key-here
FRED_API_KEY = your-fred-key-here
```

(Alpha Vantage is optional backup)

### Database (Upstash)

```
UPSTASH_REDIS_REST_URL = https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN = your-redis-token
UPSTASH_VECTOR_REST_URL = https://your-vector-url.upstash.io
UPSTASH_VECTOR_REST_TOKEN = your-vector-token
```

**Important**: Apply to Production, Preview, and Development

---

## Step 6: Redeploy

1. Go to Deployments tab
2. Click the three dots on the latest deployment
3. Click "Redeploy"
4. Or just push a new commit:

```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

---

## Step 7: Test Your Deployment

Your app will be live at:

```
https://marketmind-v3-your-username.vercel.app
```

Test by:
1. Selecting an asset (e.g., BTCUSD)
2. Clicking "Run Simulation"
3. Watch the 6 agents analyze and debate!

---

## 🎉 You're Live!

Now every `git push` will auto-deploy to Vercel.

---

## 🔧 Troubleshooting

### Build Fails

**Check build logs in Vercel dashboard**

Common issues:
- Missing environment variables
- TypeScript errors
- Missing dependencies

### API Errors

**Check Function Logs in Vercel**

Common issues:
- Invalid API keys
- Rate limits exceeded
- Upstash connection issues

### Fix and Redeploy

```bash
# Make changes
git add .
git commit -m "Fix: description of fix"
git push
```

Vercel auto-deploys!

---

## 📊 Monitoring

### Vercel Dashboard

- **Analytics**: Traffic, performance
- **Logs**: Function execution logs
- **Deployments**: History of all deploys

### Check Costs

- Vercel: Free tier (100GB bandwidth, 100GB-hrs compute)
- API costs: ~$2/day for 100 simulations

---

## 🚀 Custom Domain (Optional)

1. Buy domain (Namecheap, GoDaddy, etc.)
2. In Vercel: Settings → Domains
3. Add your domain
4. Follow DNS configuration instructions
5. Wait for verification (5-60 min)

Your app at: `https://yourdomain.com`

---

## 🔐 Security

### Environment Variables

✅ **NEVER commit .env.local to GitHub**

Already in `.gitignore`:
```
.env*.local
.env
```

### API Keys

- Store only in Vercel dashboard
- Rotate keys if exposed
- Use read-only keys when possible

---

## 📈 Scaling

### Free Tier Limits

- 100GB bandwidth/month
- 100 GB-hours compute
- ~300K function invocations

### If You Exceed

Vercel Pro: $20/month
- 1TB bandwidth
- 1000 GB-hours
- Unlimited invocations

---

## 🎓 Next Steps

1. ✅ Share your deployment URL
2. ✅ Add more assets
3. ✅ Build Phase 4 (Backtest engine)
4. ✅ Add webhook alerts
5. ✅ Customize agent personalities

---

**Your MarketMind v3 is now live! 🚀**

Share it: `https://marketmind-v3-your-username.vercel.app`
