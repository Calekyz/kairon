const WebSocket = require('ws');

class DerivService {
  constructor() {
    this.ws = null;
    this.baseUrl = 'wss://ws.binaryws.com/websockets/v3?app_id=' + process.env.DERIV_APP_ID;
    this.token = process.env.DERIV_API_TOKEN;
    this.requestId = 1;
    this.pendingRequests = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.baseUrl);
      
      this.ws.on('open', () => {
        // Authorize with your API token
        this.sendRequest('authorize', this.token)
          .then(() => resolve())
          .catch(reject);
      });
      
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.req_id && this.pendingRequests.has(response.req_id)) {
          const { resolve, reject } = this.pendingRequests.get(response.req_id);
          this.pendingRequests.delete(response.req_id);
          
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response);
          }
        }
      });
    });
  }

  sendRequest(msgType, params = {}) {
    return new Promise((resolve, reject) => {
      const req_id = this.requestId++;
      const request = {
        [msgType]: 1,
        req_id,
        ...params
      };
      
      this.pendingRequests.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify(request));
    });
  }

  async getTick(symbol) {
    const response = await this.sendRequest('ticks', { ticks: symbol });
    return {
      tick: response.tick.quote,
      epoch: response.tick.epoch,
      symbol: symbol
    };
  }

  async getHistoricalTicks(symbol, count, endEpoch = null) {
    const request = {
      ticks_history: symbol,
      adjust_start_time: 1,
      count: count,
      end: endEpoch || 'latest',
      style: 'ticks'
    };
    
    const response = await this.sendRequest('ticks_history', request);
    return response.history.prices.map((price, index) => ({
      price,
      epoch: response.history.times[index]
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = DerivService;
