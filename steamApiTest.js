// steamApiTest.js
const axios = require('axios');

// Replace this with your Steam API Key
const STEAM_API_KEY = 'API CODE HERE';

// Example Steam Community profile link
const steamProfileLink = 'https://steamcommunity.com/id/ScientistMonkey/';

// Function to get SteamID from profile URL
async function getSteamID(steamLink) {
    try {
        let steamID = null;

        // Check if the link contains a custom URL
        if (steamLink.includes('/id/')) {
            const customURL = steamLink.split('/id/')[1].split('/')[0];

            // Fetch SteamID from the custom URL
            const response = await axios.get('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/', {
                params: {
                    key: STEAM_API_KEY,
                    vanityurl: customURL,
                },
            });

            if (response.data.response.success === 1) {
                steamID = response.data.response.steamid;
                console.log(`✅ SteamID Found: ${steamID}`);
            } else {
                console.error('❌ Failed to resolve SteamID from vanity URL');
            }
        } else if (steamLink.includes('/profiles/')) {
            // Extract SteamID directly
            steamID = steamLink.split('/profiles/')[1].split('/')[0];
            console.log(`✅ Direct SteamID Found: ${steamID}`);
        } else {
            console.error('❌ Invalid Steam profile URL format');
        }

        return steamID;
    } catch (error) {
        console.error('❌ API Error:', error.response?.data || error.message);
    }
}

// Run the test
(async () => {
    const steamID = await getSteamID(steamProfileLink);
    if (steamID) {
        console.log('🎯 Test Passed! SteamID:', steamID);
    } else {
        console.log('❌ Test Failed!');
    }
})();
