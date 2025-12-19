const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();

function getGoogleClient(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/google/callback`;
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

// Auth page routes
router.get('/auth/login', (req, res) => {
  // If already logged in, redirect to home
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login');
});

// Registration is disabled; funnel to login so Google flow creates accounts on first login
router.get('/auth/register', (req, res) => {
  return res.redirect('/auth/login');
});

// Start Google OAuth (server-side)
router.get('/auth/google', (req, res) => {
  const googleClient = getGoogleClient(req);
  if (!googleClient) {
    req.flash('error', 'Google Auth haijasanidiwa');
    return res.redirect('/auth/login');
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  const url = googleClient.generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  });

  console.log('Redirecting to Google OAuth URL:', url);
  res.redirect(url);
});

// Google OAuth callback
router.get('/auth/google/callback', async (req, res) => {
  const googleClient = getGoogleClient(req);
  if (!googleClient) {
    req.flash('error', 'Tatizo limetokea katika Google Auth');
    return res.redirect('/auth/login');
  }

  try {
    const { code, state } = req.query;
    if (!code) {
      req.flash('error', 'Hakuna code iliyorejeshwa kutoka Google');
      return res.redirect('/auth/login');
    }

    // Validate state parameter
    if (!state || state !== req.session.oauthState) {
      req.flash('error', 'Invalid OAuth state');
      return res.redirect('/auth/login');
    }

    // Clear stored state
    delete req.session.oauthState;

    const { tokens } = await googleClient.getToken(code);
    if (!tokens.id_token) {
      req.flash('error', 'Hakuna ID token kutoka Google');
      return res.redirect('/auth/login');
    }

    // Verify ID token and extract profile
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      req.flash('error', 'Token haijakamilika');
      return res.redirect('/auth/login');
    }

    const uid = payload.sub; // Google user ID
    const email = payload.email;
    const name = payload.name || email.split('@')[0];

    // Find existing user by uid or email
    let user = await User.findOne({ $or: [{ uid }, { email }] });
    if (!user) {
      user = await User.create({
        uid,
        email,
        name
      });
    } else {
      // Keep uid in sync if it was created via another flow
      if (!user.uid) {
        user.uid = uid;
        await user.save();
      }
    }

    // Store user in session with explicit save
    req.session.user = {
      id: user._id,
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      isPaid: user.isPaid,
      expiresAt: user.expiresAt
    };

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash('error', 'Hitilafu katika kuhifadhi kikao');
        return res.redirect('/auth/login');
      }
      return res.redirect('/');
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    req.flash('error', 'Uthibitisho haukufanikiwa');
    res.redirect('/auth/login');
  }
});

// Logout endpoint
router.post('/auth/logout', (req, res) => {
  req.flash('success', 'Umetoka kikamilifu');
  req.session.destroy((err) => {
    res.clearCookie('mikekatips.session');
    res.clearCookie('connect.sid'); // fallback for old sessions
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
    res.clearCookie('mikekatips.session');
    res.clearCookie('connect.sid'); // fallback for old sessions
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
