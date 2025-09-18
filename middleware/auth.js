const initializeFirebase = require('../config/firebase');
const User = require('../models/User');

const admin = initializeFirebase();

// Middleware to check if user is authenticated (required)
const authMiddleware = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Login Kuendelea')
  return res.redirect('/auth/login');
};

// Middleware to check if user has paid subscription
const freshUserInfo = async (req, res, next) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return next() //user will be null in main server with res.locals
    }

    // Fetch fresh user data from database
    const user = await User.findById(sessionUser.id);

    if (!user) {
      req.session.destroy();
      return res.redirect('/')
    }

    // Check payment status with fresh data
    if (user.isPaid && (user.expiresAt && new Date() > new Date(user.expiresAt))) {
      user.isPaid = false
      user.expiresAt = null
      await user.save()
    }

    // Build fresh user payload
    const fresh = {
      id: user._id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      isPaid: user.isPaid,
      expiresAt: user.expiresAt
    };

    // Expose fresh user for this request and views
    req.user = fresh;
    res.locals.user = fresh;

    // Keep session user in sync so subsequent requests see updated info
    // Only update when something changed to avoid unnecessary session writes
    const keys = ['id', 'uid', 'email', 'name', 'role', 'isPaid', 'expiresAt'];
    const changed = !sessionUser || keys.some(k => String(sessionUser[k]) !== String(fresh[k]));
    if (changed) {
      req.session.user = fresh;
    }

    next();
  } catch (error) {
    console.error('Payment middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user is admin
const adminMiddleware = async (req, res, next) => {
  try {
    const sessionUser = req.session.user

    if (!sessionUser) {
      req.flash('error', 'Not authorized. No session')
      return res.redirect('/');
    }

    // Fetch fresh user data from database
    const user = await User.findById(sessionUser.id);

    if (!user) {
      req.session.destroy();
      req.flash('error', 'No user found for the session')
      return res.redirect('/');
    }

    if (user.role !== 'admin') {
      req.flash('error', 'User is not admin')
      return res.redirect('/');
    }

    // Build fresh user payload
    const fresh = {
      id: user._id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      isPaid: user.isPaid,
      expiresAt: user.expiresAt
    };
    // Expose fresh user for this request and views
    req.user = fresh;
    res.locals.user = fresh;
    // Sync session user if changed
    const sessUser = req.session.user;
    const keys = ['id', 'uid', 'email', 'name', 'role', 'isPaid', 'expiresAt'];
    const changed = !sessUser || keys.some(k => String(sessUser[k]) !== String(fresh[k]));
    if (changed) {
      req.session.user = fresh;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    return res.redirect('/');
  }
};

module.exports = {
  authMiddleware,
  freshUserInfo,
  adminMiddleware
};
