# 🚀 CostPilot - Smart AI Cost Optimization

Save **70-80%** on your OpenAI API bills without sacrificing quality. CostPilot intelligently routes your queries to the cheapest model that can handle them.

![CostPilot](https://img.shields.io/badge/Savings-70--80%25-green) ![Version](https://img.shields.io/badge/Version-2.0-blue) ![License](https://img.shields.io/badge/License-MIT-orange)

## Why CostPilot?

| Feature | Without CostPilot | With CostPilot |
|---------|-------------------|----------------|
| Simple queries | GPT-4 ($0.03/1K tokens) | gpt-4o-mini ($0.0006/1K tokens) |
| Complex tasks | GPT-4 ($0.03/1K tokens) | GPT-4 when needed |
| Cost visibility | None | Real-time tracking |
| Budget control | Manual | Automatic caps |

**Average savings: 70-80%** for typical chat usage patterns.

## Quick Start

### 1. Try Online (No Setup)

Visit **[costpilot.chat](https://costpilot.chat)** or run locally:

```bash
# Clone and run
git clone https://github.com/yourusername/costpilot.git
cd costpilot
npm install
npm start
```

Then open http://localhost:3000 in your browser.

### 2. Enter Your API Key

- Click "🔑 Change Key" in the app
- Paste your OpenAI API key (starts with `sk-`)
- Your key stays in your browser — we never see or store it

Or click **🚀 Try Demo Mode** to test without an API key.

## How It Works

```
┌──────────────┐     ┌─────────────────┐     ┌────────────────┐
│  Your Query  │────▶│  CostPilot       │────▶│  AI Model      │
│              │     │  Smart Router    │     │  (optimized)   │
└──────────────┘     └─────────────────┘     └────────────────┘
                            │
                     ┌──────▼──────┐
                     │  Savings    │
                     │  Tracker    │
                     └─────────────┘
```

1. **You ask a question** — any complexity
2. **CostPilot analyzes** — determines the simplest model that can answer well
3. **Routes intelligently** — cheap for simple, powerful for complex
4. **You save money** — up to 80% vs. using GPT-4 for everything

## Features

### 🧠 Smart Routing
- **Simple questions** → gpt-4o-mini (~$0.00015/1K input tokens)
- **Complex analysis** → GPT-4o (~$0.01/1K input tokens)
- Automatic selection — no configuration needed

### 💰 Budget Controls
- Set monthly spending limits ($10-$500)
- Visual warnings at 80% usage
- Never surprise bills again

### 📊 Real-Time Analytics
- Live savings counter
- Spending over time charts
- Per-session history

### 🎨 Beautiful UI
- Dark/Light theme
- Smooth animations
- Mobile-responsive

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/chat` | Main chat interface |
| `/dashboard` | Analytics & history |
| `/settings` | API key & preferences |

## API Keys

Get your OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Demo keys included:**
- Test: `cpilot_sk_test_123456789`
- Production: `cpilot_sk_prod_987654321`

> ⚠️ **Change these in production!**

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (fast, no build)
- **Backend**: Node.js + Express
- **Caching**: In-memory with persistence
- **Deployment**: Vercel-ready (see `vercel.json`)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  CostPilot   │────▶│  OpenAI/    │
│             │     │  Middleware  │     │  Anthropic  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐       ┌──────────┐       ┌──────────┐
   │ Router  │       │  Cache   │       │  Tracker │
   └─────────┘       └──────────┘       └──────────┘
```

## Configuration

Edit `config.yaml` for:
- Rate limiting
- Budget limits
- Model routing tiers
- Cache settings
- Auth API keys

## Development

```bash
# Install dependencies
npm install

# Copy environment
cp .env.example .env

# Start server
npm start

# Visit http://localhost:3000
```

## License

MIT — use it freely, contribute if you want!

---

**Stop overpaying for AI.** Start saving today with CostPilot.
