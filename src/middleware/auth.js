/**
 * Authentication Middleware
 * Supports API key and Basic auth
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

function authMiddleware(req, res, next) {
  const cfg = loadConfig();
  const authType = cfg.auth?.type || 'api-key';
  
  if (authType === 'basic') {
    // Basic auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }
    
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
    const [username, password] = credentials;
    
    // In production, validate against a user database
    // For MVP, accept any valid api key as password
    const validKeys = cfg.auth?.validApiKeys || [];
    if (!validKeys.includes(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.user = { username };
  } else {
    // API key auth (default)
    const apiKeyHeader = cfg.auth?.apiKeyHeader || 'x-api-key';
    const apiKey = req.headers[apiKeyHeader] || req.query.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required. Provide via ' + apiKeyHeader + ' header.' });
    }
    
    const validKeys = cfg.auth?.validApiKeys || [];
    if (!validKeys.includes(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    req.user = { apiKey };
  }
  
  // Extract project ID if provided
  req.projectId = req.headers['x-project-id'] || 'default';
  
  next();
}

module.exports = authMiddleware;
