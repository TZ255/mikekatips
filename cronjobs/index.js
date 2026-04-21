const { startGoogleIndexingCron, notifyHomepageNow } = require('./googleIndexingCron');
const { startLeaguePredictionCron, syncLeagueDataNow } = require('./leaguePredictionCron');

function startCronjobs() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[cronjobs] skipped because NODE_ENV is not production');
    return;
  }

  startLeaguePredictionCron();
  startGoogleIndexingCron();
}

module.exports = {
  notifyHomepageNow,
  startCronjobs,
  syncLeagueDataNow
};
