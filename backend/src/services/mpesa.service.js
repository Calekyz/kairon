const axios = require('axios');
const crypto = require('crypto');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    
    // Set the base URL based on environment
    this.baseUrl = this.environment === 'production' 
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Generate OAuth Access Token
   * Required for all M-Pesa API calls
   */
  async getAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      console.error('M-Pesa Token Generation Error:', error.response?.data || error.message);
      throw new Error('Failed to generate M-Pesa access token');
    }
  }

  /**
   * Generate STK Push Password
   * Combination of Shortcode + Passkey + Timestamp
   */
  generatePassword(timestamp) {
    const str = `${this.shortcode}${this.passkey}${timestamp}`;
    return Buffer.from(str).toString('base64');
  }

  /**
   * Generate Timestamp in required format: YYYYMMDDHHMMSS
   */
  generateTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   * Sends payment prompt to customer's phone
   * @param {string} phoneNumber - Customer phone number (format: 2547XXXXXXXX)
   * @param {number} amount - Amount to charge
   * @param {string} accountReference - Transaction reference (e.g., Invoice number)
   * @param {string} transactionDesc - Transaction description
   */
  async stkPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      // Format phone number (remove leading 0 or +254)
      let formattedPhone = phoneNumber.toString();
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
      }
      
      const token = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);
      
      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: accountReference.substring(0, 12),
        TransactionDesc: transactionDesc.substring(0, 13),
      };
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return {
        success: true,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      };
    } catch (error) {
      console.error('STK Push Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Payment initiation failed',
      };
    }
  }

  /**
   * Query STK Push Transaction Status
   * @param {string} checkoutRequestId - The CheckoutRequestID from stkPush response
   */
  async queryStatus(checkoutRequestId) {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);
      
      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return {
        success: true,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
        amount: response.data.Amount,
        transactionId: response.data.CheckoutRequestID,
        mpesaReceiptNumber: response.data.MpesaReceiptNumber,
      };
    } catch (error) {
      console.error('Query Status Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || 'Status query failed',
      };
    }
  }
}

module.exports = MpesaService;
