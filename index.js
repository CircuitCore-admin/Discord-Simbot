const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file
const axios = require('axios'); // For making HTTP requests to Discord API

const express = require('express');
const cors = require('cors');

const analyzeImage = require('./services/analyzeImage');
const db = require('./services/database');

// --- Discord Bot Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});

// Load commands dynamically
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

// Load event handlers dynamically
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Bot is Ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setPresence({
        status: 'online',
        activities: [
            {
                name: 'over simracers',
                type: ActivityType.Watching,
            }
        ],
    });
});

// Message Create Listener for Automatic Image Processing
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    let configuredChannelId = null;
    try {
        const res = await db.query('SELECT hotlap_channel_id FROM guild_settings WHERE guild_id = $1;', [message.guildId]);
        if (res.rows.length > 0) {
            configuredChannelId = res.rows[0].hotlap_channel_id;
        }
    } catch (error) {
        console.error(`❌ Database error fetching guild settings for ${message.guildId}:`, error);
        return;
    }

    if (!configuredChannelId || message.channel.id !== configuredChannelId.toString()) {
        return;
    }

    if (message.attachments.size > 0) {
        let imageAttachment = null;
        for (const [key, attachment] of message.attachments) {
            if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                imageAttachment = attachment;
                break;
            }
        }

        if (imageAttachment) {
            try {
                await message.channel.sendTyping();
                const analysisResult = await analyzeImage(imageAttachment.url);

                if (analysisResult.status === 'incomplete') {
                    await message.reply(`⚠️ ${analysisResult.message}. Please upload a full screenshot showing ALL required sections and columns (Track Location, Driver, Team, Time, S1, S2, S3, PEN., Custom Setup, Assists).`);
                } else if (analysisResult.status === 'complete') {
                    // Reject invalid laps and stop processing
                    if (!analysisResult.is_valid) {
                        const trackLocationName = analysisResult.track_location_name || 'Unknown Track';
                        const lapTime = analysisResult.lap_time || 'N/A';
                        await message.reply(`❌ Lap Rejected: The fastest lap (${lapTime}) on ${trackLocationName} is invalid due to a penalty. Only valid laps can be processed and recorded.`);
                        return; // Stop processing further for this message
                    }

                    // If the lap is valid, proceed with database insertion and detailed reply
                    const guildId = message.guildId;
                    const channelId = message.channelId;
                    const messageId = message.id;
                    const userId = message.author.id;
                    const discordTag = message.author.tag; // For username#discriminator

                    const driverName = analysisResult.driver_name; // Keep AI-extracted driver name for DB
                    const teamName = analysisResult.team_name;
                    const lapTime = analysisResult.lap_time;
                    const s1Time = analysisResult.s1_time;
                    const s2Time = analysisResult.s2_time;
                    const s3Time = analysisResult.s3_time;
                    const isValid = analysisResult.is_valid;
                    const customSetupBoolean = analysisResult.custom_setup === 'Yes' ? true : false;
                    const trackLocationName = analysisResult.track_location_name;
                    const submissionDate = new Date();

                    let replyContent = `📊 Hotlap Analysis for your image:\n`;
                    replyContent += `Top Lap Time: ${lapTime}\n`;
                    replyContent += `Valid: ${isValid ? '✅' : '❌'}\n`;
                    replyContent += `Driver: ${discordTag}\n`;
                    replyContent += `Team: ${teamName}\n`;
                    replyContent += `Track: ${trackLocationName}\n`;
                    replyContent += `Sectors: S1: ${s1Time}, S2: ${s2Time}, S3: ${s3Time}\n`;
                    replyContent += `Custom Setup: ${customSetupBoolean ? '✅ Yes' : '❌ No'}\n`;
                    replyContent += `Notes: ${isValid ? 'None' : 'Penalty detected on fastest lap'}`;

                    // Insert into the database (driver_name is still included as extracted by AI)
                    await db.query(
                        `INSERT INTO hotlaps (guild_id, channel_id, message_id, user_id, discord_tag, driver_name, team_name, lap_time, s1_time, s2_time, s3_time, is_valid, custom_setup, track_location_name, submission_date)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
                        [
                            guildId, channelId, messageId, userId, discordTag,
                            driverName, teamName, lapTime,
                            s1Time, s2Time, s3Time, isValid,
                            customSetupBoolean,
                            trackLocationName, submissionDate
                        ]
                    );

                    await message.reply({
                        content: `\`\`\`\n${replyContent}\n\`\`\`\nYour hotlap has been recorded!`
                    });
                } else {
                    console.error('❌ Unexpected analysis status from Gemini:', analysisResult.status);
                    await message.reply('⚠️ Something went wrong during analysis. Unexpected AI response.');
                }

            } catch (error) {
                console.error('❌ Error processing image from message:', error);
                await message.reply(`⚠️ Sorry, I couldn't analyze that image. ${error.message || 'An unknown error occurred.'}`);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);


// --- Web Server Setup ---
const app = express();
const webPort = process.env.WEB_PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper function to convert lap time string (e.g., "1:23.456") to milliseconds
function lapTimeToMs(lapTimeString) {
    if (!lapTimeString || lapTimeString === 'N/A') return null;
    const parts = lapTimeString.split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0]);
        const secondsParts = parts[1].split('.');
        const seconds = parseInt(secondsParts[0]);
        const milliseconds = parseInt(secondsParts[1] || '0');
        return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    } else if (parts.length === 3) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const secondsParts = parts[2].split('.');
        const seconds = parseInt(secondsParts[0]);
        const milliseconds = parseInt(secondsParts[1] || '0');
        return (hours * 3600 * 1000) + (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
    }
    return null;
}


// IMPORTANT: All /api routes MUST come before the app.use(express.static(...)) and app.get('*')

// --- Discord OAuth Routes ---
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${webPort}/`;

// Add console logs to verify environment variables are loaded
console.log('DISCORD_CLIENT_ID:', DISCORD_CLIENT_ID);
console.log('DISCORD_REDIRECT_URI:', DISCORD_REDIRECT_URI);


// Route to initiate Discord OAuth2 login
app.get('/auth/discord', (req, res) => {
    // Define the scopes you need.
    // 'identify' for user info, 'guilds' for user's guilds.
    // 'guilds' scope requires your bot to be in the guild to see it.
    const scopes = ['identify', 'guilds'].join(' ');
    // Ensure DISCORD_CLIENT_ID is not undefined here
    if (!DISCORD_CLIENT_ID) {
        // More descriptive error for debugging
        console.error("Error: DISCORD_CLIENT_ID is undefined. Check your .env file and ensure it's loaded correctly.");
        return res.status(500).send('Discord Client ID is not configured on the server. Please check server logs for details.');
    }
    const authorizeUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
    // NEW: Log the exact URL being sent to Discord for debugging
    console.log('Attempting Discord OAuth redirect with URI:', authorizeUrl);
    res.redirect(authorizeUrl);
});

// Route to handle Discord OAuth2 callback
app.post('/auth/discord/callback', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Missing authorization code.' });
    }

    try {
        // Create URLSearchParams object directly
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: DISCORD_REDIRECT_URI,
            scope: 'identify guilds'
        });

        // Exchange authorization code for access token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, { // Pass params object directly
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded', // Crucial header for Discord API
            }
        });

        const { access_token, token_type } = tokenResponse.data;

        // Fetch user information
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${token_type} ${access_token}`,
            },
        });
        const discordUser = userResponse.data;

        // Fetch user's guilds
        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: {
                authorization: `${token_type} ${access_token}`,
            },
        });
        const userGuilds = guildsResponse.data;

        // Fetch all guild IDs from your database that have a hotlap channel configured
        const dbGuildsResult = await db.query('SELECT DISTINCT guild_id FROM guild_settings WHERE hotlap_channel_id IS NOT NULL;');
        const configuredGuildIds = new Set(dbGuildsResult.rows.map(row => row.guild_id));

        // Filter user's guilds to only include those that have a leaderboard configured
        const filteredGuilds = userGuilds
            .filter(guild => configuredGuildIds.has(guild.id))
            .map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon // Include icon hash
            }));

        // Respond with user info and filtered guilds
        res.json({
            user: {
                id: discordUser.id,
                username: discordUser.username,
                discriminator: discordUser.discriminator,
                avatar: discordUser.avatar,
            },
            guilds: filteredGuilds,
        });

    } catch (error) {
        // Log the full error response from Axios for better debugging
        console.error('Error during Discord OAuth callback:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to authenticate with Discord.' });
    }
});


// API Endpoint to get unique track locations
app.get('/api/tracks', async (req, res) => {
    const guildId = req.query.guildId;
    if (!guildId) {
        return res.status(400).json({ error: 'Guild ID is required.' });
    }
    try {
        const result = await db.query('SELECT DISTINCT track_location_name FROM hotlaps WHERE guild_id = $1 ORDER BY track_location_name;', [guildId]);
        res.json(result.rows.map(row => row.track_location_name));
    } catch (err) {
        console.error('❌ Error fetching tracks:', err);
        res.status(500).json({ error: 'Failed to fetch track list.' });
    }
});

// API Endpoint to get leaderboard data (fastest lap per driver per track)
app.get('/api/leaderboard', async (req, res) => {
    const trackName = req.query.track;
    const sortColumn = req.query.sortColumn || 'lap_time';
    const sortOrder = req.query.sortOrder || 'asc';
    const guildId = req.query.guildId;

    if (!guildId) {
        return res.status(400).json({ error: 'Guild ID is required.' });
    }

    const allowedSortColumns = new Set([
        'driver_name', 'team_name', 'lap_time', 's1_time', 's2_time',
        's3_time', 'submission_date', 'track_location_name', 'discord_tag',
        'custom_setup'
    ]);

    if (!allowedSortColumns.has(sortColumn)) {
        return res.status(400).json({ error: 'Invalid sort column.' });
    }

    const orderDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let query = `
        WITH RankedLaps AS (
            SELECT
                id,
                driver_name,
                team_name,
                lap_time,
                s1_time,
                s2_time,
                s3_time,
                custom_setup,
                track_location_name,
                submission_date,
                user_id,
                discord_tag,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, track_location_name
                    ORDER BY
                        CASE
                            WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                            WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                                SPLIT_PART(lap_time, '.', 2)::INT
                            ELSE 999999999
                        END ASC,
                        submission_date ASC
                ) as rn
            FROM hotlaps
            WHERE track_location_name ILIKE $1 AND guild_id = $2
        )
        SELECT
            id,
            driver_name,
            team_name,
            lap_time,
            s1_time,
            s2_time,
            s3_time,
            custom_setup,
            track_location_name,
            submission_date,
            user_id,
            discord_tag
        FROM RankedLaps
        WHERE rn = 1
    `;
    const params = [trackName, guildId];

    let orderByClause = '';
    switch (sortColumn) {
        case 'lap_time':
        case 's1_time':
        case 's2_time':
        case 's3_time':
            orderByClause = `
                CASE
                    WHEN ${sortColumn} ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                        SPLIT_PART(${sortColumn}, ':', 1)::INT * 60000 +
                        SPLIT_PART(SPLIT_PART(${sortColumn}, ':', 2), '.', 1)::INT * 1000 +
                        SPLIT_PART(SPLIT_PART(${sortColumn}, ':', 2), '.', 2)::INT
                    WHEN ${sortColumn} ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                        SPLIT_PART(${sortColumn}, '.', 1)::INT * 1000 +
                        SPLIT_PART(${sortColumn}, '.', 2)::INT
                    ELSE 999999999
                END ${orderDirection} NULLS LAST`;
            break;
        case 'submission_date':
        case 'custom_setup':
            orderByClause = `${sortColumn} ${orderDirection}`;
            break;
        case 'discord_tag':
        case 'driver_name':
        case 'team_name':
        case 'track_location_name':
            orderByClause = `${sortColumn} COLLATE "C" ${orderDirection}`;
            break;
        default:
            orderByClause = `${sortColumn} COLLATE "C" ${orderDirection}`;
            break;
    }

    query += ` ORDER BY ${orderByClause};`;

    try {
        const result = await db.query(query, params);
        res.json(result.rows);
    }
    catch (err) {
        console.error('❌ Error fetching leaderboard data:', err);
        res.status(500).json({ error: 'Failed to fetch leaderboard data.' });
    }
});

// API Endpoint to download leaderboard as CSV
app.get('/api/leaderboard/csv', async (req, res) => {
    const trackName = req.query.track;
    const guildId = req.query.guildId;

    if (!guildId) {
        return res.status(400).send('Guild ID is required.');
    }

    let query = `
        WITH RankedLaps AS (
            SELECT
                id,
                driver_name,
                team_name,
                lap_time,
                s1_time,
                s2_time,
                s3_time,
                custom_setup,
                track_location_name,
                submission_date,
                user_id,
                discord_tag,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id, track_location_name
                    ORDER BY
                        CASE
                            WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                                SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                            WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                                SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                                SPLIT_PART(lap_time, '.', 2)::INT
                            ELSE 999999999
                        END ASC,
                        submission_date ASC
                ) as rn
            FROM hotlaps
            WHERE track_location_name ILIKE $1 AND guild_id = $2
        )
        SELECT
            discord_tag AS "Discord Tag",
            driver_name AS "Driver Name (OCR)",
            team_name AS "Team Name",
            track_location_name AS "Track",
            lap_time AS "Lap Time",
            s1_time AS "S1 Time",
            s2_time AS "S2 Time",
            s3_time AS "S3 Time",
            CASE WHEN custom_setup THEN 'Yes' ELSE 'No' END AS "Custom Setup",
            submission_date AS "Submission Date"
        FROM RankedLaps
        WHERE rn = 1
        ORDER BY
            CASE
                WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                    SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                    SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                    SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                    SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                    SPLIT_PART(lap_time, '.', 2)::INT
                ELSE 999999999
            END ASC;
    `;
    const params = [trackName, guildId];

    try {
        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).send('No data found for this track or guild.');
        }

        // CSV conversion logic
        const header = Object.keys(result.rows[0]).map(key => `"${key.replace(/"/g, '""')}"`).join(',');
        const rows = result.rows.map(row => {
            return Object.values(row).map(value => {
                if (value === null || value === undefined) return '';
                if (value instanceof Date) {
                    return `"${value.toISOString().split('T')[0]}"`;
                }
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',');
        });

        const csv = [header, ...rows].join('\n');

        res.header('Content-Type', 'text/csv');
        res.attachment(`${trackName.replace(/[^a-zA-Z0-9]/g, '_')}_leaderboard.csv`);
        res.send(csv);

    } catch (err) {
        console.error('❌ Error generating CSV for leaderboard:', err);
        res.status(500).json({ error: 'Failed to generate CSV.' });
    }
});

// API Endpoint to get a specific driver's laps for a given track
app.get('/api/driverLaps', async (req, res) => {
    const userId = req.query.userId;
    const trackName = req.query.track;
    const guildId = req.query.guildId;

    if (!userId || !trackName || !guildId) {
        return res.status(400).json({ error: 'User ID, track name, and Guild ID are required.' });
    }

    try {
        const result = await db.query(
            `SELECT
                id,
                driver_name,
                team_name,
                lap_time,
                s1_time,
                s2_time,
                s3_time,
                is_valid,
                custom_setup,
                track_location_name,
                submission_date,
                user_id,
                discord_tag
            FROM hotlaps
            WHERE user_id = $1 AND track_location_name ILIKE $2 AND guild_id = $3
            ORDER BY
                CASE
                    WHEN lap_time ~ '^[0-9]+:[0-5][0-9]\\.[0-9]{3}$' THEN
                        SPLIT_PART(lap_time, ':', 1)::INT * 60000 +
                        SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 1)::INT * 1000 +
                        SPLIT_PART(SPLIT_PART(lap_time, ':', 2), '.', 2)::INT
                    WHEN lap_time ~ '^[0-5]?[0-9]\\.[0-9]{3}$' THEN
                        SPLIT_PART(lap_time, '.', 1)::INT * 1000 +
                        SPLIT_PART(lap_time, '.', 2)::INT
                    ELSE 999999999
                END ASC;`,
            [userId, trackName, guildId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching driver laps:', err);
        res.status(500).json({ error: 'Failed to fetch driver laps.' });
    }
});

// --- Static File Serving for React Frontend ---
// This middleware MUST come AFTER all your /api routes
const reactAppBuildPath = path.join(__dirname, 'leaderboard-frontend', 'dist');

app.use(express.static(reactAppBuildPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(reactAppBuildPath, 'index.html'));
});

// Start the Express server
app.listen(webPort, () => {
    console.log(`🌐 Web server running on http://localhost:${webPort}`);
});
