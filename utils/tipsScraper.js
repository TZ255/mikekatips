const axios = require('axios');
const cheerio = require('cheerio');
const fs = require("fs");
const path = require("path");

/**
 * Scrapes betting tips for a specific date
 * @param {string} date - Date in format YYYY-MM-DD
 * @returns {Promise<Array>} Array of tip objects
 */
async function scrapeTips(date, html = "") {
    try {
        const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY
        const SCRAPFLY_KEY = process.env.SCRAPFLY_KEY
        const BROWSERLESS_KEY = process.env.BROWSERLESS_KEY

        const url = `https://bettingtipsters.org/?date=${date}`;
        const maskedUrl1 = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURI(url)}&premium=true`
        const maskedUrl2 = `https://api.scrapfly.io/scrape?tags=player%2Cproject%3Adefault&asp=true&key=${SCRAPFLY_KEY}&url=${encodeURI(url)}`
        const maskedUrl3 = `https://production-sfo.browserless.io/unblock?token=${BROWSERLESS_KEY}&proxy=residential&timeout=60000`

        let html_content = null

        if (html.length < 1) {
            let response = await axios.get(maskedUrl2);
            html_content = response.data?.result?.content
        } else {
            html_content = html
        }

        const $ = cheerio.load(html_content);
        const tips = [];
        let currentLeague = '';

        // Find the main table that contains the "Correct Score" column
        const scoreTable = $('table').filter((_, table) => {
            const headers = $(table)
                .find('thead th')
                .map((i, th) => $(th).text().toLowerCase().trim())
                .get();
            return headers.includes('correct score');
        }).first();

        if (!scoreTable.length) {
            return [];
        }

        scoreTable.find('tbody tr').each((_, row) => {
            const cells = $(row).find('td');
            if (!cells.length) return;

            const firstCell = $(cells[0]);
            const rawCellsText = cells.map((i, cell) => $(cell).text().trim()).get();
            const colSpan = parseInt(firstCell.attr('colspan') || '1', 10);
            const thirdCellText = (rawCellsText[2] || '').toLowerCase();
            const fourthCellText = (rawCellsText[3] || '').toLowerCase();

            const looksLikeLeagueHeader =
                colSpan > 1 ||
                (thirdCellText.includes('correct score') && fourthCellText.includes('odds'));

            if (looksLikeLeagueHeader) {
                currentLeague = rawCellsText[0] || currentLeague;
                return;
            }

            if (!currentLeague || cells.length < 3) return;

            const datetimeText = firstCell.text().replace(/\s+/g, ' ').trim();
            const timeMatch = datetimeText.match(/(\d{1,2}:\d{2})/);
            if (!timeMatch) return;
            const [hoursPart, minutesPart] = timeMatch[1].split(':');
            const time = `${hoursPart.padStart(2, '0')}:${minutesPart}`;

            let teams = $(cells[1])
                .contents()
                .filter((_, node) => node.type === 'text')
                .map((_, node) => $(node).text().trim())
                .get()
                .filter(Boolean);

            if (teams.length < 2) {
                const htmlTeams = $(cells[1]).html() || '';
                teams = htmlTeams
                    .split(/<br\s*\/?>/i)
                    .map(part => part.replace(/<[^>]+>/g, '').trim())
                    .filter(Boolean);
            }

            if (teams.length < 2) return;

            const score = rawCellsText[2] || '';
            if (!score) return;

            const oddsRaw = rawCellsText[3] || '';
            const oddsValue = oddsRaw ? parseFloat(oddsRaw) || oddsRaw : null;

            tips.push({
                time,
                league: currentLeague,
                homeTeam: teams[0],
                awayTeam: teams[1],
                odds: oddsValue,
                tip: score
            });
        });

        return tips;

    } catch (error) {
        console.error(`Scraping failed: ${error.message}`, error);
        return null
    }
}

module.exports = { scrapeTips };
