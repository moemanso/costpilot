/**
 * Cost Tracker
 * Tracks spend per user/project/model with budget enforcement
 */

let config = {};
let tracking = {
  byUser: new Map(),
  byProject: new Map(),
  byModel: new Map(),
  global: {
    totalSpend: 0,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    savingsFromCache: 0,
    savingsFromRouting: 0
  }
};

/**
 * Initialize cost tracker with configuration
 */
function initialize(cfg) {
  config = {
    trackPerUser: cfg.trackPerUser !== false,
    trackPerProject: cfg.trackPerProject !== false,
    trackPerModel: cfg.trackPerModel !== false,
    retentionDays: cfg.retentionDays || 90
  };
  
  console.log(`  Tracking: user=${config.trackPerUser}, project=${config.trackPerProject}, model=${config.trackPerModel}`);
}

/**
 * Record a request cost
 */
function record({
  userId,
  projectId,
  model,
  provider,
  inputTokens,
  outputTokens,
  inputCost,
  outputCost,
  cached = false,
  tier = 'unknown',
  originalCost, // What it would have cost without routing optimization
  requestId
}) {
  const totalCost = inputCost + outputCost;
  const timestamp = Date.now();
  
  // Global tracking
  tracking.global.totalSpend += totalCost;
  tracking.global.totalRequests++;
  tracking.global.totalInputTokens += inputTokens;
  tracking.global.totalOutputTokens += outputTokens;
  
  if (cached) {
    tracking.global.savingsFromCache += totalCost;
  }
  
  if (originalCost && originalCost > totalCost) {
    tracking.global.savingsFromRouting += (originalCost - totalCost);
  }
  
  // Per-user tracking
  if (config.trackPerUser && userId) {
    if (!tracking.byUser.has(userId)) {
      tracking.byUser.set(userId, {
        userId,
        totalSpend: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        savingsFromCache: 0,
        savingsFromRouting: 0,
        firstRequest: timestamp,
        lastRequest: timestamp
      });
    }
    
    const userData = tracking.byUser.get(userId);
    userData.totalSpend += totalCost;
    userData.totalRequests++;
    userData.totalInputTokens += inputTokens;
    userData.totalOutputTokens += outputTokens;
    userData.lastRequest = timestamp;
    
    if (cached) userData.savingsFromCache += totalCost;
    if (originalCost && originalCost > totalCost) {
      userData.savingsFromRouting += (originalCost - totalCost);
    }
  }
  
  // Per-project tracking
  if (config.trackPerProject && projectId) {
    const projectKey = `${userId}:${projectId}`;
    if (!tracking.byProject.has(projectKey)) {
      tracking.byProject.set(projectKey, {
        userId,
        projectId,
        totalSpend: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        savingsFromCache: 0,
        savingsFromRouting: 0,
        firstRequest: timestamp,
        lastRequest: timestamp
      });
    }
    
    const projectData = tracking.byProject.get(projectKey);
    projectData.totalSpend += totalCost;
    projectData.totalRequests++;
    projectData.totalInputTokens += inputTokens;
    projectData.totalOutputTokens += outputTokens;
    projectData.lastRequest = timestamp;
    
    if (cached) projectData.savingsFromCache += totalCost;
    if (originalCost && originalCost > totalCost) {
      projectData.savingsFromRouting += (originalCost - totalCost);
    }
  }
  
  // Per-model tracking
  if (config.trackPerModel && model) {
    const modelKey = `${provider}:${model}`;
    if (!tracking.byModel.has(modelKey)) {
      tracking.byModel.set(modelKey, {
        provider,
        model,
        totalSpend: 0,
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        tier,
        firstRequest: timestamp,
        lastRequest: timestamp
      });
    }
    
    const modelData = tracking.byModel.get(modelKey);
    modelData.totalSpend += totalCost;
    modelData.totalRequests++;
    modelData.totalInputTokens += inputTokens;
    modelData.totalOutputTokens += outputTokens;
    modelData.lastRequest = timestamp;
  }
  
  return {
    success: true,
    totalCost,
    requestId
  };
}

/**
 * Get global stats
 */
function getGlobalStats() {
  return {
    ...tracking.global,
    savingsTotal: tracking.global.savingsFromCache + tracking.global.savingsFromRouting,
    averageCostPerRequest: tracking.global.totalRequests > 0 
      ? (tracking.global.totalSpend / tracking.global.totalRequests).toFixed(4) 
      : 0
  };
}

/**
 * Get stats for a user
 */
function getUserStats(userId) {
  if (!config.trackPerUser || !tracking.byUser.has(userId)) {
    return null;
  }
  
  const data = tracking.byUser.get(userId);
  return {
    ...data,
    savingsTotal: data.savingsFromCache + data.savingsFromRouting,
    averageCostPerRequest: data.totalRequests > 0 
      ? (data.totalSpend / data.totalRequests).toFixed(4) 
      : 0
  };
}

/**
 * Get all users (for admin dashboard)
 */
function getAllUsers() {
  return Array.from(tracking.byUser.values())
    .map(u => ({
      userId: u.userId,
      totalSpend: u.totalSpend.toFixed(4),
      totalRequests: u.totalRequests,
      savingsTotal: (u.savingsFromCache + u.savingsFromRouting).toFixed(4)
    }));
}

/**
 * Get stats for a project
 */
function getProjectStats(userId, projectId) {
  const projectKey = `${userId}:${projectId}`;
  if (!config.trackPerProject || !tracking.byProject.has(projectKey)) {
    return null;
  }
  
  const data = tracking.byProject.get(projectKey);
  return {
    ...data,
    savingsTotal: data.savingsFromCache + data.savingsFromRouting,
    averageCostPerRequest: data.totalRequests > 0 
      ? (data.totalSpend / data.totalRequests).toFixed(4) 
      : 0
  };
}

/**
 * Get model breakdown
 */
function getModelStats() {
  return Array.from(tracking.byModel.values())
    .map(m => ({
      provider: m.provider,
      model: m.model,
      tier: m.tier,
      totalSpend: m.totalSpend.toFixed(4),
      totalRequests: m.totalRequests,
      totalInputTokens: m.totalInputTokens,
      totalOutputTokens: m.totalOutputTokens
    }))
    .sort((a, b) => parseFloat(b.totalSpend) - parseFloat(a.totalSpend));
}

/**
 * Check if user/project is over budget
 */
function checkBudget(userId, projectId, monthlyLimit) {
  const projectKey = `${userId}:${projectId}`;
  const projectData = tracking.byProject.get(projectKey);
  
  if (!projectData) {
    return { withinBudget: true, percentage: 0 };
  }
  
  const spent = projectData.totalSpend;
  const percentage = (spent / monthlyLimit) * 100;
  
  return {
    withinBudget: spent <= monthlyLimit,
    spent: spent.toFixed(4),
    limit: monthlyLimit,
    percentage: percentage.toFixed(2),
    warning: percentage >= 75,
    critical: percentage >= 90
  };
}

/**
 * Reset tracking (for testing)
 */
function reset() {
  tracking = {
    byUser: new Map(),
    byProject: new Map(),
    byModel: new Map(),
    global: {
      totalSpend: 0,
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      savingsFromCache: 0,
      savingsFromRouting: 0
    }
  };
}

module.exports = {
  initialize,
  record,
  getGlobalStats,
  getUserStats,
  getAllUsers,
  getProjectStats,
  getModelStats,
  checkBudget,
  reset
};
