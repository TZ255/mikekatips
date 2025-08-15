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

        $('table tbody tr').each((index, row) => {
            const $row = $(row);

            // Check if this is a league header row
            const leagueCell = $row.find('td[colspan="2"] h4');
            if (leagueCell.length > 0) {
                currentLeague = leagueCell.text().trim();
                return;
            }

            // Skip header rows and empty rows
            if ($row.find('th').length > 0 || $row.find('td').length < 5) {
                return;
            }

            const cells = $row.find('td');
            const time = $(cells[0]).text().trim();
            const match = $(cells[1]).text().trim();
            const homeOdd = $(cells[2]).text().trim();
            const drawOdd = $(cells[3]).text().trim();
            const awayOdd = $(cells[4]).text().trim();
            const tip = $(cells[5]).find('strong').text().trim() || $(cells[5]).text().trim();

            // Skip if essential data is missing
            if (!time || !match || !currentLeague) {
                return;
            }

            const teams = match.split(' - ');
            if (teams.length === 2) {
                tips.push({
                    time: time,
                    league: currentLeague,
                    homeTeam: teams[0].trim(),
                    awayTeam: teams[1].trim(),
                    odds: {
                        home: parseFloat(homeOdd) || null,
                        draw: parseFloat(drawOdd) || null,
                        away: parseFloat(awayOdd) || null
                    },
                    tip: tip
                });
            }
        });

        return tips;

    } catch (error) {
        console.error(`Scraping failed: ${error.message}`, error);
        return null
    }
}

module.exports = { scrapeTips };