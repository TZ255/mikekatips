const { scrapeTips } = require('./tipsScraper');
const Tip = require('../models/Tip');
const { default: axios } = require('axios');


/**
 * Classifies a tip based on the score and returns tip type and premium status
 * @param {string} tipScore - Score like "2:0", "1:1", etc.
 * @param {string} isFree - Boolean for classifications for free or premium.
 * @returns {Object} Object with tip type and isPremium flag
 */
function classifyTip(tipScore, isFree) {
    if (!tipScore || tipScore === '') {
        return null;
    }

    // Classification arrays
    const freeHomeWin = ["2:0", "4:1"];
    const freeAwayWin = ["0:2", "1:4"];
    const free1X = ["1:0", "2:1"];
    const freeX2 = ["0:1", "1:2"];
    const freeBTTS = ["1:3", "2:3"];

    const premiumHomeWin = ["3:0", "4:0", "3:1"];
    const premiumAwayWin = ["0:3", "0:4"];
    const premium1X = ["2:0"];
    const premiumX2 = ["0:2"];
    const premiumUnder35 = ["0:0"];
    const premiumBTTS = ["7:7"];

    // Calculate total goals for Over/Under classifications
    const parts = tipScore.split(':');
    if (parts.length === 2) {
        const homeGoals = parseInt(parts[0]);
        const awayGoals = parseInt(parts[1]);
        const totalGoals = homeGoals + awayGoals;

        // Premium Over 2.5 (5+ goals)
        if (totalGoals >= 5 && isFree === false) {
            return { tip: 'Over 2.5', isPremium: true };
        }

        // Free Over 2.5
        if (totalGoals === 4 && isFree === true) {
            return { tip: 'Over 2.5', isPremium: false };
        }
    }

    //Premium classifications
    if (premiumHomeWin.includes(tipScore) && isFree === false) {
        return { tip: 'Home Win', isPremium: true };
    }

    if (premiumAwayWin.includes(tipScore) && isFree === false) {
        return { tip: 'Away Win', isPremium: true };
    }

    if (premiumBTTS.includes(tipScore) && isFree === false) {
        return { tip: 'BTTS: Yes', isPremium: true };
    }

    if (premium1X.includes(tipScore) && isFree === false) {
        return { tip: '1X', isPremium: true };
    }

    if (premiumX2.includes(tipScore) && isFree === false) {
        return { tip: 'X2', isPremium: true };
    }

    if (premiumUnder35.includes(tipScore) && isFree === false) {
        return { tip: 'Under 3.5', isPremium: true };
    }

    //Free classifications
    if (freeHomeWin.includes(tipScore) && isFree === true) {
        return { tip: 'Home Win', isPremium: false };
    }

    if (freeAwayWin.includes(tipScore) && isFree === true) {
        return { tip: 'Away Win', isPremium: false };
    }

    if (freeBTTS.includes(tipScore) && isFree === true) {
        return { tip: 'BTTS: Yes', isPremium: false };
    }

    if (free1X.includes(tipScore) && isFree === true) {
        return { tip: '1X', isPremium: false };
    }

    if (freeX2.includes(tipScore) && isFree === true) {
        return { tip: 'X2', isPremium: false };
    }

    // If no classification matches, return null
    return null;
}

/**
 * Processes scraped tips and saves them to database
 * @param {string} date - Date in format YYYY-MM-DD
 * @returns {Promise<Object>} Result object with statistics
 */
async function processTipsForDate(date, html = "") {
    try {
        console.log(`Starting to process tips for date: ${date}`);

        // Scrape tips from website
        const scrapedTips = await scrapeTips(date, html);

        if (!scrapedTips || scrapedTips.length === 0) {
            console.log(`No tips found for date: ${date}`);
            return {
                success: false,
                message: 'No tips found to process',
                processed: 0,
                saved: 0
            };
        }

        console.log(`Scraped ${scrapedTips.length} tips`);

        // Process and structure tips according to our schema
        const processedTips = [];


        for (const scrapedTip of scrapedTips) {
            if (!scrapedTip.time || !scrapedTip.time.includes(':')) {
                continue;
            }

            const [hours, minutes] = scrapedTip.time.split(':').map(Number);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                continue;
            }

            // Adjust time by adding 1 hour for onemillion
            const adjustedHours = (hours + 1) % 24;
            const adjustedTime = `${adjustedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            // Filter: only process tips with time >= 12:00
            if (adjustedHours < 12) {
                continue;
            }

            const freeClassification = classifyTip(scrapedTip.tip, true);
            const premiumClassification = classifyTip(scrapedTip.tip, false);

            const classification = [freeClassification, premiumClassification];

            if (freeClassification === null && premiumClassification === null) {
                console.warn(`Could not classify tip: ${scrapedTip.tip} for match: ${scrapedTip.homeTeam} vs ${scrapedTip.awayTeam}`);
                continue;
            }


            for (const cls of classification) {
                if (cls === null) {
                    continue;
                }

                const tipObject = {
                    match: `${scrapedTip.homeTeam} vs ${scrapedTip.awayTeam}`,
                    league: scrapedTip.league,
                    tip: cls.tip,
                    odds: null, // store as null for onemillion
                    isPremium: cls.isPremium,
                    date: date,
                    time: adjustedTime,
                    status: 'pending'
                };

                processedTips.push(tipObject);
            }
        }

        console.log(`Processed ${processedTips.length} valid tips`);

        if (processedTips.length === 0) {
            return {
                success: false,
                message: 'No valid tips to save after processing',
                processed: scrapedTips.length,
                saved: 0
            };
        }

        // Check existing tips count in database for this date
        const existingTipsCount = await Tip.countDocuments({ date: date });
        console.log(`Found ${existingTipsCount} existing tips in database for ${date}`);

        // If scraped tips count is greater than existing, clear and save new ones
        if (processedTips.length !== existingTipsCount) {
            console.log(`Clearing existing tips and saving ${processedTips.length} new tips`);

            // Clear existing tips for the date
            await Tip.deleteMany({ date: date });
            console.log(`Cleared ${existingTipsCount} existing tips`);

            // Save new tips
            const savedTips = await Tip.insertMany(processedTips);
            console.log(`Successfully saved ${savedTips.length} tips`);

            return {
                success: true,
                message: `Successfully processed and saved tips for ${date}`,
                processed: scrapedTips.length,
                saved: savedTips.length,
                cleared: existingTipsCount,
                freeTips: savedTips.filter(tip => !tip.isPremium).length,
                premiumTips: savedTips.filter(tip => tip.isPremium).length
            };
        } else {
            console.log(`Existing tips count (${existingTipsCount}) >= scraped tips count (${processedTips.length}). No update needed.`);
            return {
                success: false,
                message: `No update needed. Existing tips: ${existingTipsCount}, Scraped tips: ${processedTips.length}`,
                processed: scrapedTips.length,
                saved: 0,
                skipped: true
            };
        }

    } catch (error) {
        console.error(`Error processing tips for ${date}:`, error);
        return {
            success: false,
            message: `Error processing tips: ${error.message}`,
            error: error.message,
            processed: 0,
            saved: 0
        };
    }
}

/**
 * Get classification statistics for testing
 * @param {Array} tips - Array of tip scores to classify
 * @returns {Object} Classification statistics
 */
function getClassificationStats(tips) {
    const stats = {
        total: tips.length,
        free: { count: 0, types: {} },
        premium: { count: 0, types: {} },
        unclassified: 0
    };

    tips.forEach(tip => {
        const classification = classifyTip(tip);

        if (!classification) {
            stats.unclassified++;
            return;
        }

        if (classification.isPremium) {
            stats.premium.count++;
            stats.premium.types[classification.tip] = (stats.premium.types[classification.tip] || 0) + 1;
        } else {
            stats.free.count++;
            stats.free.types[classification.tip] = (stats.free.types[classification.tip] || 0) + 1;
        }
    });

    return stats;
}

module.exports = {
    processTipsForDate,
    classifyTip,
    getClassificationStats
};
