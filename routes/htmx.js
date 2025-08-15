const express = require('express');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require("dayjs/plugin/timezone")
const Tip = require('../models/Tip');

const router = express.Router();

//extending dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = 'Africa/Nairobi'

// Load more tips endpoint
router.post('/load-more-tips/:date', async (req, res) => {
  try {
    const dateStr = req.params.date;
    
    // Fetch remaining tips (skip first 10)
    const remainingTips = await Tip.find({
      date: dateStr,
      isPremium: false
    }).sort({ time: 1 }).skip(15);
    
    res.render('zz-fragments/tips', { freeTips: remainingTips, layout: false });
  } catch (error) {
    console.error('Load more tips error:', error);
    res.status(500).send('<div class="alert alert-danger">Kuna hitilafu imetokea. Jaribu tena.</div>');
  }
});

module.exports = router;