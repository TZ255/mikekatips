const express = require('express');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require("dayjs/plugin/timezone");
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const Tip = require('../models/Tip');
const Prediction = require('../models/Prediction');
const { freshUserInfo } = require('../middleware/auth');
const { scrapeTips } = require('../utils/tipsScraper');
const { processTipsForDate } = require('../utils/tipsProcessor');

const router = express.Router();

//extending dayjs
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
const TZ = 'Africa/Nairobi'

// Swahili day names
const swahiliDays = {
  0: 'Jumapili',    // Sunday
  1: 'Jumatatu',    // Monday  
  2: 'Jumanne',     // Tuesday
  3: 'Jumatano',    // Wednesday
  4: 'Alhamisi',    // Thursday
  5: 'Ijumaa',      // Friday
  6: 'Jumamosi'     // Saturday
};

// Helper function to check if tips exist for a date
async function checkTipsExist(dateStr) {
  const tipsCount = await Tip.countDocuments({ date: dateStr });
  return tipsCount > 0;
}

// Helper function to generate dynamic title and navigation data
async function generateDateNavigation(currentDate) {
  const dateStr = currentDate.format('YYYY-MM-DD');
  const prevDate = currentDate.subtract(1, 'day');
  const nextDate = currentDate.add(1, 'day');
  
  // Check if tips exist for navigation dates
  const [hasPrevTips, hasNextTips] = await Promise.all([
    checkTipsExist(prevDate.format('YYYY-MM-DD')),
    checkTipsExist(nextDate.format('YYYY-MM-DD'))
  ]);
  
  // Generate Swahili day name and title
  const dayOfWeek = currentDate.day();
  const swahiliDay = swahiliDays[dayOfWeek];
  const formattedDate = currentDate.format('DD/MM/YYYY');
  
  return {
    prevDate: prevDate.format('YYYY-MM-DD'),
    nextDate: nextDate.format('YYYY-MM-DD'),
    hasPrevTips,
    hasNextTips,
    currentDateDisplay: formattedDate,
    currentDateFull: `${swahiliDay}, ${formattedDate}`,
    prevDateDisplay: prevDate.format('DD/MM'),
    nextDateDisplay: nextDate.format('DD/MM'),
    swahiliDay
  };
}

// Home page
router.get('/', freshUserInfo, async (req, res) => {
  try {
    const currentDate = dayjs().tz(TZ, false);
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    // Generate navigation data
    const navData = await generateDateNavigation(currentDate);
    
    // Fetch free tips (limit to first 10)
    const freeTips = await Tip.find({
      date: dateStr,
      isPremium: false
    }).sort({ time: 1 }).limit(15);
    
    // Fetch premium tips
    const premiumTips = await Tip.find({
      date: dateStr,
      isPremium: true
    }).sort({ time: 1 });
    
    // Fetch recent predictions (last 3)
    const predictions = await Prediction.find({ 
      date: dateStr,
      status: 'published' 
    });

    //add leo to the swahiliday
    navData.swahiliDay = `Leo, ${navData.swahiliDay}`
    
    // Generate modified date for SEO
    const today = dayjs().tz(TZ);
    const modifiedDate = currentDate.isSameOrAfter(today, 'day')
      ? today.startOf('day').format() // Today or future: use today's start
      : currentDate.startOf('day').format(); // Past date: use that specific day's start

    console.log(modifiedDate)
    
    res.render('index', {
      freeTips,
      premiumTips,
      predictions,
      currentDate: dateStr,
      modifiedDate,
      ...navData
    });
  } catch (error) {
    console.error('Home route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Date-specific tips page
router.get('/date/:date', freshUserInfo, async (req, res) => {
  try {
    const currentDate = dayjs(req.params.date).tz(TZ, false);
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    // Generate navigation data
    const navData = await generateDateNavigation(currentDate);
    
    // Fetch free tips (limit to first 10)
    const freeTips = await Tip.find({
      date: dateStr,
      isPremium: false
    }).sort({ time: 1 }).limit(15);
    
    // Fetch premium tips
    const premiumTips = await Tip.find({
      date: dateStr,
      isPremium: true
    }).sort({ time: 1 });
    
    // Fetch recent predictions (last 3)
    const predictions = await Prediction.find({ 
      date: dateStr,
      status: 'published' 
    });
    
    // Generate modified date for SEO
    const today = dayjs().tz(TZ);
    const modifiedDate = currentDate.isSameOrAfter(today, 'day') 
      ? today.startOf('day').format() // Today or future: use today's start
      : currentDate.startOf('day').format(); // Past date: use that specific day's start
    
    res.render('index', {
      freeTips,
      premiumTips,
      predictions,
      currentDate: dateStr,
      modifiedDate,
      ...navData
    });
  } catch (error) {
    console.error('Date route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

router.get('/API/testing', async (req, res)=> {
try {
  res.end()
} catch (error) {
  console.log(error.message)
}
})



module.exports = router;