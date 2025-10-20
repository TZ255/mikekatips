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
const { LinkToRedirect } = require('../utils/affLinktoRedirect');
const { unconfirmUserSubscription } = require('../utils/confirmSubscription');

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


// Helper function to generate dynamic title and navigation data
function generateDateNavigation(currentDate, currentRoute = '/') {
  const dateStr = currentDate.format('YYYY-MM-DD');
  const today = dayjs().tz(TZ);
  const yesterday = today.subtract(1, 'day');
  const tomorrow = today.add(1, 'day');
  
  // Generate Swahili day name and title
  const dayOfWeek = currentDate.day();
  const swahiliDay = swahiliDays[dayOfWeek];
  const formattedDate = currentDate.format('DD/MM/YYYY');
  
  // Determine active navigation based on current route or date comparison
  let activeNav = 'leo'; // default
  if (currentRoute === '/utabiri-wa-mechi-za-jana' || currentDate.isSame(yesterday, 'day')) {
    activeNav = 'jana';
  } else if (currentRoute === '/utabiri-wa-mechi-za-kesho' || currentDate.isSame(tomorrow, 'day')) {
    activeNav = 'kesho';
  }
  
  return {
    activeNav,
    currentDateDisplay: formattedDate,
    currentDateFull: `${swahiliDay}, ${formattedDate}`,
    swahiliDay,
    yesterdayDate: yesterday.format('YYYY-MM-DD'),
    todayDate: today.format('YYYY-MM-DD'),
    tomorrowDate: tomorrow.format('YYYY-MM-DD')
  };
}

// Home page - Today's matches
router.get('/', freshUserInfo, async (req, res) => {
  try {
    const currentDate = dayjs().tz(TZ, false);
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    // Generate navigation data
    const navData = generateDateNavigation(currentDate, '/');
    
    // Fetch free tips (limit to first 50)
    const freeTips = await Tip.find({
      date: dateStr,
      isPremium: false
    }).sort({ time: 1 }).limit(50);
    
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
    
    res.render('index', {
      page_url: `https://mikekatips.co.tz`,
      page: 'index',
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

// Yesterday's matches
router.get('/utabiri-wa-mechi-za-jana', freshUserInfo, async (req, res) => {
  try {
    const currentDate = dayjs().tz(TZ).subtract(1, 'day');
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    // Generate navigation data
    const navData = generateDateNavigation(currentDate, '/utabiri-wa-mechi-za-jana');
    
    // Fetch free tips
    const freeTips = await Tip.find({
      date: dateStr,
      isPremium: false
    }).sort({ time: 1 }).limit(50);
    
    // Fetch premium tips
    const premiumTips = await Tip.find({
      date: dateStr,
      isPremium: true
    }).sort({ time: 1 });
    
    // Fetch recent predictions
    const predictions = await Prediction.find({ 
      date: dateStr,
      status: 'published'
    }).select('-body'); // Exclude body for listing

    //add jana to the swahiliday  
    navData.swahiliDay = `Jana, ${navData.swahiliDay}`
    
    // Generate modified date for SEO
    const today = dayjs().tz(TZ);
    const modifiedDate = currentDate.endOf('day').format();
    
    res.render('index', {
      page_url: `https://mikekatips.co.tz/utabiri-wa-mechi-za-jana`,
      page: 'index-jana',
      freeTips,
      premiumTips,
      predictions,
      currentDate: dateStr,
      modifiedDate,
      ...navData
    });
  } catch (error) {
    console.error('Jana route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

//redirect to affiliate link based on comp
router.get('/goto/:comp', async (req, res) => {
  try {
    const comp = req.params.comp;
    const redirectLink = await LinkToRedirect(comp);
    res.redirect(redirectLink);
  } catch (error) {
    console.error('Affiliate redirect error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Tomorrow's matches
router.get('/utabiri-wa-mechi-za-kesho', freshUserInfo, async (req, res) => {
  try {
    const currentDate = dayjs().tz(TZ).add(1, 'day');
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    // Generate navigation data
    const navData = generateDateNavigation(currentDate, '/utabiri-wa-mechi-za-kesho');
    
    // Fetch free tips
    const freeTips = await Tip.find({
      date: dateStr,
      isPremium: false
    }).sort({ time: 1 }).limit(50);
    
    // Fetch premium tips
    const premiumTips = await Tip.find({
      date: dateStr,
      isPremium: true
    }).sort({ time: 1 });
    
    // Fetch recent predictions
    const predictions = await Prediction.find({ 
      date: dateStr,
      status: 'published' 
    });

    //add kesho to the swahiliday  
    navData.swahiliDay = `Kesho, ${navData.swahiliDay}`
    
    // Generate modified date for SEO
    const today = dayjs().tz(TZ);
    const modifiedDate = today.startOf('day').format();
    
    res.render('index', {
      page_url: `https://mikekatips.co.tz/utabiri-wa-mechi-za-kesho`,
      page: 'index-kesho',
      freeTips,
      premiumTips,
      predictions,
      currentDate: dateStr,
      modifiedDate,
      ...navData
    });
  } catch (error) {
    console.error('Kesho route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

// Date-specific tips page (kept for SEO purposes)
router.get('/date/:date', freshUserInfo, async (req, res) => {
  try {
    const currentDate = dayjs(req.params.date).tz(TZ, false);
    const dateStr = currentDate.format('YYYY-MM-DD');
    
    // Generate navigation data
    const navData = generateDateNavigation(currentDate);
    
    // Fetch free tips (limit to first 50)
    const freeTips = await Tip.find({
      date: dateStr,
      isPremium: false
    }).sort({ time: 1 }).limit(50);
    
    // Fetch premium tips
    const premiumTips = await Tip.find({
      date: dateStr,
      isPremium: true
    }).sort({ time: 1 });
    
    // Fetch recent predictions
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
      page_url: `https://mikekatips.co.tz/date/${dateStr}`,
      page: 'index-date',
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

// Privacy Policy
router.get('/privacy-policy', (req, res) => {
  res.render('privacy-policy', {
    title: 'Sera ya Faragha - MikekaTips.co.tz'
  });
});

// Terms of Service
router.get('/terms-of-service', (req, res) => {
  res.render('terms-of-service', {
    title: 'Masharti ya Huduma - MikekaTips.co.tz'
  });
});

//disabling user payments
router.get('/payments/disable', (req, res) => {
  // Logic to disable user payments
  unconfirmUserSubscription("janjatzblog@gmail.com")
  res.end()
});

module.exports = router;