/**
 * API Routes
 * REST endpoints for dashboard and admin
 */

const express = require('express');
const router = express.Router();
const cache = require('../cache');
const costTracker = require('../costTracker');

/**
 * GET /api/stats
 * Global statistics
 */
router.get('/stats', (req, res) => {
  try {
    const global = costTracker.getGlobalStats();
    const cacheStats = cache.getStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      costs: global,
      cache: cacheStats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/users
 * List all users with their costs
 */
router.get('/users', (req, res) => {
  try {
    const users = costTracker.getAllUsers();
    res.json({
      success: true,
      users
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/:userId
 * Get specific user stats
 */
router.get('/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const stats = costTracker.getUserStats(userId);
    
    if (!stats) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: stats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

/**
 * GET /api/projects/:projectId
 * Get project stats (requires user context)
 */
router.get('/projects/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.apiKey || req.user?.username || 'unknown';
    
    const stats = costTracker.getProjectStats(userId, projectId);
    
    if (!stats) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({
      success: true,
      project: stats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project stats' });
  }
});

/**
 * GET /api/models
 * Model usage breakdown
 */
router.get('/models', (req, res) => {
  try {
    const models = costTracker.getModelStats();
    res.json({
      success: true,
      models
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch model stats' });
  }
});

/**
 * GET /api/cache/stats
 * Cache statistics
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = cache.getStats();
    res.json({
      success: true,
      cache: stats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cache stats' });
  }
});

/**
 * DELETE /api/cache
 * Clear cache
 */
router.delete('/cache', (req, res) => {
  try {
    const cleared = cache.clear();
    res.json({
      success: true,
      message: `Cleared ${cleared} cache entries`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * POST /api/cache/cleanup
 * Manually trigger cache cleanup
 */
router.post('/cache/cleanup', (req, res) => {
  try {
    const removed = cache.cleanup();
    res.json({
      success: true,
      message: `Removed ${removed} expired entries`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cleanup cache' });
  }
});

/**
 * GET /api/budget/check/:projectId
 * Check budget status for a project
 */
router.get('/budget/check/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.apiKey || req.user?.username || 'unknown';
    
    // Get budget config
    const fs = require('fs');
    const yaml = require('js-yaml');
    const path = require('path');
    const configPath = path.join(__dirname, '..', '..', 'config.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    const monthlyLimit = config.budget?.defaultMonthlyLimit || 100;
    const budgetStatus = costTracker.checkBudget(userId, projectId, monthlyLimit);
    
    res.json({
      success: true,
      budget: {
        ...budgetStatus,
        monthlyLimit,
        warnThreshold: config.budget?.warnThreshold || 0.75
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check budget' });
  }
});

module.exports = router;
