// Demo chat endpoint for Vercel Serverless
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

const defaultDemoResponse = {
  response: "That's an interesting question! Based on my analysis, here's what I'd suggest:\n\nThe key factors to consider are your specific requirements, budget constraints, and timeline. For most use cases, starting simple and iterating is better than over-engineering upfront.\n\nWould you like me to elaborate on any particular aspect? I'm happy to dive deeper into the technical details, provide code examples, or help you think through the tradeoffs.",
  model: 'gpt-4o-mini'
};

function getDemoResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  for (const demo of demoResponses) {
    for (const trigger of demo.triggers) {
      if (lowerMessage.includes(trigger)) {
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
  
  const variance = (Math.random() - 0.5) * 0.001;
  return {
    response: defaultDemoResponse.response,
    model: defaultDemoResponse.model,
    cost: 0.0003 + variance,
    saved: 0.006 + variance * 2
  };
}

// In-memory session storage (resets on cold start - acceptable for demo)
const sessions = new Map();

const DEFAULT_BUDGET = 100;

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
    const { message, sessionId } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get or create demo session
    const demoSessionId = 'demo_' + (sessionId || 'default');
    let session = sessions.get(demoSessionId);
    if (!session) {
      session = {
        messages: [],
        totalSpent: 0,
        totalSaved: 0,
        budget: DEFAULT_BUDGET,
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
    
    // Persist session in memory
    sessions.set(demoSessionId, session);
    
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
};
