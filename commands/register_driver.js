const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const db = require('../services/database');

// Steam API Key (ensure it's in your .env file)
const STEAM_API_KEY = process.env.STEAM_API_KEY;

// 🚦 **Function to Get SteamID Securely**
async function getSteamID(steamInput) {
    try {
        let steamID = null;

        if (steamInput.includes('/id/')) {
            // Handle vanity URL
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
            // Handle direct profile URL
            steamID = steamInput.split('/profiles/')[1].split('/')[0];
            console.log(`✅ Direct SteamID Found: ${steamID}`);
        } else {
            // Handle vanity username directly
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register_driver')
        .setDescription('Register or update a driver with Discord ID and Steam ID')
        .addStringOption(option =>
            option.setName('steam_input')
                .setDescription('Steam Profile Link or Vanity Username')
                .setRequired(true)
        ),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const discordUsername = interaction.user.username;
        const steamInput = interaction.options.getString('steam_input').trim();

        console.log(`🚀 Received Steam Input: ${steamInput}`);

        try {
            // 🚦 Validate steamInput
            if (!steamInput || steamInput.length > 200) {
                throw new Error('Invalid Steam input provided.');
            }

            // 🔍 Fetch SteamID
            const steamID = await getSteamID(steamInput);

            if (!steamID) {
                throw new Error('Failed to resolve SteamID. Please ensure the input is correct.');
            }

            // 📊 Insert or Update Driver Information
            await db.query(
                `INSERT INTO driver_info (discord_id, username, steam_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (steam_id) DO UPDATE
                 SET discord_id = EXCLUDED.discord_id,
                     username = EXCLUDED.username`,
                [discordId, discordUsername, steamID]
            );

            console.log(`✅ Driver successfully registered or updated: ${discordUsername} (${steamID})`);
            await interaction.reply(`✅ Driver **${discordUsername}** registered/updated successfully with SteamID: **${steamID}**.`);
        } catch (error) {
            console.error('❌ Database or API Error:', error.message || error);
            await interaction.reply(`❌ Error: ${error.message || 'Failed to register driver. Please try again later.'}`);
        }
    },
};
