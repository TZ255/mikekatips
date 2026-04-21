const League = require('../models/League');
const LeaguePrediction = require('../models/LeaguePrediction');
const leagueCatalog = require('./leagueCatalog');
const {
  getFixtures,
  getLeague,
  getLeagueRounds,
  getPrediction,
  getStandings,
  isApiFootballConfigured
} = require('./apiFootball');
const {
  buildLeagueTitle,
  buildMatchLabel,
  computeResultDisplay,
  computeTipOutcome,
  extractRoundNumber,
  isFinishedStatus,
  normalizeStandingsRows,
  refinePredictionTip,
  sortRounds
} = require('./leaguePredictionHelpers');

function configuredLeagues() {
  return leagueCatalog;
}

function resolveSeasonFromLeagueInfo(leagueInfo) {
  const seasons = leagueInfo?.seasons || [];
  const currentSeason = seasons.find((season) => season.current) || seasons[seasons.length - 1];

  if (!currentSeason?.year) {
    throw new Error(`Could not determine current season for league ${leagueInfo?.league?.id || 'unknown'}`);
  }

  const startYear = Number(
    currentSeason.start ? new Date(currentSeason.start).getUTCFullYear() : currentSeason.year
  );
  const endYear = Number(
    currentSeason.end ? new Date(currentSeason.end).getUTCFullYear() : currentSeason.year + 1
  );

  return {
    season: Number(currentSeason.year),
    seasonLabel: `${startYear}/${endYear}`
  };
}

function buildFixtureUpdate(fixture) {
  const isFinished = isFinishedStatus(fixture.fixture.status?.short);
  const homeGoals = fixture.goals?.home ?? null;
  const awayGoals = fixture.goals?.away ?? null;

  return {
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
  };
}

function pickNextRound(sortedRounds, currentRoundName) {
  const currentIndex = sortedRounds.findIndex((roundName) => roundName === currentRoundName);
  if (currentIndex === -1 || currentIndex === sortedRounds.length - 1) {
    return null;
  }

  return sortedRounds[currentIndex + 1];
}

function pickLatestCompletedRound(fixtures, currentRoundNumber) {
  const completedRounds = fixtures
    .map((fixture) => extractRoundNumber(fixture.league.round))
    .filter((roundNumber) => Number.isFinite(roundNumber) && roundNumber < currentRoundNumber);

  if (!completedRounds.length) {
    return null;
  }

  return Math.max(...completedRounds);
}

async function ensureLeaguePlaceholder(config) {
  await League.updateOne(
    { leagueId: config.leagueId },
    {
      $setOnInsert: {
        season: config.season,
        seasonLabel: config.seasonLabel || `${config.season}/${Number(config.season) + 1}`,
        name: `League ${config.leagueId}`,
        country: 'Unknown',
        title: `Utabiri wa League ${config.leagueId}`
      },
      $set: {
        isActive: true,
        displayOrder: config.displayOrder || 0
      }
    },
    { upsert: true }
  );
}

async function syncLeague(config) {
  const attemptAt = new Date();
  let leagueName = `League ${config.leagueId}`;

  try {
    const leagueInfoResponse = await getLeague({ id: config.leagueId });
    const leagueInfo = leagueInfoResponse[0];
    const { season, seasonLabel } = resolveSeasonFromLeagueInfo(leagueInfo);

    await ensureLeaguePlaceholder({
      ...config,
      season,
      seasonLabel
    });

    const [currentRoundResponse, roundsResponse, standingsResponse, fixturesResponse] = await Promise.all([
      getLeagueRounds({ league: config.leagueId, season, current: true }),
      getLeagueRounds({ league: config.leagueId, season }),
      getStandings({ league: config.leagueId, season }),
      getFixtures({ league: config.leagueId, season })
    ]);

    leagueName = leagueInfo?.league?.name || leagueName;
    const standingsGroup = standingsResponse[0]?.league?.standings?.[0] || [];
    const sortedRounds = sortRounds(roundsResponse);
    const currentRoundName = currentRoundResponse[0] || null;
    const currentRoundNumber = extractRoundNumber(currentRoundName);
    const nextRoundName = pickNextRound(sortedRounds, currentRoundName);
    const latestCompletedRoundNumber = pickLatestCompletedRound(fixturesResponse, currentRoundNumber);
    const latestCompletedRoundName = sortedRounds.find(
      (roundName) => extractRoundNumber(roundName) === latestCompletedRoundNumber
    ) || null;

    if (fixturesResponse.length) {
      const fixtureWrites = fixturesResponse.map((fixture) => ({
        updateOne: {
          filter: { fixtureId: fixture.fixture.id },
          update: {
            $set: buildFixtureUpdate(fixture)
          },
          upsert: true
        }
      }));

      await LeaguePrediction.bulkWrite(fixtureWrites);
    }

    const targetedFixtures = fixturesResponse.filter((fixture) => {
      const roundName = fixture.league.round;
      return roundName === currentRoundName || roundName === nextRoundName;
    });

    for (const fixture of targetedFixtures) {
      try {
        const predictionResponse = await getPrediction({ fixture: fixture.fixture.id });
        const normalizedTip = refinePredictionTip(predictionResponse[0], buildFixtureUpdate(fixture));
        const isFinished = isFinishedStatus(fixture.fixture.status?.short);

        await LeaguePrediction.updateOne(
          { fixtureId: fixture.fixture.id },
          {
            $set: {
              tip: {
                ...normalizedTip,
                fetchedAt: new Date()
              },
              'result.tipOutcome': computeTipOutcome(
                normalizedTip.label,
                fixture.goals?.home ?? null,
                fixture.goals?.away ?? null,
                isFinished
              )
            }
          }
        );
      } catch (predictionError) {
        console.error(`Prediction sync failed for fixture ${fixture.fixture.id}:`, predictionError.message);
      }
    }

    const existingTips = await LeaguePrediction.find(
      { leagueId: config.leagueId, season },
      { fixtureId: 1, 'tip.label': 1 }
    ).lean();

    const tipMap = new Map(existingTips.map((item) => [item.fixtureId, item.tip?.label || '-']));
    const outcomeWrites = fixturesResponse
      .filter((fixture) => isFinishedStatus(fixture.fixture.status?.short))
      .map((fixture) => ({
        updateOne: {
          filter: { fixtureId: fixture.fixture.id },
          update: {
            $set: {
              'result.tipOutcome': computeTipOutcome(
                tipMap.get(fixture.fixture.id) || '-',
                fixture.goals?.home ?? null,
                fixture.goals?.away ?? null,
                true
              )
            }
          }
        }
      }));

    if (outcomeWrites.length) {
      await LeaguePrediction.bulkWrite(outcomeWrites);
    }

    await League.updateOne(
      { leagueId: config.leagueId },
      {
        $set: {
          season,
          seasonLabel,
          name: leagueInfo?.league?.name || `League ${config.leagueId}`,
          country: leagueInfo?.country?.name || 'Unknown',
          countryCode: leagueInfo?.country?.code || null,
          countryFlag: leagueInfo?.country?.flag || null,
          logo: leagueInfo?.league?.logo || null,
          type: leagueInfo?.league?.type || 'League',
          title: buildLeagueTitle(
            leagueInfo?.country?.name || 'Unknown',
            leagueInfo?.league?.name || `League ${config.leagueId}`
          ),
          isActive: true,
          displayOrder: config.displayOrder || 0,
          rounds: {
            current: {
              name: currentRoundName,
              number: Number.isFinite(currentRoundNumber) ? currentRoundNumber : null,
              updatedAt: new Date()
            },
            next: {
              name: nextRoundName,
              number: nextRoundName ? extractRoundNumber(nextRoundName) : null,
              updatedAt: new Date()
            },
            latestCompleted: {
              name: latestCompletedRoundName,
              number: latestCompletedRoundNumber || null,
              updatedAt: new Date()
            }
          },
          standings: {
            updatedAt: new Date(),
            rows: normalizeStandingsRows(standingsGroup)
          },
          sync: {
            lastAttemptAt: attemptAt,
            lastSuccessfulSyncAt: new Date(),
            lastError: null
          }
        }
      }
    );

    return {
      success: true,
      leagueId: config.leagueId,
      leagueName,
      fixtures: fixturesResponse.length,
      targetedFixtures: targetedFixtures.length
    };
  } catch (error) {
    await League.updateOne(
      { leagueId: config.leagueId },
      {
        $set: {
          season: config.season || new Date().getUTCFullYear(),
          'sync.lastAttemptAt': attemptAt,
          'sync.lastError': error.message
        }
      }
    );

    return {
      success: false,
      leagueId: config.leagueId,
      leagueName,
      error: error.message
    };
  }
}

async function syncConfiguredLeagues() {
  if (!isApiFootballConfigured()) {
    return {
      success: false,
      message: 'API_FOOTBALL_KEY is not configured',
      results: []
    };
  }

  const results = [];
  for (const leagueConfig of configuredLeagues()) {
    // Sequential sync keeps the request rate predictable.
    const result = await syncLeague(leagueConfig);
    results.push(result);
  }

  return {
    success: results.every((result) => result.success),
    results
  };
}

module.exports = {
  configuredLeagues,
  syncConfiguredLeagues,
  syncLeague
};
