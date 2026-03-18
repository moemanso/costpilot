/**
 * Intelligent Model Router
 * Routes requests to cheapest viable model based on complexity
 */

const fs = require('fs');
const path = require('path');

let config;

function loadConfig() {
  if (!config) {
    const configPath = path.join(__dirname, '..', '..', 'config.yaml');
    config = require('js-yaml').load(fs.readFileSync(configPath, 'utf8'));
  }
  return config;
}

/**
 * Analyze request complexity based on:
 * - Input token count (estimated)
 * - Presence of specific keywords suggesting complex tasks
 * - System prompt length
 * - Requested max_tokens
 */
function analyzeComplexity(reqBody) {
  const cfg = loadConfig();
  const routing = cfg.routing || {};
  const tiers = routing.tiers || [];
  
  // Estimate input tokens (rough: ~4 chars per token)
  let estimatedInputTokens = 0;
  
  if (reqBody.messages) {
    const content = reqBody.messages
      .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
      .join(' ');
    estimatedInputTokens = Math.ceil(content.length / 4);
  }
  
  // Check for complex task indicators
  const complexKeywords = [
    'analyze', 'compare', 'evaluate', 'explain', 'detailed',
    'comprehensive', 'research', 'write code', 'debug', 'review',
    'architect', 'design', 'plan', 'strategy', 'synthesize'
  ];
  
  const contentStr = JSON.stringify(reqBody).toLowerCase();
  const complexityScore = complexKeywords.filter(kw => contentStr.includes(kw)).length;
  
  // Factor in max_tokens
  const maxTokens = reqBody.max_tokens || 100;
  
  // Determine complexity tier
  // Simple: < 100 tokens, no complex keywords
  // Medium: 100-500 tokens OR 1-2 complex keywords
  // Complex: > 500 tokens OR 3+ complex keywords
  
  if (estimatedInputTokens < 100 && complexityScore <= 1 && maxTokens <= 100) {
    return tiers.find(t => t.name === 'simple') || tiers[0];
  } else if (estimatedInputTokens < 500 && complexityScore <= 2 && maxTokens <= 1000) {
    return tiers.find(t => t.name === 'medium') || tiers[1] || tiers[0];
  } else {
    return tiers.find(t => t.name === 'complex') || tiers[tiers.length - 1] || tiers[0];
  }
}

/**
 * Select the cheapest model from the tier
 */
function selectCheapestModel(tier) {
  if (!tier || !tier.models || tier.models.length === 0) {
    // Fallback to defaults
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      costPer1kInput: 0.00015,
      costPer1kOutput: 0.0006
    };
  }
  
  // Sort by average cost (input + output) and pick cheapest
  const sorted = [...tier.models].sort((a, b) => {
    const aCost = (a.costPer1kInput + a.costPer1kOutput) / 2;
    const bCost = (b.costPer1kInput + b.costPer1kOutput) / 2;
    return aCost - bCost;
  });
  
  return sorted[0];
}

/**
 * Get provider configuration
 */
function getProviderConfig(provider) {
  const cfg = loadConfig();
  return cfg.routing?.providers?.[provider] || {};
}

/**
 * Main routing function
 * Returns { provider, model, endpoint, headers, tier }
 */
function routeRequest(reqBody) {
  const cfg = loadConfig();
  const routing = cfg.routing || {};
  
  // Check if user specified a specific model
  const explicitModel = reqBody.model;
  if (explicitModel) {
    // Find which provider has this model
    for (const tier of routing.tiers || []) {
      const modelConfig = tier.models?.find(m => m.model === explicitModel);
      if (modelConfig) {
        const providerCfg = getProviderConfig(modelConfig.provider);
        return {
          provider: modelConfig.provider,
          model: explicitModel,
          endpoint: providerCfg.baseUrl + (modelConfig.provider === 'openai' ? '/chat/completions' : '/messages'),
          headers: providerCfg.defaultHeaders || {},
          costPer1kInput: modelConfig.costPer1kInput,
          costPer1kOutput: modelConfig.costPer1kOutput,
          tier: tier.name,
          isExplicit: true
        };
      }
    }
  }
  
  // Auto-route based on complexity
  const tier = analyzeComplexity(reqBody);
  const model = selectCheapestModel(tier);
  const providerCfg = getProviderConfig(model.provider);
  
  return {
    provider: model.provider,
    model: model.model,
    endpoint: providerCfg.baseUrl + (model.provider === 'openai' ? '/chat/completions' : '/messages'),
    headers: providerCfg.defaultHeaders || {},
    costPer1kInput: model.costPer1kInput,
    costPer1kOutput: model.costPer1kOutput,
    tier: tier?.name || 'unknown',
    isExplicit: false
  };
}

/**
 * Estimate cost for a request
 */
function estimateCost(reqBody, routeInfo) {
  const inputTokens = Math.ceil((JSON.stringify(reqBody).length / 4));
  const outputTokens = reqBody.max_tokens || 100;
  
  const inputCost = (inputTokens / 1000) * routeInfo.costPer1kInput;
  const outputCost = (outputTokens / 1000) * routeInfo.costPer1kOutput;
  
  return {
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedInputCost: inputCost,
    estimatedOutputCost: outputCost,
    estimatedTotalCost: inputCost + outputCost
  };
}

module.exports = {
  routeRequest,
  analyzeComplexity,
  selectCheapestModel,
  getProviderConfig,
  estimateCost
};
