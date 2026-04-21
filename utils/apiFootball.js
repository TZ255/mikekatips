const axios = require('axios');

const API_BASE_URL = 'https://v3.football.api-sports.io';

function isApiFootballConfigured() {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

function createClient() {
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error('API_FOOTBALL_KEY is not configured');
  }

  return axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000,
    headers: {
      'x-apisports-key': process.env.API_FOOTBALL_KEY
    }
  });
}

function normalizeErrors(errors) {
  if (!errors) {
    return '';
  }

  if (Array.isArray(errors)) {
    return errors.join(', ');
  }

  if (typeof errors === 'object') {
    return Object.values(errors).join(', ');
  }

  return String(errors);
}

async function apiGet(path, params = {}) {
  const client = createClient();
  const { data } = await client.get(path, { params });

  const errorMessage = normalizeErrors(data?.errors);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return data?.response || [];
}

function getLeague(params) {
  return apiGet('/leagues', params);
}

function getLeagueRounds(params) {
  return apiGet('/fixtures/rounds', params);
}

function getFixtures(params) {
  return apiGet('/fixtures', params);
}

function getStandings(params) {
  return apiGet('/standings', params);
}

function getPrediction(params) {
  return apiGet('/predictions', params);
}

module.exports = {
  getFixtures,
  getLeague,
  getLeagueRounds,
  getPrediction,
  getStandings,
  isApiFootballConfigured
};
