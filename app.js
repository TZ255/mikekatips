const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const fileUpload = require("express-fileupload");
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
require('dotenv').config();

// Global error handling
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION!...');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack trace:', err.stack);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED PROMISE REJECTION! Shutting down...');
  console.error('Error:', err);
});

const connectDB = require('./config/database');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require("dayjs/plugin/timezone");
const { notifyGoogle } = require('./utils/googleIndexing');

// Extend dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = 'Africa/Nairobi';

// Routes
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const predictionRoutes = require('./routes/prediction');
const htmxRoutes = require('./routes/htmx');

const app = express()

// Connect to database
connectDB();

// Health check endpoint
app.get('/check/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', path.join(__dirname, 'views/0-layouts/main'));

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://mikekatips.fly.dev', 'https://mikekatips.co.tz', 'https://mikekatips-production.up.railway.app'] 
    : 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

// Trust proxy for Fly.io
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'mikekatips.session',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60, // 7 days (1 week) in seconds
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (1 week)
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax'
  }
}));

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
  // Prefer request-scoped user (fresh), fallback to session user
  res.locals.user = req.user || req.session.user || null;
  // Only read (and clear) flash if it exists to avoid modifying new sessions
  const hasFlash = req.session && req.session.flash && Object.keys(req.session.flash).length > 0;
  res.locals.messages = hasFlash ? req.flash() : {};
  next();
});

// Routes
app.use(indexRoutes);
app.use(paymentRoutes);
app.use(authRoutes);
app.use(predictionRoutes);
app.use(htmxRoutes);
app.use(adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Ukurasa Haujapatikana - MikekaTips',
    user: req.user
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', {
    title: 'Hitilafu ya Seva - MikekaTips',
    user: req.user
  });
});

// Daily indexing schedule - Check every minute for 00:00 EAT
setInterval(() => {
  const currentTime = dayjs().tz(TZ);
  const hour = currentTime.hour();
  const minute = currentTime.minute();
  
  // If it's exactly 00:00 EAT
  if (hour === 0 && minute === 0 && process.env.NODE_ENV == 'production') {
    console.log('🕛 Midnight detected - Notifying Google for new day content');
    
    notifyGoogle('https://mikekatips.co.tz')
      .then(() => {
        console.log('✅ Successfully notified Google about homepage update');
      })
      .catch(error => {
        console.error('❌ Failed to notify Google:', error.message);
      });
  }
}, 60000); // Check every minute (60 seconds)

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`⏰ Daily indexing scheduler started for ${TZ} timezone`);
});
