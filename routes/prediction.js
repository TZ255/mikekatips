const express = require('express');
const Prediction = require('../models/Prediction');
const { parseMarkdown } = require('../utils/mdParser');
const { freshUserInfo } = require('../middleware/auth');

const router = express.Router();

// Predictions index page - show 7 predictions
router.get('/prediction', freshUserInfo, async (req, res) => {
  try {
    const predictions = await Prediction.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(7);
    
    res.render('prediction/index', {
      predictions,
      title: 'Predictions za Mchezo - MikekaTips',
      description: 'Pata predictions za hali ya juu za michezo ya mpira wa miguu kutoka kwa wataalamu.',
      keywords: 'predictions, mchezo wa mpira, soka, tanzania, betting predictions'
    });
  } catch (error) {
    console.error('Predictions route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Prediction details page
router.get('/prediction/:slug', freshUserInfo, async (req, res) => {
  try {
    const prediction = await Prediction.findOne({ 
      slug: req.params.slug,
      status: 'published' 
    });
    
    if (!prediction) {
      return res.status(404).render('404', {
        title: 'Prediction Haijapatikana - MikekaTips'
      });
    }

    //todays date in yyyy-mm-dd tanzania timezone
    const date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Nairobi' });

    //get todays predictions, exclude current slug
    const other_predictions = await Prediction.find({ 
      date: prediction.date,
      status: 'published',
      slug: { $ne: req.params.slug }
    }).select('title slug match date time').sort('time');

    const parsedContent = await parseMarkdown(prediction.body)
    
    res.render('prediction/prediction-details', {
      other_predictions,
      title: prediction.title + ' - MikekaTips',
      description: prediction.description,
      keywords: prediction.keywords,
      tip: prediction.prediction,
      odds: prediction.odds,
      match: prediction.match,
      league: prediction.league,
      date: prediction.date,
      time: prediction.time,
      contentHtml: parsedContent,
      slug: prediction.slug,
      affiliate: prediction.affiliate
    });
  } catch (error) {
    console.error('Prediction details route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
