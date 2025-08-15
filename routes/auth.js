const express = require('express');
const initializeFirebase = require('../config/firebase');
const User = require('../models/User');

const router = express.Router();
const admin = initializeFirebase();

// Auth page routes
router.get('/auth/login', (req, res) => {
  // If already logged in, redirect to home
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', { query: req.query });
});

router.get('/auth/register', (req, res) => {
  // If already logged in, redirect to home
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register');
});


// Login endpoint (for Firebase token verification)
router.post('/auth/verify', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken || typeof idToken !== 'string' || idToken.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid ID token required' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken.uid || !decodedToken.email) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }
    
    let user = await User.findOne({ uid: decodedToken.uid });
    
    if (!user) {
      user = await User.create({
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email.split('@')[0]
      });
    }

    // Store user in session
    req.session.user = {
      id: user._id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      isPaid: user.isPaid,
      expiresAt: user.expiresAt
    };

    res.json({ 
      success: true, 
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPaid: user.isPaid
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
});

// Logout endpoint
router.post('/auth/logout', (req, res) => {
  req.flash('success', 'Umetoka kikamilifu');
  req.session.destroy((err) => {
    res.clearCookie('connect.sid');
    if (err) {
      console.error('Session destroy error:', err);
      req.flash('error', 'Hitilafu katika kutoka');
    }
    res.redirect('/');
  });
});

// GET logout for simple links
router.get('/auth/logout', (req, res) => {
  req.flash('success', 'Umetoka kikamilifu');
  req.session.destroy((err) => {
    res.clearCookie('connect.sid');
    if (err) {
      console.error('Session destroy error:', err);
      req.flash('error', 'Hitilafu katika kutoka');
    }
    res.redirect('/');
  });
});

// Get current user
router.get('/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.status(401).json({ success: false, message: 'Not authenticated' });
  }
});

// Refresh user data
router.post('/auth/refresh', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findById(req.session.user.id);
    
    if (!user) {
      req.session.destroy();
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Update session with fresh user data
    req.session.user = {
      id: user._id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      isPaid: user.isPaid,
      expiresAt: user.expiresAt
    };

    res.json({ success: true, user: req.session.user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to refresh user data' });
  }
});

module.exports = router;