const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const DISPLAY_TIMEZONE = 'Africa/Nairobi';
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

function extractRoundNumber(roundName = '') {
  const match = String(roundName).match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortRounds(rounds = []) {
  return [...rounds].sort((left, right) => {
    const leftNumber = extractRoundNumber(left);
    const rightNumber = extractRoundNumber(right);

    if (leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return String(left).localeCompare(String(right));
  });
}

function buildLeagueTitle(country, leagueName) {
  return `Utabiri wa Mechi za ${country} ${leagueName}`;
}

function buildMatchLabel(homeName, awayName) {
  return `${homeName} vs ${awayName}`;
}

function computeResultDisplay(goals = {}) {
  if (goals.home === null || goals.home === undefined || goals.away === null || goals.away === undefined) {
    return '-';
  }

  return `${goals.home}-${goals.away}`;
}

function isFinishedStatus(statusShort) {
  return FINISHED_STATUSES.has(statusShort);
}

function simplifyAdvice(advice = '') {
  const normalized = String(advice).trim();

  if (!normalized) {
    return '-';
  }

  if (/^no predictions available$/i.test(normalized)) {
    return '-';
  }

  if (/double chance\s*:\s*.+ or draw/i.test(normalized)) {
    if (/home/i.test(normalized)) {
      return '1X';
    }

    if (/away/i.test(normalized)) {
      return 'X2';
    }
  }

  const overMatch = normalized.match(/\+\d+(?:\.\d+)?/);
  if (overMatch) {
    return `Over ${overMatch[0].replace('+', '')}`;
  }

  const underMatch = normalized.match(/-\d+(?:\.\d+)?/);
  if (underMatch) {
    return `Under ${underMatch[0].replace('-', '')}`;
  }

  if (/both teams to score/i.test(normalized)) {
    return /yes/i.test(normalized) ? 'BTTS: Yes' : 'BTTS: No';
  }

  return normalized;
}

function refinePredictionTip(predictionPayload, fixture) {
  const prediction = predictionPayload?.predictions;
  if (!prediction) {
    return {
      label: '-',
      advice: null,
      winnerTeamId: null,
      winnerName: null,
      winOrDraw: false,
      underOver: null,
      goalsLine: { home: null, away: null },
      confidence: { home: null, draw: null, away: null }
    };
  }

  const winnerTeamId = prediction.winner?.id || null;
  const winnerName = prediction.winner?.name || null;
  const winnerComment = String(prediction.winner?.comment || '').toLowerCase();
  const normalizedAdvice = String(prediction.advice || '').trim();

  let label = '-';

  if (winnerTeamId === fixture.homeTeam.teamId) {
    label = winnerComment.includes('win or draw') ? '1X' : '1';
  } else if (winnerTeamId === fixture.awayTeam.teamId) {
    label = winnerComment.includes('win or draw') ? 'X2' : '2';
  } else if (prediction.under_over) {
    label = `Over ${prediction.under_over.replace('+', '')}`;
  } else if (normalizedAdvice) {
    label = simplifyAdvice(normalizedAdvice);
  }

  return {
    label,
    advice: /^no predictions available$/i.test(normalizedAdvice) ? null : (normalizedAdvice || null),
    winnerTeamId,
    winnerName,
    winOrDraw: Boolean(prediction.win_or_draw),
    underOver: prediction.under_over || null,
    goalsLine: {
      home: prediction.goals?.home || null,
      away: prediction.goals?.away || null
    },
    confidence: {
      home: prediction.percent?.home || null,
      draw: prediction.percent?.draw || null,
      away: prediction.percent?.away || null
    }
  };
}

function computeTipOutcome(tipLabel, homeGoals, awayGoals, isFinished) {
  if (!isFinished || homeGoals === null || awayGoals === null) {
    return 'pending';
  }

  const totalGoals = homeGoals + awayGoals;

  switch (tipLabel) {
    case 'Home Win': case '1':
      return homeGoals > awayGoals ? 'won' : 'lost';
    case 'Away Win': case '2':
      return awayGoals > homeGoals ? 'won' : 'lost';
    case '1X':
      return homeGoals >= awayGoals ? 'won' : 'lost';
    case 'X2':
      return awayGoals >= homeGoals ? 'won' : 'lost';
    case 'BTTS: Yes':
      return homeGoals > 0 && awayGoals > 0 ? 'won' : 'lost';
    case 'BTTS: No':
      return homeGoals === 0 || awayGoals === 0 ? 'won' : 'lost';
    default:
      break;
  }

  const overMatch = String(tipLabel).match(/^Over\s+(\d+(?:\.\d+)?)$/i);
  if (overMatch) {
    return totalGoals > Number(overMatch[1]) ? 'won' : 'lost';
  }

  const underMatch = String(tipLabel).match(/^Under\s+(\d+(?:\.\d+)?)$/i);
  if (underMatch) {
    return totalGoals < Number(underMatch[1]) ? 'won' : 'lost';
  }

  return 'void';
}

function normalizeStandingsRows(standings = []) {
  return standings.map((entry) => ({
    rank: entry.rank,
    teamId: entry.team?.id,
    teamName: entry.team?.name,
    teamLogo: entry.team?.logo || null,
    points: entry.points,
    played: entry.all?.played,
    won: entry.all?.win,
    drawn: entry.all?.draw,
    lost: entry.all?.lose,
    goalsFor: entry.all?.goals?.for,
    goalsAgainst: entry.all?.goals?.against,
    goalDifference: entry.goalsDiff,
    form: entry.form || null,
    description: entry.description || null
  }));
}

function formatKickoffDate(dateValue) {
  return dayjs(dateValue).tz(DISPLAY_TIMEZONE).format('YYYY-MM-DD');
}

function formatKickoffTime(dateValue) {
  return dayjs(dateValue).tz(DISPLAY_TIMEZONE).format('HH:mm');
}

module.exports = {
  buildLeagueTitle,
  buildMatchLabel,
  computeResultDisplay,
  computeTipOutcome,
  extractRoundNumber,
  formatKickoffDate,
  formatKickoffTime,
  isFinishedStatus,
  normalizeStandingsRows,
  refinePredictionTip,
  sortRounds
};
