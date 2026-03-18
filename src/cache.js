/**
 * In-Memory Semantic Cache
 * Caches responses to avoid duplicate API calls
 * Uses string similarity to find near-duplicate requests
 */

const stringSimilarity = require('string-similarity');

let cache = new Map();
let config = {};
let stats = {
  hits: 0,
  misses: 0,
  evictions: 0
};

/**
 * Initialize cache with configuration
 */
function initialize(cfg) {
  config = {
    enabled: cfg.enabled !== false,
    ttlSeconds: cfg.ttlSeconds || 3600,
    maxEntries: cfg.maxEntries || 10000,
    similarityThreshold: cfg.similarityThreshold || 0.9
  };
  
  cache = new Map();
  stats = { hits: 0, misses: 0, evictions: 0 };
  
  // Periodic cleanup
  setInterval(cleanup, 60000); // Every minute
  
  console.log(`  Cache: enabled=${config.enabled}, ttl=${config.ttlSeconds}s, max=${config.maxEntries}, threshold=${config.similarityThreshold}`);
}

/**
 * Generate cache key from request
 */
function generateKey(reqBody) {
  // Normalize the request for consistent keys
  const normalized = {
    model: reqBody.model,
    messages: reqBody.messages?.map(m => ({
      role: m.role,
      content: m.content
    })),
    temperature: reqBody.temperature,
    max_tokens: reqBody.max_tokens,
    top_p: reqBody.top_p
  };
  
  return JSON.stringify(normalized);
}

/**
 * Find cached response using semantic similarity
 */
function findCached(reqBody, userId, projectId) {
  if (!config.enabled) return null;
  
  const key = generateKey(reqBody);
  const cacheKey = `${userId}:${projectId}:${key}`;
  
  // Exact match
  if (cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (!isExpired(entry)) {
      stats.hits++;
      return { ...entry.response, _cacheHit: 'exact', _cacheKey: cacheKey };
    } else {
      cache.delete(cacheKey);
    }
  }
  
  // Semantic similarity search
  const prefix = `${userId}:${projectId}:`;
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [cachedKey, entry] of cache) {
    if (!cachedKey.startsWith(prefix)) continue;
    if (isExpired(entry)) {
      cache.delete(cachedKey);
      stats.evictions++;
      continue;
    }
    
    // Compare the normalized keys
    const score = stringSimilarity.compareTwoStrings(key, cachedKey.replace(prefix, ''));
    
    if (score >= config.similarityThreshold && score > bestScore) {
      bestScore = score;
      bestMatch = { key: cachedKey, entry };
    }
  }
  
  if (bestMatch) {
    stats.hits++;
    return { 
      ...bestMatch.entry.response, 
      _cacheHit: 'semantic', 
      _similarity: bestScore,
      _cacheKey: bestMatch.key 
    };
  }
  
  stats.misses++;
  return null;
}

/**
 * Store response in cache
 */
function set(reqBody, response, userId, projectId) {
  if (!config.enabled) return null;
  
  // Evict if at capacity
  if (cache.size >= config.maxEntries) {
    evictOldest();
  }
  
  const key = generateKey(reqBody);
  const cacheKey = `${userId}:${projectId}:${key}`;
  
  cache.set(cacheKey, {
    request: reqBody,
    response,
    timestamp: Date.now(),
    expiresAt: Date.now() + (config.ttlSeconds * 1000)
  });
  
  return cacheKey;
}

/**
 * Check if cache entry is expired
 */
function isExpired(entry) {
  return Date.now() > entry.expiresAt;
}

/**
 * Remove expired entries
 */
function cleanup() {
  let removed = 0;
  for (const [key, entry] of cache) {
    if (isExpired(entry)) {
      cache.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    stats.evictions += removed;
  }
  return removed;
}

/**
 * Evict oldest entries when cache is full
 */
function evictOldest() {
  const entries = Array.from(cache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  // Remove oldest 10%
  const toRemove = Math.ceil(entries.length * 0.1);
  for (let i = 0; i < toRemove; i++) {
    cache.delete(entries[i][0]);
    stats.evictions++;
  }
}

/**
 * Clear all cache
 */
function clear() {
  const size = cache.size;
  cache.clear();
  return size;
}

/**
 * Get cache statistics
 */
function getStats() {
  const hitRate = stats.hits + stats.misses > 0 
    ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) 
    : 0;
  
  return {
    enabled: config.enabled,
    entries: cache.size,
    maxEntries: config.maxEntries,
    ttlSeconds: config.ttlSeconds,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: `${hitRate}%`,
    evictions: stats.evictions
  };
}

module.exports = {
  initialize,
  findCached,
  set,
  clear,
  getStats,
  cleanup
};
