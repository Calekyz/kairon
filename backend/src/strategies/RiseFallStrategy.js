const BaseStrategy = require('./BaseStrategy');

class RiseFallStrategy extends BaseStrategy {
  constructor(config = {}) {
    super(config);
    this.timeframe = config.timeframe || '1m';
    this.volatilityThreshold = config.volatilityThreshold || 0.02;
  }

  calculateVolatility() {
    if (this.historicalData.length < 20) return null;
    
    const returns = [];
    for (let i = 1; i < this.historicalData.length; i++) {
      const ret = (this.historicalData[i].price - this.historicalData[i-1].price) / this.historicalData[i-1].price;
      returns.push(ret);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  detectTrend() {
    if (this.historicalData.length < 50) return 'NEUTRAL';
    
    const sma20 = this.calculateSMA(20);
    const sma50 = this.calculateSMA(50);
    
    if (sma20 > sma50 * 1.01) return 'BULLISH';
    if (sma20 < sma50 * 0.99) return 'BEARISH';
    return 'NEUTRAL';
  }

  detectSupportResistance() {
    const prices = this.historicalData.slice(-100).map(d => d.price);
    const sorted = [...prices].sort((a, b) => a - b);
    
    // Find clusters of similar prices
    const clusters = [];
    let currentCluster = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i-1] < sorted[i] * 0.002) { // 0.2% tolerance
        currentCluster.push(sorted[i]);
      } else {
        if (currentCluster.length > 3) {
          clusters.push({
            price: currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length,
            strength: currentCluster.length
          });
        }
        currentCluster = [sorted[i]];
      }
    }
    
    const support = clusters.filter(c => c.price < prices[prices.length-1]).sort((a, b) => b.price - a.price)[0];
    const resistance = clusters.filter(c => c.price > prices[prices.length-1]).sort((a, b) => a.price - b.price)[0];
    
    return { support, resistance };
  }

  async analyze(currentPrice) {
    this.addPriceData(currentPrice, Date.now());
    
    const rsi = this.calculateRSI(14);
    const volatility = this.calculateVolatility();
    const trend = this.detectTrend();
    const sr = this.detectSupportResistance();
    const bollinger = this.calculateBollingerBands(20, 2);
    
    let signal = null;
    let confidence = 0;
    let reasons = [];
    
    // RSI oversold/overbought strategy
    if (rsi && rsi < 30) {
      signal = 'RISE';
      confidence += 40;
      reasons.push('RSI oversold');
    } else if (rsi && rsi > 70) {
      signal = 'FALL';
      confidence += 40;
      reasons.push('RSI overbought');
    }
    
    // Bollinger Bands strategy
    if (bollinger && currentPrice <= bollinger.lower) {
      signal = 'RISE';
      confidence += 30;
      reasons.push('Price at lower Bollinger Band');
    } else if (bollinger && currentPrice >= bollinger.upper) {
      signal = 'FALL';
      confidence += 30;
      reasons.push('Price at upper Bollinger Band');
    }
    
    // Trend following
    if (trend === 'BULLISH') {
      if (!signal || signal === 'RISE') {
        signal = 'RISE';
        confidence += 20;
        reasons.push('Bullish trend');
      }
    } else if (trend === 'BEARISH') {
      if (!signal || signal === 'FALL') {
        signal = 'FALL';
        confidence += 20;
        reasons.push('Bearish trend');
      }
    }
    
    // Support/Resistance breakout
    if (sr.resistance && currentPrice > sr.resistance.price) {
      signal = 'RISE';
      confidence += 25;
      reasons.push('Breaking resistance');
    } else if (sr.support && currentPrice < sr.support.price) {
      signal = 'FALL';
      confidence += 25;
      reasons.push('Breaking support');
    }
    
    // Volatility check (avoid trading in high volatility if confidence is low)
    if (volatility && volatility > this.volatilityThreshold && confidence < 60) {
      signal = null;
      reasons.push('High volatility - waiting');
    }
    
    // Final decision
    if (confidence >= 60 && signal) {
      return {
        signal: signal,
        confidence: Math.min(confidence, 95),
        reasons: reasons,
        indicators: {
          rsi: rsi,
          volatility: volatility,
          trend: trend,
          bollinger: bollinger
        },
        timestamp: new Date().toISOString()
      };
    }
    
    return null; // No clear signal
  }
}

module.exports = RiseFallStrategy;
