const axios = require('axios');
const readline = require('readline');
const db = require('../services/database');
require('dotenv').config();

const STEAM_API_KEY = process.env.STEAM_API_KEY;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function getSteamID(steamInput) {
    try {
        let steamID = null;

        if (steamInput.includes('/id/')) {
            const customURL = steamInput.split('/id/')[1].split('/')[0];
            const response = await axios.get('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/', {
                params: { key: STEAM_API_KEY, vanityurl: customURL }
            });

            if (response.data.response.success === 1) {
                steamID = response.data.response.steamid;
                console.log(`✅ SteamID Found via Vanity URL: ${steamID}`);
            } else {
                console.error('❌ Failed to resolve SteamID from vanity URL');
            }
        } else if (steamInput.includes('/profiles/')) {
            steamID = steamInput.split('/profiles/')[1].split('/')[0];
            console.log(`✅ Direct SteamID Found: ${steamID}`);
        } else {
            console.log(`🔍 Attempting to resolve SteamID from username: ${steamInput}`);
            const response = await axios.get('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/', {
                params: { key: STEAM_API_KEY, vanityurl: steamInput }
            });

            if (response.data.response.success === 1) {
                steamID = response.data.response.steamid;
                console.log(`✅ SteamID Found via Vanity Username: ${steamID}`);
            } else {
                console.error('❌ Failed to resolve SteamID from vanity username');
            }
        }
        return steamID;
    } catch (error) {
        console.error('❌ API Error:', error.response?.data || error.message);
        throw new Error('Failed to fetch SteamID. Please try again later.');
    }
}

rl.question('Enter your Discord Username: ', (discordUsername) => {
    rl.question('Enter your Steam Profile Link or Vanity Username: ', async (steamInput) => {
        try {
            if (!steamInput || steamInput.length > 200) {
                throw new Error('Invalid Steam input provided.');
            }

            const steamID = await getSteamID(steamInput.trim());

            if (!steamID) {
                throw new Error('Failed to resolve SteamID. Please ensure the input is correct.');
            }

            await db.query(
                `INSERT INTO driver_info (username, steam_id)
                 VALUES ($1, $2)
                 ON CONFLICT (steam_id) DO UPDATE
                 SET username = EXCLUDED.username`,
                [discordUsername, steamID]
            );

            console.log(`✅ Driver successfully registered or updated: ${discordUsername} (${steamID})`);
        } catch (error) {
            console.error('❌ Database or API Error:', error.message || error);
        } finally {
            rl.close();
        }
    });
});
