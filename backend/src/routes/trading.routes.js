const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const DerivService = require('../services/deriv.service');
const RiseFallStrategy = require('../strategies/RiseFallStrategy');
const DigitsStrategy = require('../strategies/DigitsStrategy');
const router = express.Router();

// Store strategy instances per user (in production, use Redis)
const userStrategies = new Map();

router.use(authMiddleware);

router.post('/signal', async (req, res) => {
  const startTime = Date.now();
  const { symbol = 'R_100', market = 'rise_fall' } = req.body;
  
  try {
    const derivService = new DerivService();
    await derivService.connect();
    
    // Get current tick
    const currentTick = await derivService.getTick(symbol);
    
    // Get or create strategy instance for user
    let strategy = userStrategies.get(`${req.user.id}_${symbol}`);
    if (!strategy) {
      if (market === 'digits') {
        strategy = new DigitsStrategy({ patterns: ['even', 'odd', 'over50', 'under50'] });
      } else {
        strategy = new RiseFallStrategy({ volatilityThreshold: 0.025 });
      }
      userStrategies.set(`${req.user.id}_${symbol}`, strategy);
    }
    
    // Get historical data for better analysis
    const historicalData = await derivService.getHistoricalTicks(symbol, 100);
    historicalData.forEach(data => {
      if (market === 'digits') {
        const digit = Math.floor(data.price) % 10;
        strategy.addDigit(digit, data.epoch);
      } else {
        strategy.addPriceData(data.price, data.epoch);
      }
    });
    
    // Analyze for signal
    let signal;
    if (market === 'digits') {
      const digit = Math.floor(currentTick.tick) % 10;
      signal = await strategy.analyze(digit);
    } else {
      signal = await strategy.analyze(currentTick.tick);
    }
    
    await derivService.disconnect();
    
    // Log the signal generation
    const responseTime = Date.now() - startTime;
    
    // Update user stats in background (don't await)
    req.db.query(`
      UPDATE users 
      SET total_signals_generated = total_signals_generated + 1,
          last_signal_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [req.user.id]);
    
    // Log API usage
    req.db.query(`
      INSERT INTO api_usage (user_id, endpoint, response_time_ms, success)
      VALUES ($1, $2, $3, $4)
    `, [req.user.id, '/api/trading/signal', responseTime, true]);
    
    if (!signal) {
      return res.json({
        hasSignal: false,
        message: 'No clear signal at this time',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      hasSignal: true,
      market: market,
      symbol: symbol,
      currentPrice: currentTick.tick,
      signal: signal.signal,
      confidence: signal.confidence,
      reasons: signal.reasons || [],
      indicators: signal.indicators || {},
      timestamp: signal.timestamp,
      recommendation: signal.signal === 'RISE' ? 'BUY CALL' : 'BUY PUT'
    });
    
  } catch (error) {
    console.error('Signal generation error:', error);
    
    // Log failed attempt
    await req.db.query(`
      INSERT INTO api_usage (user_id, endpoint, response_time_ms, success)
      VALUES ($1, $2, $3, $4)
    `, [req.user.id, '/api/trading/signal', Date.now() - startTime, false]);
    
    res.status(500).json({ error: 'Failed to generate signal' });
  }
});

// Get strategy performance stats for user
router.get('/performance', async (req, res) => {
  try {
    const result = await req.db.query(`
      SELECT 
        COUNT(*) as total_signals,
        SUM(CASE WHEN was_successful = true THEN 1 ELSE 0 END) as successful_signals,
        AVG(CASE WHEN was_successful = true THEN 1 ELSE 0 END) * 100 as win_rate
      FROM signals_log
      WHERE user_id = $1
      AND created_at > NOW() - INTERVAL '30 days'
    `, [req.user.id]);
    
    res.json(result.rows[0] || { total_signals: 0, successful_signals: 0, win_rate: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

// Submit signal outcome (for improving strategy)
router.post('/signal-outcome', async (req, res) => {
  const { signalId, wasSuccessful } = req.body;
  
  try {
    await req.db.query(`
      UPDATE signals_log 
      SET was_successful = $1
      WHERE id = $2 AND user_id = $3
    `, [wasSuccessful, signalId, req.user.id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update signal outcome' });
  }
});

module.exports = router;
