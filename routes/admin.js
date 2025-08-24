const express = require('express');
const dayjs = require('dayjs');
const Tip = require('../models/Tip');
const Prediction = require('../models/Prediction');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { processTipsForDate } = require('../utils/tipsProcessor');
const { notifyMultipleUrls, submitToIndexNow } = require('../utils/googleIndexing');

const router = express.Router();

// Admin dashboard
router.get('/admin', adminMiddleware, async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const tips = await Tip.find({ date: today }).sort({ time: 1 });
    
    res.render('admin/dashboard', {
      tips,
      title: 'Admin Dashboard - MikekaTips',
      currentDate: today,
      user: req.user
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// List all tips with pagination
router.get('/admin/tips', adminMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    const tips = await Tip.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalTips = await Tip.countDocuments();
    const totalPages = Math.ceil(totalTips / limit);
    
    res.render('admin/tips', {
      tips,
      currentPage: page,
      totalPages,
      title: 'Manage Tips - Admin'
    });
  } catch (error) {
    console.error('Admin tips error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Show add tip form
router.get('/admin/tips/add', adminMiddleware, (req, res) => {
  res.render('admin/add-tip', {
    title: 'Add New Tip - Admin',
    error: req.query.error
  });
});

// Create new tip
router.post('/admin/tips/add', adminMiddleware, async (req, res) => {
  try {
    const { match, league, tip, odds, isPremium, date, time } = req.body;
    
    const newTip = new Tip({
      match,
      league,
      tip,
      odds,
      isPremium: isPremium === 'true',
      date,
      time
    });
    
    await newTip.save();
    
    res.redirect('/admin/tips?success=Tip added successfully');
  } catch (error) {
    console.error('Add tip error:', error);
    res.redirect('/admin/tips/add?error=Failed to add tip');
  }
});

// Create new bettingtipsters
router.post('/admin/tips/add/bettingtipsters', adminMiddleware, async (req, res) => {
  try {
    const { date2 } = req.body;
    const htmfile = req.files?.htmfile
    
    if (!date2 || !htmfile) {
      req.flash('File upload data missing');
      return res.redirect('/admin/tips/add')
    }

    const scraping = await processTipsForDate(date2, htmfile.data.toString())

    if(!scraping.success) {
      req.flash('error', `${scraping.message} & Google indexing not notified`);
      return res.redirect('/admin/tips');
    }
    
    // Notify Google about updated content
    try {
      const baseUrl = 'https://mikekatips.co.tz';
      
      const urlsToNotify = [
        `${baseUrl}/utabiri-wa-mechi-za-kesho`
      ];
      
      //notify google
      const indexingResults = await notifyMultipleUrls(urlsToNotify);
      console.log('Google indexing results:', indexingResults);

      //notify indexnow (multiple search engines)
      const indexNowResult = await submitToIndexNow(urlsToNotify)
      
      const indexingSuccess = indexingResults.every(result => result?.success);
      req.flash('success', `${scraping.message} & Google indexing: ${indexingSuccess ? 'Success' : 'Failed'} & IndexNow: ${indexNowResult.success ? 'Success' : 'Failed'}`);
    } catch (indexingError) {
      console.error('Indexing notification failed:', indexingError);
      req.flash('success', scraping.message);
    }
    
    res.redirect('/admin/tips');
  } catch (error) {
    console.error('Add tip error:', error);
    res.redirect('/admin/tips/add?error=Failed to add tip');
  }
});

// Show edit tip form
router.get('/admin/tips/edit/:id', adminMiddleware, async (req, res) => {
  try {
    const tip = await Tip.findById(req.params.id);
    
    if (!tip) {
      req.flash('error', 'Tip not found')
      return res.redirect('/admin/tips');
    }
    
    res.render('admin/edit-tip', {
      tip,
      title: 'Edit Tip - Admin'
    });
  } catch (error) {
    console.error('Edit tip route error:', error);
    req.flash('error', 'Failed to load tips')
    res.redirect('/admin/tips');
  }
});

// Update tip
router.post('/admin/tips/edit/:id', adminMiddleware, async (req, res) => {
  try {
    const { match, league, tip, odds, isPremium, date, time, status } = req.body;
    
    await Tip.findByIdAndUpdate(req.params.id, {
      match,
      league,
      tip,
      odds,
      isPremium: isPremium === 'true',
      date,
      time,
      status
    });
    
    req.flash('success', 'Tip updated successfully')
    res.redirect('/admin/tips');
  } catch (error) {
    console.error('Update tip error:', error);
    req.flash('error', 'Failed to update tip')
    res.redirect('/admin/tips');
  }
});

// Delete tip
router.post('/admin/tips/delete/:id', adminMiddleware, async (req, res) => {
  try {
    await Tip.findByIdAndDelete(req.params.id);
    req.flash('success', 'Tip deleted successfully')
    res.redirect('/admin/tips');
  } catch (error) {
    console.error('Delete tip error:', error);
    req.flash('error', 'Failed to delete tip')
    res.redirect('/admin/tips');
  }
});

// API endpoints for admin
router.get('/admin/api/stats', adminMiddleware, async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    
    const stats = {
      totalTips: await Tip.countDocuments(),
      todayTips: await Tip.countDocuments({ date: today }),
      freeTips: await Tip.countDocuments({ isPremium: false }),
      premiumTips: await Tip.countDocuments({ isPremium: true }),
      wonTips: await Tip.countDocuments({ status: 'won' }),
      lostTips: await Tip.countDocuments({ status: 'lost' })
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

// === PREDICTION ROUTES ===

// List all predictions with pagination
router.get('/admin/predictions', adminMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const predictions = await Prediction.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalPredictions = await Prediction.countDocuments();
    const totalPages = Math.ceil(totalPredictions / limit);
    
    res.render('admin/predictions', {
      predictions,
      currentPage: page,
      totalPages,
      title: 'Manage Predictions - Admin',
      user: req.user
    });
  } catch (error) {
    console.error('Admin predictions error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Show add prediction form
router.get('/admin/predictions/add', adminMiddleware, (req, res) => {
  res.render('admin/add-prediction', {
    title: 'Add New Prediction - Admin',
    user: req.user
  });
});

// Create new prediction
router.post('/admin/predictions/add', adminMiddleware, async (req, res) => {
  try {
    const { 
      title, snippet_text, body, league, date, time, odds, 
      affiliate, description, keywords, status 
    } = req.body;
    
    const newPrediction = new Prediction({
      title,
      snippet_text,
      body,
      league,
      date,
      time,
      odds,
      affiliate: affiliate || 'betway',
      description,
      keywords,
      status: status || 'published'
    });
    
    await newPrediction.save();
    
    req.flash('success', 'Prediction created successfully!');
    res.redirect('/admin/predictions');
  } catch (error) {
    console.error('Add prediction error:', error);
    req.flash('error', 'Failed to create prediction');
    res.redirect('/admin/predictions/add');
  }
});

// Show edit prediction form
router.get('/admin/predictions/edit/:id', adminMiddleware, async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id);
    
    if (!prediction) {
      req.flash('error', 'Prediction not found');
      return res.redirect('/admin/predictions');
    }
    
    res.render('admin/edit-prediction', {
      prediction,
      title: 'Edit Prediction - Admin',
      user: req.user
    });
  } catch (error) {
    console.error('Edit prediction route error:', error);
    req.flash('error', 'Failed to load prediction');
    res.redirect('/admin/predictions');
  }
});

// Update prediction
router.post('/admin/predictions/edit/:id', adminMiddleware, async (req, res) => {
  try {
    const { 
      title, snippet_text, body, league, date, time, odds, 
      affiliate, description, keywords, status 
    } = req.body;
    
    await Prediction.findByIdAndUpdate(req.params.id, {
      title,
      snippet_text,
      body,
      league,
      date,
      time,
      odds,
      affiliate: affiliate || 'betway',
      description,
      keywords,
      status: status || 'published'
    });
    
    req.flash('success', 'Prediction updated successfully!');
    res.redirect('/admin/predictions');
  } catch (error) {
    console.error('Update prediction error:', error);
    req.flash('error', 'Failed to update prediction');
    res.redirect('/admin/predictions');
  }
});

// Delete prediction
router.post('/admin/predictions/delete/:id', adminMiddleware, async (req, res) => {
  try {
    await Prediction.findByIdAndDelete(req.params.id);
    req.flash('success', 'Prediction deleted successfully!');
    res.redirect('/admin/predictions');
  } catch (error) {
    console.error('Delete prediction error:', error);
    req.flash('error', 'Failed to delete prediction');
    res.redirect('/admin/predictions');
  }
});

module.exports = router;