const cron = require('node-cron');
const { notifyGoogle } = require('../utils/googleIndexing');

const TIMEZONE = 'Africa/Nairobi';
const SCHEDULE = '0 0 * * *';
const HOMEPAGE_URL = 'https://mikekatips.co.tz';

async function notifyHomepageNow(trigger = 'manual') {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[google-indexing] skipped ${trigger} run because NODE_ENV is not production`);
    return;
  }

  try {
    console.log(`[google-indexing] starting ${trigger} notify for ${HOMEPAGE_URL}`);
    await notifyGoogle(HOMEPAGE_URL);
    console.log('[google-indexing] homepage notify completed');
  } catch (error) {
    console.error('[google-indexing] notify failed:', error.message);
  }
}

function startGoogleIndexingCron() {
  cron.schedule(
    SCHEDULE,
    () => {
      notifyHomepageNow('cron').catch((error) => {
        console.error('[google-indexing] cron notify crashed:', error.message);
      });
    },
    { timezone: TIMEZONE }
  );

  console.log(`[google-indexing] scheduler started with cron "${SCHEDULE}" (${TIMEZONE})`);
}

module.exports = {
  notifyHomepageNow,
  startGoogleIndexingCron
};
