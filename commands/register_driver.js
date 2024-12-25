const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const db = require('../services/database');

// Steam API Key (ensure it's in your .env file)
const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Function to get SteamID from a vanity URL or profile link
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
                .setRequired(true)),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const discordUsername = interaction.user.username;
        const steamInput = interaction.options.getString('steam_input');

        console.log(`🚀 Received Steam Input: ${steamInput}`);

        try {
            // Fetch SteamID
            const steamID = await getSteamID(steamInput);

            if (!steamID) {
                throw new Error('Failed to resolve SteamID.');
            }

            // Check if the driver already exists
            const result = await db.query(
                `SELECT * FROM driver_info WHERE discord_id = $1`,
                [discordId]
            );

            if (result.rows.length > 0) {
                // Update existing driver
                await db.query(
                    `UPDATE driver_info 
                     SET username = $1, steam_id = $2 
                     WHERE discord_id = $3`,
                    [discordUsername, steamID, discordId]
                );
                console.log(`🔄 Updated Driver: ${discordId}`);
                await interaction.reply(`🔄 Driver info updated successfully for **${discordUsername}** with SteamID: **${steamID}**.`);
            } else {
                // Insert new driver
                await db.query(
                    `INSERT INTO driver_info (discord_id, username, steam_id) 
                     VALUES ($1, $2, $3)`,
                    [discordId, discordUsername, steamID]
                );
                console.log(`🆕 Added Driver: ${discordId}`);
                await interaction.reply(`🆕 Driver **${discordUsername}** registered successfully with SteamID: **${steamID}**.`);
            }
        } catch (error) {
            console.error('❌ Database or API error:', error.message);
            await interaction.reply(`❌ Database or API error: ${error.message}`);
        }
    },
};
