const express = require('express');
const League = require('../models/League');
const LeaguePrediction = require('../models/LeaguePrediction');
const Prediction = require('../models/Prediction');
const { parseMarkdown } = require('../utils/mdParser');
const { freshUserInfo } = require('../middleware/auth');

const router = express.Router();

function groupPreviousRounds(fixtures, currentRoundNumber) {
  const grouped = new Map();

  fixtures.forEach((fixture) => {
    if (
      !Number.isFinite(fixture.round?.number) ||
      !Number.isFinite(currentRoundNumber) ||
      fixture.round.number >= currentRoundNumber
    ) {
      return;
    }

    if (!grouped.has(fixture.round.number)) {
      grouped.set(fixture.round.number, {
        roundName: fixture.round.name,
        roundNumber: fixture.round.number,
        fixtures: []
      });
    }

    grouped.get(fixture.round.number).fixtures.push(fixture);
  });

  return [...grouped.values()].sort((left, right) => right.roundNumber - left.roundNumber);
}

async function renderLegacyPrediction(req, res) {
  const prediction = await Prediction.findOne({
    slug: req.params.leagueRef,
    status: 'published'
  }).lean();

  if (!prediction) {
    return res.status(404).render('404', {
      title: 'Prediction Haijapatikana - MikekaTips'
    });
  }

  const otherPredictions = await Prediction.find({
    date: prediction.date,
    status: 'published',
    slug: { $ne: req.params.leagueRef }
  })
    .select('title slug match date time')
    .sort('time')
    .lean();

  const parsedContent = await parseMarkdown(prediction.body);

  return res.render('prediction/prediction-details', {
    other_predictions: otherPredictions,
    title: `${prediction.title} - MikekaTips`,
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
}

router.get('/prediction', freshUserInfo, async (req, res) => {
  try {
    const leagues = await League.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    const cards = await Promise.all(
      leagues.map(async (league) => {
        const [currentCount, nextCount] = await Promise.all([
          league.rounds?.current?.name
            ? LeaguePrediction.countDocuments({
                leagueId: league.leagueId,
                season: league.season,
                'round.name': league.rounds.current.name
              })
            : 0,
          league.rounds?.next?.name
            ? LeaguePrediction.countDocuments({
                leagueId: league.leagueId,
                season: league.season,
                'round.name': league.rounds.next.name
              })
            : 0
        ]);

        return {
          ...league,
          currentCount,
          nextCount
        };
      })
    );

    res.set('Cache-Control', 'public, max-age=3600');
    res.render('prediction/index', {
      leagues: cards,
      title: 'Ligi za Utabiri - MikekaTips',
      description: 'Chagua ligi unayotaka kuona utabiri wa round ya sasa, round inayofuata, matokeo ya rounds zilizopita na msimamo wa ligi.',
      keywords: 'utabiri wa ligi, predictions za soka, premier league, la liga, serie a, bundesliga, ligue 1'
    });
  } catch (error) {
    console.error('Prediction leagues route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

router.get('/prediction/:leagueRef', freshUserInfo, async (req, res) => {
  try {
    const leagueId = Number(req.params.leagueRef);

    if (!Number.isInteger(leagueId)) {
      return renderLegacyPrediction(req, res);
    }

    const league = await League.findOne({ leagueId, isActive: true }).lean();
    if (!league) {
      return res.status(404).render('404', {
        title: 'Ligi Haijapatikana - MikekaTips'
      });
    }

    const fixtures = await LeaguePrediction.find({
      leagueId: league.leagueId,
      season: league.season
    })
      .sort({ 'round.number': 1, kickoffAt: 1 })
      .lean();

    const currentRoundName = league.rounds?.current?.name || null;
    const nextRoundName = league.rounds?.next?.name || null;
    const currentRoundNumber = league.rounds?.current?.number;

    const currentRoundFixtures = fixtures.filter((fixture) => fixture.round?.name === currentRoundName);
    const nextRoundFixtures = fixtures.filter((fixture) => fixture.round?.name === nextRoundName);
    const previousRounds = groupPreviousRounds(fixtures, currentRoundNumber);

    res.set('Cache-Control', 'public, max-age=3600');
    res.render('prediction/league-details', {
      league,
      currentRoundFixtures,
      nextRoundFixtures,
      previousRounds,
      standings: league.standings?.rows || [],
      title: `${league.title} - MikekaTips`,
      description: `${league.title}. Ona meza ya round ya sasa, round inayofuata, matokeo ya rounds zilizopita na msimamo wa ligi.`,
      keywords: `${league.country} ${league.name}, utabiri wa ligi, ${league.name} predictions, fixtures, standings`
    });
  } catch (error) {
    console.error('League prediction details route error:', error);
    res.status(500).render('500', { title: 'Server Error' });
  }
});

module.exports = router;
