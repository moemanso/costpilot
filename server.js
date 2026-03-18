const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const app = express();

// Load config
const configPath = path.join(__dirname, 'config.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

// Data directory for persistence
const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Persistence functions
function saveSession(sessionId, session) {
  try {
    const filePath = path.join(dataDir, `session_${sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

function loadSession(sessionId) {
  try {
    const filePath = path.join(dataDir, `session_${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load session:', err);
  }
  return null;
}

function deleteSessionFile(sessionId) {
  try {
    const filePath = path.join(dataDir, `session_${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve landing page at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Serve chat app at /chat
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve dashboard at /dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve settings at /settings
app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// In-memory session storage
const sessions = new Map();

// Demo mode responses - realistic AI answers for testing
const demoResponses = [
  {
    triggers: ['hello', 'hi', 'hey', 'start'],
    response: "Hi there! I'm CostPilot - your smart AI assistant that optimizes for both quality and cost. I route your questions to the cheapest model that can handle them, saving you up to 80% compared to using GPT-4 directly.\n\nTry asking me something!",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['help', 'what can you do', 'capabilities'],
    response: "I can help you with:\n\n• **Coding** - Debug, write, or explain code\n• **Writing** - Emails, essays, creative content\n• **Analysis** - Data, documents, problem-solving\n• **Questions** - Research, explanations, summaries\n\nI automatically pick the right model for your query complexity. Simple questions use cheap models ($0.15/1M tokens), while complex tasks use more capable ones.",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['javascript', 'js', 'code', 'programming', 'function', 'python', 'bug', 'error'],
    response: "Here's a clean solution using modern JavaScript:\n\n```javascript\nconst processData = (items) => {\n  return items\n    .filter(item => item.active)\n    .map(item => ({ ...item, value: item.value * 1.1 }))\n    .sort((a, b) => b.value - a.value);\n};\n```\n\nThis filters active items, applies a 10% boost, and sorts by value. The functional approach is more concise and easier to test than imperative loops.",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['explain', 'what is', 'how does', 'define', 'understand'],
    response: "Let me break this down for you:\n\n**Key Concepts:**\n1. First concept - the foundation of understanding\n2. Second concept - builds on the first\n3. Practical application - how to use this\n\n**Why it matters:** This approach helps you avoid common pitfalls and leverage best practices. Think of it like learning the rules before breaking them.\n\nWant me to dive deeper into any specific part?",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['write', 'email', 'create', 'draft', 'compose'],
    response: "Here's a draft for you:\n\n---\n\n**Subject:** Quick follow-up\n\nHi [Name],\n\nI wanted to follow up on our recent discussion about [topic]. Based on our conversation, I think we'd benefit from [action item].\n\nWould you have time to hop on a quick call this week to finalize the details?\n\nBest regards\n\n---\n\nFeel free to customize this with your specific details. I can adjust the tone or length if needed.",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['summarize', 'summary', 'TLDR', 'tldr'],
    response: "**Summary:**\n\n• Main point: The key takeaway\n• Supporting point 1: Evidence or context\n• Supporting point 2: Additional context\n• Action item: What to do next\n\nThis captures the essential information in a scannable format. Let me know if you'd like me to expand on any section.",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['compare', 'difference', 'vs', 'versus', 'better'],
    response: "**Comparison:**\n\n| Aspect | Option A | Option B |\n|--------|----------|----------|\n| Cost | Lower | Higher |\n| Speed | Faster | More complete |\n| Complexity | Simple | Feature-rich |\n\n**Recommendation:** For most use cases, Option A provides the best balance. However, if you need advanced features and have the budget, Option B is worth considering.\n\nWhat's most important to you - cost savings or features?",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['list', 'steps', 'how to', 'instructions', 'guide'],
    response: "Here's a step-by-step guide:\n\n**Step 1: Setup**\nBegin by ensuring your environment is configured correctly. This includes installing dependencies and setting up configuration files.\n\n**Step 2: Implementation**\nFollow the core implementation, testing each component as you go. Don't skip the testing phase - it catches issues early.\n\n**Step 3: Review**\nDouble-check your work against best practices. Look for opportunities to optimize.\n\n**Pro tip:** Document as you go - future you will thank present you.",
    model: 'gpt-4o-mini'
  },
  {
    triggers: ['recommend', 'suggestion', 'advice', 'should i', 'should we'],
    response: "Based on what you've shared, here's my recommendation:\n\n**Go with:** Option that balances cost and capability\n\n**Reasoning:**\n1. It meets your core requirements\n2. Has good track record in production\n3. Provides room to scale\n\n**Watch out for:** Potential integration challenges - plan for extra testing time.\n\n**Next steps:** I'd suggest a small proof-of-concept first to validate before full commitment. Want me to help plan that out?",
    model: 'gpt-4o'
  },
  {
    triggers: ['complex', 'architecture', 'system', 'design', 'scale'],
    response: "For a scalable architecture, I'd recommend:\n\n**High-Level Design:**\n```\n┌─────────────┐     ┌─────────────┐     ┌─────────────┐\n│   Client    │────▶│  API Layer  │────▶│   Services  │\n└─────────────┘     └─────────────┘     └─────────────┘\n                         │                    │\n                    ┌────▼────┐          ┌────▼────┐\n                    │  Cache  │          │   DB    │\n                    └─────────┘          └─────────┘\n```\n\n**Key considerations:**\n- Use caching at multiple levels\n- Implement circuit breakers for resilience\n- Plan for horizontal scaling from day one\n\nThis design handles 10x growth and can be adapted for specific needs. What specific aspect would you like to dive into?",
    model: 'gpt-4o'
  },
  {
    triggers: ['data', 'analysis', 'analyze', 'statistics', 'trends'],
    response: "Here's my analysis:\n\n**Key Findings:**\n1. **Trend 1**: Significant growth in this area (+45%)\n2. **Trend 2**: Stable performance with minor fluctuations\n3. **Anomaly**: One outlier worth investigating\n\n**Recommendations:**\n- Focus resources on the fastest-growing segment\n- Investigate the anomaly before it becomes an issue\n- Consider seasonal adjustments in your forecasting\n\nThe data suggests a positive outlook, but watch for market shifts. Need me to dig into any specific metric?",
    model: 'gpt-4o'
  }
];

// Fallback response when no match
const defaultDemoResponse = {
  response: "That's an interesting question! Based on my analysis, here's what I'd suggest:\n\nThe key factors to consider are your specific requirements, budget constraints, and timeline. For most use cases, starting simple and iterating is better than over-engineering upfront.\n\nWould you like me to elaborate on any particular aspect? I'm happy to dive deeper into the technical details, provide code examples, or help you think through the tradeoffs.",
  model: 'gpt-4o-mini'
};

function getDemoResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  for (const demo of demoResponses) {
    for (const trigger of demo.triggers) {
      if (lowerMessage.includes(trigger)) {
        // Add some randomness to make it feel more dynamic
        const variance = (Math.random() - 0.5) * 0.002;
        return {
          response: demo.response,
          model: demo.model,
          cost: 0.0004 + variance,
          saved: 0.008 + variance * 2
        };
      }
    }
  }
  
  // Return default with some variance
  const variance = (Math.random() - 0.5) * 0.001;
  return {
    response: defaultDemoResponse.response,
    model: defaultDemoResponse.model,
    cost: 0.0003 + variance,
    saved: 0.006 + variance * 2
  };
}

// Calculate message complexity (simple heuristic)
function analyzeComplexity(message) {
  const words = message.split(/\s+/).length;
  const hasCode = /```|function|const|let|var|if|for|while|class|import|export/.test(message);
  const hasMultiStep = /\?.*\?|\band then|\bstep|\bfirst|\bsecond|\bfinally|\bbecause|\bso |\breason|\bexplain/.test(message);
  const hasTechnical = /\bapi\b|\bjson\b|\bhttp\b|\bdatabase\b|\balgorithm\b|\boptimize\b|\barchitecture\b/.test(message);
  
  let score = 0;
  if (words > 100) score += 2;
  else if (words > 30) score += 1;
  
  if (hasCode) score += 2;
  if (hasMultiStep) score += 1;
  if (hasTechnical) score += 1;
  
  if (score <= 1) return 'simple';
  if (score <= 3) return 'medium';
  return 'complex';
}

// Get pricing for a model
function getModelPricing(modelName) {
  for (const tier of config.routing.tiers) {
    for (const model of tier.models) {
      if (model.model === modelName) {
        return {
          input: model.costPer1kInput,
          output: model.costPer1kOutput
        };
      }
    }
  }
  return { input: 0.0025, output: 0.01 }; // Default to gpt-4o
}

// Select model based on complexity
function selectModel(complexity) {
  const tier = config.routing.tiers.find(t => t.name === complexity);
  if (!tier || !tier.models.length) {
    return tier?.models[0] || { provider: 'openai', model: 'gpt-4o-mini' };
  }
  // Always prefer OpenAI for simplicity
  const openaiModel = tier.models.find(m => m.provider === 'openai');
  return openaiModel || tier.models[0];
}

// Calculate what the cost WOULD have been with expensive model
function getExpensiveModel(complexity) {
  const complexTier = config.routing.tiers.find(t => t.name === 'complex');
  const openaiComplex = complexTier?.models.find(m => m.provider === 'openai');
  return openaiComplex || { model: 'gpt-4-turbo', costPer1kInput: 0.01, costPer1kOutput: 0.03 };
}

// Demo chat endpoint - returns pre-scripted responses
app.post('/api/demo/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get or create demo session
    const demoSessionId = 'demo_' + (sessionId || 'default');
    let session = sessions.get(demoSessionId) || loadSession(demoSessionId);
    if (!session) {
      session = {
        messages: [],
        totalSpent: 0,
        totalSaved: 0,
        budget: config.budget.defaultMonthlyLimit,
        isDemo: true
      };
    }
    sessions.set(demoSessionId, session);
    
    // Add user message to history
    session.messages.push({ role: 'user', content: message });
    
    // Get demo response
    const demoResult = getDemoResponse(message);
    
    // Simulate token usage for realistic costs
    const inputTokens = message.split(/\s+/).length * 1.3;
    const outputTokens = demoResult.response.split(/\s+/).length * 1.3;
    const actualCost = (inputTokens / 1000) * 0.00015 + (outputTokens / 1000) * 0.0006;
    const expensiveCost = (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03;
    const saved = expensiveCost - actualCost;
    
    // Update session totals
    session.totalSpent += actualCost;
    session.totalSaved += saved;
    session.messages.push({ role: 'assistant', content: demoResult.response });
    
    // Persist session
    sessions.set(demoSessionId, session);
    saveSession(demoSessionId, session);
    
    res.json({
      response: demoResult.response,
      cost: actualCost,
      saved: saved,
      totalSpent: session.totalSpent,
      totalSaved: session.totalSaved,
      budget: session.budget,
      model: demoResult.model,
      expensiveModel: 'gpt-4-turbo',
      expensivePrice: 0.03,
      savings: Math.round((saved / expensiveCost) * 100),
      warning: false,
      isDemo: true
    });
    
  } catch (error) {
    console.error('Demo chat error:', error);
    res.status(500).json({ error: error.message || 'Demo mode error' });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, apiKey, sessionId } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Fallback to demo mode if no API key provided
    if (!apiKey?.trim()) {
      // Get or create demo session
      const demoSessionId = 'demo_' + (sessionId || 'default');
      let session = sessions.get(demoSessionId) || loadSession(demoSessionId);
      if (!session) {
        session = {
          messages: [],
          totalSpent: 0,
          totalSaved: 0,
          budget: config.budget.defaultMonthlyLimit,
          isDemo: true
        };
      }
      sessions.set(demoSessionId, session);
      
      // Add user message to history
      session.messages.push({ role: 'user', content: message });
      
      // Get demo response
      const demoResult = getDemoResponse(message);
      
      // Simulate token usage for realistic costs
      const inputTokens = message.split(/\s+/).length * 1.3;
      const outputTokens = demoResult.response.split(/\s+/).length * 1.3;
      const actualCost = (inputTokens / 1000) * 0.00015 + (outputTokens / 1000) * 0.0006;
      const expensiveCost = (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03;
      const saved = expensiveCost - actualCost;
      
      // Update session totals
      session.totalSpent += actualCost;
      session.totalSaved += saved;
      session.messages.push({ role: 'assistant', content: demoResult.response });
      
      // Persist session
      sessions.set(demoSessionId, session);
      saveSession(demoSessionId, session);
      
      return res.json({
        response: demoResult.response,
        cost: actualCost,
        saved: saved,
        totalSpent: session.totalSpent,
        totalSaved: session.totalSaved,
        budget: session.budget,
        model: demoResult.model,
        expensiveModel: 'gpt-4-turbo',
        expensivePrice: 0.03,
        savings: Math.round((saved / expensiveCost) * 100),
        warning: false,
        isDemo: true
      });
    }
    
    // Get or create session
    const regularSessionId = sessionId || 'default';
    let session = sessions.get(regularSessionId) || loadSession(regularSessionId);
    if (!session) {
      session = {
        messages: [],
        totalSpent: 0,
        totalSaved: 0,
        budget: config.budget.defaultMonthlyLimit,
        apiKey: apiKey
      };
    }
    sessions.set(regularSessionId, session);
    
    // Update API key if provided
    if (apiKey !== session.apiKey) {
      session.apiKey = apiKey;
    }
    
    // Check budget before making API call
    if (session.totalSpent >= session.budget) {
      return res.status(403).json({ 
        error: `Monthly budget of $${session.budget} exceeded. Please upgrade your budget in settings or wait for next month.`,
        errorType: 'budget_exceeded',
        totalSpent: session.totalSpent,
        budget: session.budget
      });
    }
    
    // Determine complexity and select model
    const complexity = analyzeComplexity(message);
    const selectedModel = selectModel(complexity);
    const expensiveModel = getExpensiveModel(complexity);
    const selectedPricing = getModelPricing(selectedModel.model);
    const expensivePricing = { input: expensiveModel.costPer1kInput, output: expensiveModel.costPer1kOutput };
    
    // Add user message to history
    session.messages.push({ role: 'user', content: message });
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel.model,
        messages: session.messages.slice(-10), // Keep last 10 messages for context
        max_tokens: config.routing.tiers.find(t => t.name === complexity)?.maxTokens || 500
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || 'API request failed';
      
      // Better error classification
      if (response.status === 401 || errorMessage.includes('invalid API key')) {
        return res.status(401).json({ 
          error: 'Invalid API key. Please check your OpenAI API key and try again.',
          errorType: 'invalid_api_key'
        });
      }
      
      if (response.status === 429 || errorMessage.includes('rate limit')) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Please wait a moment before sending another message.',
          errorType: 'rate_limit',
          retryAfter: errorData.error?.retry_after || 60
        });
      }
      
      if (response.status === 403 || errorMessage.includes('insufficient_quota')) {
        return res.status(403).json({ 
          error: 'API quota exceeded. Please check your OpenAI account billing.',
          errorType: 'quota_exceeded'
        });
      }
      
      return res.status(400).json({ error: errorMessage, errorType: 'api_error' });
    }
    
    const data = await response.json();
    const assistantMessage = data.choices[0]?.message?.content || 'No response';
    
    // Calculate costs
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    
    const actualCost = (inputTokens / 1000) * selectedPricing.input + (outputTokens / 1000) * selectedPricing.output;
    const expensiveCost = (inputTokens / 1000) * expensivePricing.input + (outputTokens / 1000) * expensivePricing.output;
    const saved = expensiveCost - actualCost;
    
    // Update session totals
    session.totalSpent += actualCost;
    session.totalSaved += saved;
    session.messages.push({ role: 'assistant', content: assistantMessage });
    
    // Persist session
    sessions.set(regularSessionId, session);
    saveSession(regularSessionId, session);
    
    res.json({
      response: assistantMessage,
      cost: actualCost,
      saved: saved,
      totalSpent: session.totalSpent,
      totalSaved: session.totalSaved,
      budget: session.budget,
      model: selectedModel.model,
      expensiveModel: expensiveModel.model,
      expensivePrice: expensivePricing.output,
      savings: expensiveCost > 0 ? Math.round((saved / expensiveCost) * 100) : 0,
      warning: session.totalSpent >= session.budget * config.budget.warnThreshold
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get session stats
app.get('/api/session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId) || loadSession(sessionId);
  if (!session) {
    return res.json({ totalSpent: 0, totalSaved: 0, budget: config.budget.defaultMonthlyLimit });
  }
  res.json({
    totalSpent: session.totalSpent,
    totalSaved: session.totalSaved,
    budget: session.budget,
    warning: session.totalSpent >= session.budget * config.budget.warnThreshold
  });
});

// Get dashboard data (includes message history)
app.get('/api/dashboard/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  let session = sessions.get(sessionId) || sessions.get('demo_' + sessionId) || loadSession(sessionId) || loadSession('demo_' + sessionId);
  if (!session) {
    return res.json({ 
      totalSpent: 0, 
      totalSaved: 0, 
      budget: config.budget.defaultMonthlyLimit,
      messages: [],
      history: []
    });
  }
  
  // Generate spending history (simulated for demo)
  const history = [];
  let runningTotal = 0;
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const daySpend = session.totalSpent / 7 + (Math.random() - 0.5) * 0.01;
    runningTotal += Math.max(0, daySpend);
    history.push({
      date: date.toISOString().split('T')[0],
      spent: runningTotal,
      saved: runningTotal * 0.7 // Estimated 70% savings rate
    });
  }
  
  res.json({
    totalSpent: session.totalSpent,
    totalSaved: session.totalSaved,
    budget: session.budget,
    warning: session.totalSpent >= session.budget * config.budget.warnThreshold,
    isDemo: session.isDemo || false,
    messages: session.messages.slice(-50), // Last 50 messages
    history: history
  });
});

// Update budget
app.post('/api/budget', (req, res) => {
  const { sessionId, budget } = req.body;
  const targetId = sessionId || 'default';
  let session = sessions.get(targetId) || loadSession(targetId);
  if (session) {
    session.budget = Math.max(10, Math.min(200, budget || 100));
    sessions.set(targetId, session);
    saveSession(targetId, session);
  }
  res.json({ budget: session?.budget || 100 });
});

// Clear session
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  const targetId = sessionId || 'default';
  sessions.delete(targetId);
  deleteSessionFile(targetId);
  res.json({ success: true });
});

const PORT = process.env.PORT || config.server.port || 3000;
app.listen(PORT, () => {
  console.log(`CostPilot v2 running on port ${PORT}`);
});
