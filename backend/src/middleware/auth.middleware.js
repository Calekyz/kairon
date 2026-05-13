const jwt = require('jsonwebtoken');
const UserModel = require('../models/User.model');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userModel = new UserModel(req.db);
    
    // Check if session is valid (anti-sharing protection)
    const isValidSession = await userModel.validateSession(decoded.userId, decoded.sessionId);
    
    if (!isValidSession) {
      return res.status(401).json({ 
        error: 'SESSION_TERMINATED',
        message: 'This session has been terminated because you logged in elsewhere. Please log in again on this device.' 
      });
    }

    // Check subscription status
    const hasActiveSubscription = await userModel.checkSubscription(decoded.userId);
    
    if (!hasActiveSubscription) {
      return res.status(403).json({ 
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew to continue using KAIRON.' 
      });
    }

    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

module.exports = authMiddleware;
