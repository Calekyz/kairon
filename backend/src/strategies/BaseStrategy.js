class BaseStrategy {
  constructor(config) {
    this.config = config;
    this.historicalData = [];
    this.signals = [];
  }

  addPriceData(price, timestamp) {
    this.historicalData.push({ price, timestamp });
    // Keep last 1000 candles for performance
    if (this.historicalData.length > 1000) {
      this.historicalData.shift();
    }
  }

  calculateSMA(period) {
    if (this.historicalData.length < period) return null;
    const sum = this.historicalData.slice(-period).reduce((acc, data) => acc + data.price, 0);
    return sum / period;
  }

  calculateRSI(period = 14) {
    if (this.historicalData.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = this.historicalData.length - period; i < this.historicalData.length; i++) {
      const change = this.historicalData[i].price - this.historicalData[i-1].price;
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateBollingerBands(period = 20, multiplier = 2) {
    const sma = this.calculateSMA(period);
    if (!sma) return null;
    
    const variance = this.historicalData.slice(-period).reduce((acc, data) => {
      return acc + Math.pow(data.price - sma, 2);
    }, 0) / period;
    
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + (stdDev * multiplier),
      middle: sma,
      lower: sma - (stdDev * multiplier)
    };
  }

  async analyze() {
    throw new Error('analyze() must be implemented by child class');
  }
}

module.exports = BaseStrategy;
