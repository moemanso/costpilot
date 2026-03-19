// Main chat endpoint for Vercel Serverless
const DEFAULT_BUDGET = 100;

// In-memory session storage
const sessions = new Map();

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
  const pricing = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 }
  };
  return pricing[modelName] || { input: 0.0025, output: 0.01 };
}

// Select model based on complexity
function selectModel(complexity) {
  const models = {
    simple: { provider: 'openai', model: 'gpt-4o-mini' },
    medium: { provider: 'openai', model: 'gpt-4o' },
    complex: { provider: 'openai', model: 'gpt-4-turbo' }
  };
  return models[complexity] || models.simple;
}

// Demo response generator (fallback when no API key)
function getDemoResponse(userMessage) {
  const demoResponses = [
    {
      triggers: ['hello', 'hi', 'hey'],
      response: "Hi there! I'm CostPilot - your smart AI assistant. I optimize for both quality and cost by routing your questions to the cheapest model that can handle them.\n\nTry asking me something!",
      model: 'gpt-4o-mini'
    },
    {
      triggers: ['help', 'what can you do'],
      response: "I can help with coding, writing, analysis, and general questions. I automatically pick the right model for your query complexity.\n\nSimple questions use cheap models ($0.15/1M tokens), while complex tasks use more capable ones.",
      model: 'gpt-4o-mini'
    }
  ];

  const lowerMessage = userMessage.toLowerCase();
  for (const demo of demoResponses) {
    for (const trigger of demo.triggers) {
      if (lowerMessage.includes(trigger)) {
        return { response: demo.response, model: demo.model };
      }
    }
  }

  return {
    response: "That's an interesting question! Based on my analysis, here's what I'd suggest. For most use cases, starting simple and iterating is better than over-engineering upfront.\n\nWould you like me to elaborate?",
    model: 'gpt-4o-mini'
  };
}

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, apiKey, sessionId, budget } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Support both apiKey (singular) and apiKeys (object with multiple providers)
    const apiKeys = apiKey || req.body.apiKeys || {};
    const hasApiKey = (typeof apiKeys === 'string' && apiKeys.trim()) || 
                      (typeof apiKeys === 'object' && Object.values(apiKeys).some(k => k && k.trim()));
    
    // Fallback to demo mode if no API key provided
    if (!hasApiKey) {
      // Get or create demo session
      const demoSessionId = 'demo_' + (sessionId || 'default');
      let session = sessions.get(demoSessionId);
      if (!session) {
        session = {
          messages: [],
          totalSpent: 0,
          totalSaved: 0,
          budget: budget || DEFAULT_BUDGET,
          isDemo: true
        };
      }
      
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
    let session = sessions.get(regularSessionId);
    if (!session) {
      session = {
        messages: [],
        totalSpent: 0,
        totalSaved: 0,
        budget: budget || DEFAULT_BUDGET,
        apiKeys: apiKeys
      };
    }
    sessions.set(regularSessionId, session);
    
    // Get the first available API key
    let activeApiKey = '';
    if (typeof apiKeys === 'object') {
      activeApiKey = apiKeys.openai || apiKeys.anthropic || apiKeys.google || apiKeys.openrouter || '';
    } else {
      activeApiKey = apiKeys;
    }
    
    // Update API key if provided
    if (JSON.stringify(apiKeys) !== JSON.stringify(session.apiKeys)) {
      session.apiKeys = apiKeys;
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
    
    // Detect which provider to use based on API key
    let provider = 'openai';
    let model = 'gpt-4o-mini';
    
    if (activeApiKey.startsWith('sk-or-')) {
      provider = 'openrouter';
      model = 'openai/gpt-4o-mini'; // OpenRouter model ID
    } else if (activeApiKey.startsWith('sk-ant-')) {
      provider = 'anthropic';
      model = 'claude-3-haiku-20240307';
    } else if (activeApiKey.startsWith('AIza')) {
      provider = 'google';
      model = 'gemini-1.5-pro';
    } else {
      // Default to OpenAI
      provider = 'openai';
      model = 'gpt-4o-mini';
    }
    
    const selectedModel = { provider, model };
    const expensiveModel = { model: provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4-turbo' };
    const selectedPricing = getModelPricing(selectedModel.model);
    const expensivePricing = getModelPricing(expensiveModel.model);
    
    // Add user message to history
    session.messages.push({ role: 'user', content: message });
    
    // Call the appropriate API based on provider
    let apiUrl, apiHeaders, apiBody;
    
    if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      apiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeApiKey}`,
        'HTTP-Referer': 'https://costpilot-nine.vercel.app',
        'X-Title': 'CostPilot'
      };
      apiBody = {
        model: 'openai/gpt-4o-mini',
        messages: session.messages.slice(-10),
        max_tokens: complexity === 'simple' ? 50 : complexity === 'medium' ? 500 : 2000
      };
    } else if (provider === 'anthropic') {
      apiUrl = 'https://api.anthropic.com/v1/messages';
      apiHeaders = {
        'Content-Type': 'application/json',
        'x-api-key': activeApiKey,
        'anthropic-version': '2023-06-01'
      };
      apiBody = {
        model: 'claude-3-haiku-20240307',
        max_tokens: complexity === 'simple' ? 50 : complexity === 'medium' ? 500 : 2000,
        messages: session.messages.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : m.role, content: m.content }))
      };
    } else {
      // OpenAI
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      apiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeApiKey}`
      };
      apiBody = {
        model: 'gpt-4o-mini',
        messages: session.messages.slice(-10),
        max_tokens: complexity === 'simple' ? 50 : complexity === 'medium' ? 500 : 2000
      };
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(apiBody)
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
      warning: session.totalSpent >= session.budget * 0.75
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
