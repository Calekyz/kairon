const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const DerivService = require('../services/deriv.service');

const router = express.Router();

// Apply auth middleware to all trading routes
router.use(authMiddleware);

// Get market analysis signal
router.post('/signal', async (req, res) => {
  try {
    const { symbol = 'R_100', duration = 5 } = req.body;
    
    // Initialize Deriv service
    const derivService = new DerivService();
    await derivService.connect();
    
    // Get current market data
    const marketData = await derivService.getTick(symbol);
    
    // Apply your strategy logic here
    // This is where your proprietary algorithm goes
    const signal = generateTradingSignal(marketData);
    
    await derivService.disconnect();
    
    res.json({
      symbol,
      timestamp: new Date().toISOString(),
      signal,
      currentPrice: marketData.tick,
      recommendation: signal === 'RISE' ? 'CALL' : 'PUT'
    });
  } catch (error) {
    console.error('Signal generation error:', error);
    res.status(500).json({ error: 'Failed to generate signal' });
  }
});

// Your proprietary strategy logic
function generateTradingSignal(marketData) {
  // This is where you implement your actual strategy
  // For demonstration, using a simple moving average crossover
  // Replace this with your actual algorithm
  
  const { tick, epoch } = marketData;
  
  // Example: Simple RSI-like logic
  // In production, you would analyze multiple ticks
  
  const randomFactor = Math.sin(epoch) * 100;
  const signal = randomFactor > 0 ? 'RISE' : 'FALL';
  
  // Your actual strategy would go here
  // Including analysis of multiple timeframes, indicators, etc.
  
  return signal;
}

// Get historical data for analysis
router.post('/historical', async (req, res) => {
  try {
    const { symbol = 'R_100', count = 100, endEpoch } = req.body;
    
    const derivService = new DerivService();
    await derivService.connect();
    
    const historicalData = await derivService.getHistoricalTicks(symbol, count, endEpoch);
    
    await derivService.disconnect();
    
    res.json({
      symbol,
      count: historicalData.length,
      data: historicalData
    });
  } catch (error) {
    console.error('Historical data error:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

module.exports = router;
