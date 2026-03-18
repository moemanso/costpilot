# CostPilot - AI Cost Optimization Middleware

A Node.js middleware that optimizes AI API costs through intelligent routing, caching, and spending tracking.

## Features

- **API Proxy**: Acts as a proxy for OpenAI and Anthropic API calls
- **Intelligent Routing**: Automatically routes requests to the cheapest viable model based on complexity
- **Semantic Caching**: Caches responses to avoid duplicate API calls
- **Cost Tracking**: Tracks spend per user, project, and model
- **Budget Enforcement**: Enforces monthly budget caps
- **Dashboard**: Real-time dashboard showing costs and savings

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start
```

## Configuration

Edit `config.yaml` to customize:

- Rate limiting
- Budget limits
- Model routing tiers
- Cache settings
- Auth API keys

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /proxy/openai` | Proxy to OpenAI with routing |
| `POST /proxy/anthropic` | Proxy to Anthropic with routing |
| `POST /proxy/chat` | Unified chat endpoint |
| `GET /api/stats` | Global statistics |
| `GET /api/users` | User cost breakdown |
| `GET /api/models` | Model usage breakdown |
| `GET /api/cache/stats` | Cache statistics |
| `GET /dashboard` | Web dashboard |

## Authentication

All API requests require an API key via the `x-api-key` header:

```bash
curl -H "x-api-key: cpilot_sk_test_123456789" http://localhost:3000/api/stats
```

Project ID can be specified via `x-project-id` header for per-project tracking.

## Example Usage

```javascript
// Call via proxy
const response = await fetch('http://localhost:3000/proxy/openai', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'cpilot_sk_test_123456789',
    'x-project-id': 'my-app'
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello!' }],
    max_tokens: 100
  })
});

const data = await response.json();
// Response includes _costpilot metadata with routing info
```

## Default API Keys

The following API keys are configured in `config.yaml`:

- `cpilot_sk_test_123456789` (test)
- `cpilot_sk_prod_987654321` (production)

**Change these in production!**

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

## License

MIT
