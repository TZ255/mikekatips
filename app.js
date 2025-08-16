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
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
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

// Health check endpoint (before any middleware)
app.get('/check/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

// View engine
console.log('🎨 Setting up view engine...');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', path.join(__dirname, 'views/0-layouts/main'));

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://mikekatips.fly.dev', 'https://mikekatips.co.tz', 'https://mikekatips-production.up.railway.app/'] 
    : 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
// CORS: allow all temporarily
app.use(cors({
  origin: true,          // reflect the request origin
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {fallthrough: true}));
app.use(fileUpload());

// Trust proxy for Fly.io
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Session configuration
console.log('🔐 Setting up sessions...');
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'mikekatips.session',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 24 hours in seconds
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax'
  }
}));

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
  // Set user from session for Firebase auth
  res.locals.user = req.session.user || null;
  res.locals.messages = req.flash();
  next();
});

// Routes
console.log('🛣️ Setting up routes...');
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

// // Daily indexing schedule - Check every minute for 00:00 EAT
// setInterval(() => {
//   const currentTime = dayjs().tz(TZ);
//   const hour = currentTime.hour();
//   const minute = currentTime.minute();
  
//   // If it's exactly 00:00 EAT
//   if (hour === 0 && minute === 0) {
//     console.log('🕛 Midnight detected - Notifying Google for new day content');
    
//     notifyGoogle('https://mikekatips.co.tz')
//       .then(() => {
//         console.log('✅ Successfully notified Google about homepage update');
//       })
//       .catch(error => {
//         console.error('❌ Failed to notify Google:', error.message);
//       });
//   }
// }, 60000); // Check every minute (60 seconds)

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`⏰ Daily indexing scheduler started for ${TZ} timezone`);
});