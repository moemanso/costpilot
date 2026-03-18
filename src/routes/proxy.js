/**
 * Proxy Routes
 * Proxy endpoints for OpenAI/Anthropic with routing, caching, and cost tracking
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const routerModule = require('../router');
const cache = require('../cache');
const costTracker = require('../costTracker');

// Generate request ID
function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * POST /proxy/openai
 * Proxy to OpenAI with intelligent routing
 */
router.post('/openai', async (req, res) => {
  const requestId = generateRequestId();
  const userId = req.user?.apiKey || req.user?.username || 'unknown';
  const projectId = req.projectId || 'default';
  
  try {
    // Route the request
    const routeInfo = routerModule.routeRequest(req.body);
    
    // Check budget
    const fs = require('fs');
    const yaml = require('js-yaml');
    const path = require('path');
    const configPath = path.join(__dirname, '..', '..', 'config.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    const monthlyLimit = config.budget?.defaultMonthlyLimit || 100;
    const budgetStatus = costTracker.checkBudget(userId, projectId, monthlyLimit);
    
    if (!budgetStatus.withinBudget) {
      return res.status(402).json({
        error: 'Budget exceeded',
        budget: budgetStatus
      });
    }
    
    // Check cache first
    const cachedResponse = cache.findCached(req.body, userId, projectId);
    
    if (cachedResponse) {
      // Return cached response with metadata
      return res.json({
        ...cachedResponse,
        _costpilot: {
          cached: true,
          cacheHitType: cachedResponse._cacheHit,
          similarity: cachedResponse._similarity,
          requestId,
          tier: routeInfo.tier,
          routedModel: routeInfo.model,
          originalModel: req.body.model || 'auto'
        }
      });
    }
    
    // Estimate cost before making request
    const estimate = routerModule.estimateCost(req.body, routeInfo);
    
    // Add warning header if approaching budget
    if (budgetStatus.warning) {
      res.set('X-Budget-Warning', `${budgetStatus.percentage}%`);
    }
    
    // Forward request to provider
    const apiKey = process.env[routeInfo.provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'];
    
    if (!apiKey) {
      return res.status(500).json({
        error: `Missing API key for ${routeInfo.provider}. Set ${routeInfo.provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} environment variable.`
      });
    }
    
    // Prepare headers
    const headers = {
      ...routeInfo.headers,
      'Authorization': `Bearer ${apiKey}`
    };
    
    // Make the request
    const response = await axios.post(
      routeInfo.endpoint,
      req.body,
      { headers, timeout: 120000 }
    );
    
    // Cache the response
    const responseData = response.data;
    cache.set(req.body, responseData, userId, projectId);
    
    // Calculate actual tokens (from response if available)
    const inputTokens = responseData.usage?.prompt_tokens || estimate.estimatedInputTokens;
    const outputTokens = responseData.usage?.completion_tokens || estimate.estimatedOutputTokens;
    const inputCost = (inputTokens / 1000) * routeInfo.costPer1kInput;
    const outputCost = (outputTokens / 1000) * routeInfo.costPer1kOutput;
    
    // Record cost
    costTracker.record({
      userId,
      projectId,
      model: routeInfo.model,
      provider: routeInfo.provider,
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      cached: false,
      tier: routeInfo.tier,
      originalCost: req.body.model ? estimate.estimatedTotalCost : null,
      requestId
    });
    
    // Return response with cost metadata
    res.json({
      ...responseData,
      _costpilot: {
        cached: false,
        requestId,
        tier: routeInfo.tier,
        routedModel: routeInfo.model,
        originalModel: req.body.model || 'auto',
        estimatedCost: estimate.estimatedTotalCost,
        actualCost: inputCost + outputCost,
        savings: req.body.model ? (estimate.estimatedTotalCost - (inputCost + outputCost)) : 0
      }
    });
    
  } catch (error) {
    console.error(`[${requestId}] Proxy error:`, error.message);
    
    // Handle axios errors
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Provider error',
        message: error.response.data?.error?.message || error.message,
        requestId
      });
    }
    
    res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      requestId
    });
  }
});

/**
 * POST /proxy/anthropic
 * Proxy to Anthropic with intelligent routing
 */
router.post('/anthropic', async (req, res) => {
  const requestId = generateRequestId();
  const userId = req.user?.apiKey || req.user?.username || 'unknown';
  const projectId = req.projectId || 'default';
  
  try {
    // Anthropic uses different request format - convert if needed
    const reqBody = {
      model: req.body.model || 'claude-3-haiku-20240307',
      messages: req.body.messages,
      max_tokens: req.body.max_tokens || 1024,
      temperature: req.body.temperature,
      top_p: req.body.top_p
    };
    
    // Route the request (reusing same logic)
    const routeInfo = routerModule.routeRequest(reqBody);
    
    // Check budget
    const fs = require('fs');
    const yaml = require('js-yaml');
    const path = require('path');
    const configPath = path.join(__dirname, '..', '..', 'config.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    const monthlyLimit = config.budget?.defaultMonthlyLimit || 100;
    const budgetStatus = costTracker.checkBudget(userId, projectId, monthlyLimit);
    
    if (!budgetStatus.withinBudget) {
      return res.status(402).json({
        error: 'Budget exceeded',
        budget: budgetStatus
      });
    }
    
    // Check cache
    const cachedResponse = cache.findCached(reqBody, userId, projectId);
    
    if (cachedResponse) {
      return res.json({
        ...cachedResponse,
        _costpilot: {
          cached: true,
          cacheHitType: cachedResponse._cacheHit,
          requestId,
          tier: routeInfo.tier,
          routedModel: routeInfo.model
        }
      });
    }
    
    // Get API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'Missing ANTHROPIC_API_KEY environment variable.'
      });
    }
    
    // Prepare headers for Anthropic
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey
    };
    
    // Make request
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      reqBody,
      { headers, timeout: 120000 }
    );
    
    const responseData = response.data;
    
    // Cache
    cache.set(reqBody, responseData, userId, projectId);
    
    // Extract usage
    const inputTokens = responseData.usage?.input_tokens || 0;
    const outputTokens = responseData.usage?.output_tokens || 0;
    const inputCost = (inputTokens / 1000) * routeInfo.costPer1kInput;
    const outputCost = (outputTokens / 1000) * routeInfo.costPer1kOutput;
    
    // Record cost
    costTracker.record({
      userId,
      projectId,
      model: routeInfo.model,
      provider: 'anthropic',
      inputTokens,
      outputTokens,
      inputCost,
      outputCost,
      cached: false,
      tier: routeInfo.tier,
      requestId
    });
    
    res.json({
      ...responseData,
      _costpilot: {
        cached: false,
        requestId,
        tier: routeInfo.tier,
        routedModel: routeInfo.model,
        actualCost: inputCost + outputCost
      }
    });
    
  } catch (error) {
    console.error(`[${requestId}] Anthropic proxy error:`, error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Anthropic error',
        message: error.response.data?.error?.message || error.message,
        requestId
      });
    }
    
    res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      requestId
    });
  }
});

/**
 * POST /proxy/chat
 * Unified chat endpoint - auto-detects provider from request or uses routing
 */
router.post('/chat', async (req, res) => {
  // If model starts with claude-, route to anthropic
  if (req.body.model?.startsWith('claude-')) {
    // Transform to anthropic format and forward
    const anthropicReq = {
      ...req.body,
      model: req.body.model,
      messages: req.body.messages
    };
    req.body = anthropicReq;
    return router.post('/anthropic').call(this, req, res);
  }
  
  // Default to OpenAI
  return router.post('/openai').call(this, req, res);
});

module.exports = router;
