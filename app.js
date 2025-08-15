const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const fileUpload = require("express-fileupload");
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');

// Routes
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const predictionRoutes = require('./routes/prediction');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', path.join(__dirname, 'views/0-layouts/main'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 24 hours in seconds
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
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
app.use(indexRoutes);
app.use(paymentRoutes);
app.use(authRoutes);
app.use(predictionRoutes);
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});