const LinkToRedirect = async (comp) => {
    let links = {
        gsb: `https://track.africabetpartners.com/visit/?bta=35468&nci=6131`,
        pmatch: `https://grwptraq.com/?serial=61288670&creative_id=1788&anid=web&pid=web`,
        meridian: `https://a.meridianbet.co.tz/c/kGdxSu`,
        betway: `https://www.betway.co.tz/?register=1&btag=P94949-PR24698-CM77104-TS1988404&`,
        premier: `https://media.premierbetpartners.com/redirect.aspx?pid=41881&bid=4921`,
        betika: `https://record.betikapartners.com/_xq39yU84NJbUOsjNOfgKeWNd7ZgqdRLk/1/`,
        gsb_ug: `https://track.africabetpartners.com/visit/?bta=35468&nci=6016`,
        bet22: `https://welcome.toptrendyinc.com/redirect.aspx?pid=77675&bid=1634`,
        ke_1xbet: `https://refpa4293501.top/L?tag=d_2869291m_2528c_&site=2869291&ad=2528`,
        tz_888: `https://tracking.888africa.com/visit/?bta=356&nci=5354`,
        betwinner: `https://bw-prm.com/bonus-100-01/?p=%2Fregistration%2F&lang=en&id=29lf`,
        betway_casino: `https://www.betway.co.tz/lobby/casino/all/?register=1&btag=P94949-PR37903-CM111051-TS2045159`,
        betway_arsenal: `https://www.betway.co.tz/Arsenal-Xclusives?btag=P94949-PR37833-CM109867-TS2034255`,
        betway_2000: `https://www.betway.co.tz/offers/deposit-wager?btag=P94949-PR38080-CM112923-TS2068965&signupcode=MKEKA&optin=TZPromo`,
        winner_ethiopia: `https://track.africabetpartners.com/visit/?bta=35468&nci=6055`,
        betlion_ke: `https://tracking.888africa.com/visit/?bta=356&nci=5362`,
        leonbet: `https://k56thc2itt.com/?serial=44835&creative_id=1061&anid=`,
        jpcity: 'https://en.jackpotcitycasino.co.tz/?register=1&btag=P110231-PR38119-CM113317-TS2071433'
    }
    try {
        switch (comp) {
            case 'gsb':
                return links.gsb
            case 'pmatch':
                return links.pmatch
            case 'betway':
                return links.betway
            case 'betway-casino':
                return links.betway_casino
            case 'betway-arsenal':
                return links.betway_arsenal
            case 'betway-freebet':
                return links.betway_2000
            case 'meridian':
                return links.meridian
            case 'premier':
                return links.betway

            case '888bet':
                return links.tz_888
            case 'betwinner':
                return links.betwinner
            case 'leonbet':
                return links.leonbet

            case 'jpcity':
                return links.jpcity

            //bots redirects
            case 'betika-ke': case '22bet-ke': case '1xbet': case '22bet': case 'betlion-ke':
                return links.betwinner
            case 'gsb-tz':
                return links.gsb
            case 'gsb-ug':
                return links.gsb_ug
            case 'betway-tz':
                return links.betway
            case 'premierbet':
                return links.betway
            case '22bet-ug':
                return links.bet22
            case '22bet-tz':
                return links.betway
            case 'winner-et':
                return links.winner_ethiopia
            default:
                return links.betwinner
        }
    } catch (err) {
        console.log(err.message)
    }
}

module.exports = {
    LinkToRedirect
}