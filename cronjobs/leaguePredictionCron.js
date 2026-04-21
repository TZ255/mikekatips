const cron = require('node-cron');
const { syncConfiguredLeagues } = require('../utils/leaguePredictionSync');
const { isApiFootballConfigured } = require('../utils/apiFootball');

const TIMEZONE = 'Africa/Nairobi';
const SCHEDULE = '47 4,12 * * *';

let syncInProgress = false;

async function syncLeagueDataNow(trigger = 'manual') {
  if (syncInProgress) {
    const message = `Skipped ${trigger} sync because another sync is still running`;
    console.log(`[league-sync] ${message.toLowerCase()}`);
    return {
      success: false,
      message,
      results: []
    };
  }

  if (!isApiFootballConfigured()) {
    const message = 'API_FOOTBALL_KEY is missing';
    console.log(`[league-sync] skipped because ${message}`);
    return {
      success: false,
      message,
      results: []
    };
  }

  syncInProgress = true;

  try {
    console.log(`[league-sync] starting ${trigger} sync`);
    const result = await syncConfiguredLeagues();
    console.log('[league-sync] completed', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('[league-sync] failed:', error.message);
    return {
      success: false,
      message: error.message,
      results: []
    };
  } finally {
    syncInProgress = false;
  }
}

function startLeaguePredictionCron() {
  cron.schedule(
    SCHEDULE,
    () => {
      syncLeagueDataNow('cron').catch((error) => {
        console.error('[league-sync] cron sync crashed:', error.message);
      });
    },
    { timezone: TIMEZONE }
  );

  console.log(`[league-sync] scheduler started with cron "${SCHEDULE}" (${TIMEZONE})`);
}

module.exports = {
  runLeagueSync: syncLeagueDataNow,
  syncLeagueDataNow,
  startLeaguePredictionCron
};
