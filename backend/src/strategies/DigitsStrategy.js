const BaseStrategy = require('./BaseStrategy');

class DigitsStrategy extends BaseStrategy {
  constructor(config = {}) {
    super(config);
    this.digitsHistory = [];
    this.patterns = config.patterns || ['even', 'odd', 'over50', 'under50'];
  }

  addDigit(digit, timestamp) {
    this.digitsHistory.push({ digit, timestamp });
    if (this.digitsHistory.length > 50) {
      this.digitsHistory.shift();
    }
  }

  analyzeDigitPattern() {
    if (this.digitsHistory.length < 10) return null;
    
    const last10 = this.digitsHistory.slice(-10);
    const last5 = this.digitsHistory.slice(-5);
    
    // Pattern detection logic
    let pattern = null;
    
    // Check for repetition
    const allSame = last5.every(d => d.digit === last5[0].digit);
    if (allSame) {
      pattern = 'REPETITION';
    }
    
    // Check for alternating pattern
    let alternating = true;
    for (let i = 1; i < last5.length; i++) {
      if (last5[i].digit === last5[i-1].digit) {
        alternating = false;
        break;
      }
    }
    if (alternating) {
      pattern = 'ALTERNATING';
    }
    
    return pattern;
  }

  async analyze(currentDigit) {
    this.addDigit(currentDigit, Date.now());
    
    const pattern = this.analyzeDigitPattern();
    let confidence = 0;
    let prediction = null;
    
    switch(pattern) {
      case 'REPETITION':
        // Predict opposite after 3 repeats
        if (this.digitsHistory.slice(-3).every(d => d.digit === this.digitsHistory[this.digitsHistory.length-1].digit)) {
          prediction = currentDigit > 5 ? 'UNDER' : 'OVER';
          confidence = 75;
        }
        break;
        
      case 'ALTERNATING':
        // Continue alternating pattern
        const lastDigit = this.digitsHistory[this.digitsHistory.length-1].digit;
        prediction = lastDigit > 5 ? 'UNDER' : 'OVER';
        confidence = 65;
        break;
        
      default:
        // Use statistical analysis
        const avg = this.digitsHistory.slice(-20).reduce((sum, d) => sum + d.digit, 0) / 20;
        prediction = currentDigit > avg ? 'UNDER' : 'OVER';
        confidence = 55;
    }
    
    return {
      signal: prediction,
      confidence: confidence,
      pattern: pattern,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = DigitsStrategy;
