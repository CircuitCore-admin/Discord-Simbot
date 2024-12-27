// helpers/jsonParser.js

function normalizeSessionData(fileContent) {
    const defaultStructure = {
        laps: [],
        penalties: [],
        post_race_penalties: [],
        sessionType: fileContent.sessionType || null,
        trackName: fileContent.trackName || 'Unknown Track',
        serverName: fileContent.serverName || 'Unknown Server',
        sessionResult: fileContent.sessionResult || {},
        Date: fileContent.Date || new Date().toISOString(),
    };

    // Ensure sessionResult.leaderBoardLines exists
    if (!defaultStructure.sessionResult.leaderBoardLines) {
        defaultStructure.sessionResult.leaderBoardLines = [];
    }

    // Normalize laps
    defaultStructure.laps = fileContent.laps || [];

    return defaultStructure;
}

module.exports = {
    normalizeSessionData
};
