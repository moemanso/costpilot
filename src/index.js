/**
 * CostPilot - AI Cost Optimization Middleware
 * Main Express Server
 * 
 * Features:
 * - Proxies OpenAI/Anthropic API calls
 * - Intelligent model routing based on complexity
 * - Semantic caching to avoid duplicate requests
 * - Cost tracking per user/project
 * - Budget enforcement
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const yaml = require('js-yaml');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, '..', 'config.yaml');
let config;
try {
  config = yaml.load(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('Failed to load config.yaml:', e.message);
  process.exit(1);
}

// Import modules
const router = require('./router');
const cache = require('./cache');
const costTracker = require('./costTracker');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Configure appropriately for production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-project-id']
}));

// Logging
const logFormat = config.logging?.format === 'json' 
  ? ':method :url :status :res[content-length] - :response-time ms'
  : 'json';
app.use(morgan(logFormat));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit?.windowMs || 60000,
  max: config.rateLimit?.maxRequests || 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    cacheEnabled: config.cache?.enabled || false,
    budgetEnabled: !!config.budget?.defaultMonthlyLimit
  });
});

// Auth middleware
const authMiddleware = require('./middleware/auth');

// API routes
const apiRoutes = require('./routes/api');
const proxyRoutes = require('./routes/proxy');

// Mount routes
app.use('/api', authMiddleware, apiRoutes);
app.use('/proxy', authMiddleware, proxyRoutes);

// Serve frontend dashboard
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Don't expose internal errors
  const statusCode = err.statusCode || 500;
  const message = config.logging?.level === 'debug' ? err.message : 'Internal server error';
  
  res.status(statusCode).json({
    error: message,
    ...(config.logging?.level === 'debug' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize modules and start server
async function start() {
  try {
    // Initialize cache
    if (config.cache?.enabled) {
      cache.initialize(config.cache);
      console.log('✓ Cache initialized');
    }

    // Initialize cost tracker
    costTracker.initialize(config.tracking);
    console.log('✓ Cost tracker initialized');

    // Start server
    const port = config.server?.port || 3000;
    const host = config.server?.host || '0.0.0.0';
    
    app.listen(port, host, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                    CostPilot v1.0.0                    ║
║               AI Cost Optimization Middleware         ║
╠═══════════════════════════════════════════════════════╣
║  Server:    http://${host}:${port}                       ║
║  Dashboard: http://${host}:${port}/dashboard              ║
║  Health:    http://${host}:${port}/health                 ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

start();

module.exports = app;
