const express = require('express');
const router = express.Router();
const MpesaService = require('../services/mpesa.service');
const authMiddleware = require('../middleware/auth.middleware');
const crypto = require('crypto');

const mpesa = new MpesaService();

// Subscription plans with M-Pesa pricing
const PLANS = {
  basic_monthly: {
    name: 'Basic Trader - Monthly',
    price: 49,
    durationDays: 30,
    features: ['Real-time signals', 'Email support', 'Basic indicators']
  },
  basic_yearly: {
    name: 'Basic Trader - Yearly',
    price: 499,
    durationDays: 365,
    features: ['Real-time signals', 'Email support', 'Basic indicators', '2 months free']
  },
  pro_monthly: {
    name: 'Pro Trader - Monthly',
    price: 99,
    durationDays: 30,
    features: ['Advanced signals', 'Priority support', 'Multiple timeframes']
  },
  pro_yearly: {
    name: 'Pro Trader - Yearly',
    price: 999,
    durationDays: 365,
    features: ['Advanced signals', 'Priority support', 'Multiple timeframes', 'Risk management', '3 months free']
  },
  enterprise_monthly: {
    name: 'Enterprise - Monthly',
    price: 299,
    durationDays: 30,
    features: ['Custom strategies', 'Dedicated support', 'API access', 'White-label option']
  },
  enterprise_yearly: {
    name: 'Enterprise - Yearly',
    price: 2999,
    durationDays: 365,
    features: ['Custom strategies', 'Dedicated support', 'API access', 'White-label option', '5 months free']
  }
};

// Get available plans
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// Initiate M-Pesa payment (Protected route)
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { planId, phoneNumber } = req.body;
    
    if (!PLANS[planId]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }
    
    const plan = PLANS[planId];
    const transactionRef = `KAIRON-${req.user.id}-${Date.now()}`;
    
    // Initiate STK Push
    const result = await mpesa.stkPush(
      phoneNumber,
      plan.price,
      transactionRef,
      `${plan.name} Subscription`
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    // Store pending transaction in database
    await req.db.query(`
      INSERT INTO payments (
        user_id, amount, payment_method, transaction_id, 
        subscription_plan, subscription_months, status, mpesa_checkout_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      req.user.id,
      plan.price,
      'mpesa',
      transactionRef,
      planId,
      Math.floor(plan.durationDays / 30),
      'pending',
      result.checkoutRequestId
    ]);
    
    res.json({
      success: true,
      message: 'STK Push sent to your phone. Please enter your M-Pesa PIN to complete payment.',
      checkoutRequestId: result.checkoutRequestId,
      transactionRef: transactionRef
    });
    
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// M-Pesa Callback URL (Receives payment confirmation)
router.post('/callback', express.json(), async (req, res) => {
  try {
    console.log('M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));
    
    const { Body } = req.body;
    
    if (!Body || !Body.stkCallback) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    
    const { 
      ResultCode, 
      ResultDesc, 
      CheckoutRequestID,
      CallbackMetadata 
    } = Body.stkCallback;
    
    // Find the pending transaction
    const paymentResult = await req.db.query(`
      SELECT id, user_id, subscription_plan, subscription_months
      FROM payments 
      WHERE mpesa_checkout_id = $1 AND status = 'pending'
      ORDER BY id DESC
      LIMIT 1
    `, [CheckoutRequestID]);
    
    if (paymentResult.rows.length === 0) {
      console.log('No pending transaction found for CheckoutRequestID:', CheckoutRequestID);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    
    const payment = paymentResult.rows[0];
    
    if (ResultCode === 0) {
      // Payment successful
      let amount = null;
      let mpesaReceiptNumber = null;
      
      if (CallbackMetadata && CallbackMetadata.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'Amount') amount = item.Value;
          if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
        }
      }
      
      // Update payment record
      await req.db.query(`
        UPDATE payments 
        SET status = 'completed', 
            mpesa_receipt_number = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [mpesaReceiptNumber, payment.id]);
      
      // Calculate subscription end date
      const durationDays = payment.subscription_months * 30;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);
      
      // Activate user subscription
      await req.db.query(`
        UPDATE users 
        SET subscription_status = 'active',
            subscription_tier = $1,
            subscription_start_date = CURRENT_TIMESTAMP,
            subscription_end_date = $2
        WHERE id = $3
      `, [payment.subscription_plan, endDate, payment.user_id]);
      
      console.log(`Subscription activated for user ${payment.user_id} until ${endDate}`);
      
    } else {
      // Payment failed
      await req.db.query(`
        UPDATE payments 
        SET status = 'failed', 
            failure_reason = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [ResultDesc, payment.id]);
      
      console.log(`Payment failed for user ${payment.user_id}: ${ResultDesc}`);
    }
    
    // Always respond with success to M-Pesa
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    
  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// Check payment status
router.get('/status/:checkoutRequestId', authMiddleware, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    
    const result = await mpesa.queryStatus(checkoutRequestId);
    
    if (result.success && result.resultCode === '0') {
      // Update subscription if query shows success
      const paymentResult = await req.db.query(`
        SELECT id, user_id, subscription_plan
        FROM payments 
        WHERE mpesa_checkout_id = $1 AND status = 'pending'
      `, [checkoutRequestId]);
      
      if (paymentResult.rows.length > 0) {
        const payment = paymentResult.rows[0];
        
        // Find plan duration
        const plan = PLANS[payment.subscription_plan];
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.durationDays);
        
        await req.db.query(`
          UPDATE payments SET status = 'completed' WHERE id = $1
        `, [payment.id]);
        
        await req.db.query(`
          UPDATE users 
          SET subscription_status = 'active',
              subscription_tier = $1,
              subscription_start_date = CURRENT_TIMESTAMP,
              subscription_end_date = $2
          WHERE id = $3
        `, [payment.subscription_plan, endDate, payment.user_id]);
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

module.exports = router;
