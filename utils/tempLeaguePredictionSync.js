const League = require('../models/League');
const LeaguePrediction = require('../models/LeaguePrediction');
const { getFixtures, getLeague, getPrediction, isApiFootballConfigured } = require('./apiFootball');
const {
  buildMatchLabel,
  computeResultDisplay,
  computeTipOutcome,
  extractRoundNumber,
  refinePredictionTip,
  isFinishedStatus
} = require('./leaguePredictionHelpers');

function resolveSeasonFromLeagueInfo(leagueInfo) {
  const seasons = leagueInfo?.seasons || [];
  const currentSeason = seasons.find((season) => season.current) || seasons[seasons.length - 1];

  if (!currentSeason?.year) {
    throw new Error(`Could not determine current season for league ${leagueInfo?.league?.id || 'unknown'}`);
  }

  return Number(currentSeason.year);
}

async function syncSeasonPredictionsForLeagueTemporarily(leagueId = 39) {
  if (!isApiFootballConfigured()) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  const existingLeague = await League.findOne({ leagueId }).lean();
  let season = existingLeague?.season;
  let leagueInfo = null;

  if (!season) {
    const leagueInfoResponse = await getLeague({ id: leagueId });
    leagueInfo = leagueInfoResponse[0];
    season = resolveSeasonFromLeagueInfo(leagueInfo);
  }

  const fixturesResponse = await getFixtures({ league: leagueId, season });

  if (!fixturesResponse.length) {
    throw new Error(`No fixtures returned for league ${leagueId} in season ${season}`);
  }

  const fixtureWrites = fixturesResponse.map((fixture) => {
    const isFinished = isFinishedStatus(fixture.fixture.status?.short);
    const homeGoals = fixture.goals?.home ?? null;
    const awayGoals = fixture.goals?.away ?? null;

    return {
      updateOne: {
        filter: { fixtureId: fixture.fixture.id },
        update: {
          $set: {
            fixtureId: fixture.fixture.id,
            leagueId: fixture.league.id,
            season: fixture.league.season,
            leagueName: fixture.league.name,
            country: fixture.league.country,
            round: {
              name: fixture.league.round,
              number: extractRoundNumber(fixture.league.round)
            },
            kickoffAt: new Date(fixture.fixture.date),
            match: buildMatchLabel(fixture.teams.home.name, fixture.teams.away.name),
            venue: {
              name: fixture.fixture.venue?.name || null,
              city: fixture.fixture.venue?.city || null
            },
            homeTeam: {
              teamId: fixture.teams.home.id,
              name: fixture.teams.home.name,
              logo: fixture.teams.home.logo || null,
              winner: fixture.teams.home.winner
            },
            awayTeam: {
              teamId: fixture.teams.away.id,
              name: fixture.teams.away.name,
              logo: fixture.teams.away.logo || null,
              winner: fixture.teams.away.winner
            },
            result: {
              homeGoals,
              awayGoals,
              display: computeResultDisplay(fixture.goals),
              statusShort: fixture.fixture.status?.short || 'NS',
              statusLong: fixture.fixture.status?.long || 'Not Started',
              isFinished
            }
          }
        },
        upsert: true
      }
    };
  });

  await LeaguePrediction.bulkWrite(fixtureWrites);

  const results = [];

  for (const fixture of fixturesResponse) {
    try {
      const baseFixture = {
        fixtureId: fixture.fixture.id,
        match: buildMatchLabel(fixture.teams.home.name, fixture.teams.away.name),
        homeTeam: {
          teamId: fixture.teams.home.id,
          name: fixture.teams.home.name,
          logo: fixture.teams.home.logo || null,
          winner: fixture.teams.home.winner
        },
        awayTeam: {
          teamId: fixture.teams.away.id,
          name: fixture.teams.away.name,
          logo: fixture.teams.away.logo || null,
          winner: fixture.teams.away.winner
        },
        result: {
          homeGoals: fixture.goals?.home ?? null,
          awayGoals: fixture.goals?.away ?? null,
          statusShort: fixture.fixture.status?.short || 'NS',
          isFinished: isFinishedStatus(fixture.fixture.status?.short)
        }
      };

      const predictionResponse = await getPrediction({ fixture: fixture.fixture.id });
      const normalizedTip = refinePredictionTip(predictionResponse[0], baseFixture);
      const tipOutcome = computeTipOutcome(
        normalizedTip.label,
        baseFixture.result.homeGoals,
        baseFixture.result.awayGoals,
        baseFixture.result.isFinished
      );

      await LeaguePrediction.updateOne(
        { fixtureId: fixture.fixture.id },
        {
          $set: {
            tip: {
              ...normalizedTip,
              fetchedAt: new Date()
            },
            'result.tipOutcome': tipOutcome
          }
        }
      );

      results.push({
        fixtureId: fixture.fixture.id,
        match: baseFixture.match,
        tip: normalizedTip.label,
        tipOutcome,
        success: true
      });
    } catch (error) {
      results.push({
        fixtureId: fixture.fixture.id,
        match: buildMatchLabel(fixture.teams.home.name, fixture.teams.away.name),
        success: false,
        error: error.message
      });
    }
  }

  const successful = results.filter((result) => result.success).length;
  const leagueName = existingLeague?.name || leagueInfo?.league?.name || fixturesResponse[0]?.league?.name || `League ${leagueId}`;

  return {
    success: successful === results.length,
    leagueId,
    leagueName,
    season,
    totalFixtures: fixturesResponse.length,
    successful,
    failed: fixturesResponse.length - successful,
    results
  };
}

module.exports = {
  syncSeasonPredictionsForLeagueTemporarily
};
