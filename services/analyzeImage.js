// services/analyzeImage.js
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const model = require('./gemini'); // Path from services/analyzeImage.js to services/gemini.js

async function analyzeImage(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBase64 = Buffer.from(response.data).toString('base64');

        // *** UPDATED PROMPT FOR TRACK LOCATION EXTRACTION ***
        const prompt = `You are an F1 game leaderboard analysis AI. Your task is to process a single screenshot and output EXACTLY ONE of the two JSON formats described at the end. No other text, no explanations.

===== PHASE 1: SCREENSHOT COMPLETENESS VALIDATION =====

Your ABSOLUTE FIRST PRIORITY is to determine if the screenshot is a COMPLETE F1 hotlap leaderboard.

A screenshot is considered COMPLETE ONLY IF it clearly and unambiguously displays ALL of the following:

1) Track Location Name near the top-left (e.g., "BELGIUM - TIME TRIAL", "TEXAS - TIME TRIAL").
   - Only the presence matters here; exact casing is not important.

2) The main "FASTEST LAP" section with a header row that includes ALL of these column headers (case-insensitive):
   - "DRIVER"
   - "TEAM"
   - "TIME"
   - "S1"
   - "S2"
   - "S3"
   - "PEN." (Accept both "PEN." and "PEN" as valid)
   - "CUSTOM SETUP"
   - "ASSISTS"
   Notes:
   - Extra columns like "GAP" MAY be present and do not affect completeness.
   - "CUSTOM SETUP" and "ASSISTS" being present as columns in the FASTEST LAP table is sufficient. They do NOT also need to appear below the table.

CRITICAL RULE for PHASE 1:
- If ANY ONE of the required items above is missing, cropped, obscured, illegible, or not clearly present, the screenshot is INCOMPLETE.
- If the screenshot is INCOMPLETE, you MUST immediately output ONLY the EXACT JSON below and STOP:
{"status": "incomplete", "message": "Hotlap Submission Denied: Incomplete picture"}

===== PHASE 2: LAP DATA EXTRACTION (ONLY IF SCREENSHOT IS COMPLETE) =====

Proceed ONLY if Phase 1 passed.

1) Extract Track Location Name:
   - Find the text near the top-left like "TEXAS - TIME TRIAL".
   - Return ONLY the main track/location portion (before " - TIME TRIAL", " - QUALIFYING", " - GRAND PRIX", etc.).
   - Examples:
     - "BELGIUM - TIME TRIAL" => "BELGIUM"
     - "SAUDI ARABIA - TIME TRIAL" => "SAUDI ARABIA"

2) Identify the TOP-MOST DISPLAYED LAP in the "FASTEST LAP" section:
   - Use the very first data row directly under the "FASTEST LAP" header.
   - This row is often highlighted compared to others.

3) From ONLY this top row, extract:
   - Driver Name (from "DRIVER")
   - Team Name (from "TEAM")
   - Lap Time (from "TIME", e.g., "1:49.631")
   - S1 Time (from "S1")
   - S2 Time (from "S2")
   - S3 Time (from "S3")
   - Custom Setup (from "CUSTOM SETUP", return "Yes" or "No")

4) Determine Validity for THIS TOP ROW ONLY (Penalty check):
   - Focus EXCLUSIVELY on the single cell in the "PEN." column that aligns with the top-most row identified above.
   - Ignore EVERYTHING outside that single cell:
     - Ignore icons in any other rows (including "SESSION BEST LAP TIMES").
     - Ignore icons in other columns (e.g., "ASSISTS").
     - Ignore general UI textures, shadows, reflections, and background shapes.

   DEFAULT: The lap is VALID (is_valid = true).

   Mark the lap INVALID (is_valid = false) ONLY IF ALL of the following are true:
   - Inside that specific top-row "PEN." cell there is a VERY CLEAR, DISTINCT, and UNAMBIGUOUS penalty icon/symbol.
   - Examples of qualifying symbols: a solid red "X", a yellow warning triangle, a distinct checkered/flag-like penalty square, or any sharp and intentional penalty glyph.
   - It must be an explicit symbol. Do NOT treat faint marks, minor shading, dots, lines, reflections, or generic UI textures as penalties.

   HARD REQUIREMENT BEFORE OUTPUTTING is_valid:false:
   - Perform a final re-check of that ONE cell only. If you are NOT 100% certain you see a true penalty symbol in that cell, you MUST set is_valid to true.

===== FINAL OUTPUT (OUTPUT EXACTLY ONE OF THE FOLLOWING, NO OTHER TEXT) =====

If the screenshot is INCOMPLETE (Phase 1 failed):
{"status": "incomplete", "message": "Hotlap Submission Denied: Incomplete picture"}

If the screenshot is COMPLETE (Phase 1 passed), output this JSON with extracted values:
{
  "status": "complete",
  "track_location_name": "[EXTRACTED_TRACK_LOCATION_NAME]",
  "driver_name": "[EXTRACTED_DRIVER_NAME]",
  "team_name": "[EXTRACTED_TEAM_NAME]",
  "lap_time": "[EXTRACTED_LAP_TIME_E.G._1:49.631]",
  "s1_time": "[EXTRACTED_S1_TIME]",
  "s2_time": "[EXTRACTED_S2_TIME]",
  "s3_time": "[EXTRACTED_S3_TIME]",
  "is_valid": [true/false],
  "custom_setup": "[Yes/No]"
}
`;

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: imageBase64 } }
                ]
            }]
        });

        let geminiOutput = result.response.text();

        // FIX: Remove markdown code block fences before parsing JSON
        const jsonMatch = geminiOutput.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
            geminiOutput = jsonMatch[1].trim();
        } else {
            // If it's not wrapped in a markdown block, assume it's just the JSON and try to trim
            geminiOutput = geminiOutput.trim();
        }

        try {
            return JSON.parse(geminiOutput);
        } catch (jsonError) {
            console.error('❌ Error parsing Gemini output as JSON:', jsonError);
            console.error('Gemini Raw Output (after cleaning attempt):', geminiOutput);
            throw new Error('AI analysis failed to return valid data. Please try a different image.');
        }

    } catch (error) {
        console.error('❌ Error analyzing image with Gemini:', error);
        throw new Error(`Failed to analyze image with AI. ${error.message || 'An unknown error occurred.'}`);
    }
}

/**
 * Analyzes an image for hotlap data and saves it to the database.
 * @param {import('discord.js').Message | import('discord.js').ChatInputCommandInteraction} message - The Discord message or interaction.
 * @param {object | null} manualData - Manually provided data from /submit_hotlap command.
 * @param {string | null} centreName - The formatted centre name (for special guilds).
 * @param {string | null} driverOverride - Optional driver name override (forces this discord_tag).
 * @param {object | null} interactionAttachment - The attachment object from a slash command interaction.
 */
async function analyzeAndSaveHotlap(message, manualData = null, centreName = null, driverOverride = null, interactionAttachment = null) {
    const db = require('./database');
    const isInteraction = message.isChatInputCommand?.();
    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const messageId = message.id;

    // Handle Driver Override (Staff Feature)
    const userId = isInteraction ? message.user.id : message.author.id;
    let discordTag = isInteraction ? message.user.tag : message.author.tag;

    if (driverOverride) {
        console.log(`Driver Override Active: Replacing ${discordTag} with ${driverOverride}`);
        discordTag = driverOverride;
    }

    try {
        let analysisResult, trackLocationName, driverName, teamName, lapTime, s1Time, s2Time, s3Time, isValid, customSetupBoolean;

        if (manualData) {
            // Manual submission logic
            console.log('Processing manual submission...');
            trackLocationName = manualData.trackName;
            driverName = manualData.driverName;
            teamName = manualData.teamName;
            lapTime = manualData.lapTime;
            s1Time = manualData.s1;
            s2Time = manualData.s2;
            s3Time = manualData.s3;
            isValid = manualData.isValid;
            customSetupBoolean = manualData.isCustom;
        } else {
            // Automatic submission logic
            console.log('Processing automatic submission (Image Analysis)...');

            // Determine which attachment to use (Interaction vs Message)
            let attachment;
            if (interactionAttachment) {
                attachment = interactionAttachment;
            } else {
                attachment = message.attachments ? message.attachments.first() : null;
            }

            if (!attachment) {
                throw new Error('No image attachment found.');
            }

            if (isInteraction) {
                // If we are here via slash command, we might need to defer if not already deferred
            } else {
                await message.channel.sendTyping();
            }

            analysisResult = await analyzeImage(attachment.url);

            if (analysisResult.status === 'incomplete') {
                const replyMsg = `⚠️ ${analysisResult.message}. Please upload a full screenshot showing the whole screen.`;
                if (isInteraction) await message.editReply(replyMsg);
                else await message.reply(replyMsg);
                return;
            } else if (analysisResult.status !== 'complete') {
                console.error('❌ Unexpected analysis status from Gemini:', analysisResult.status);
                const replyMsg = '⚠️ Something went wrong during analysis. Unexpected AI response.';
                if (isInteraction) await message.editReply(replyMsg);
                else await message.reply(replyMsg);
                return;
            }

            // Reject invalid laps and stop processing
            if (!analysisResult.is_valid) {
                const trackName = analysisResult.track_location_name || 'Unknown Track';
                const time = analysisResult.lap_time || 'N/A';
                const replyMsg = `❌ Lap Rejected: The fastest lap (${time}) on ${trackName} is invalid due to a penalty. Only valid laps can be processed and recorded.`;

                // --- UPDATED: Repost image even on rejection (ONLY for upload_hotlap) ---
                const replyPayload = { content: replyMsg };
                if (isInteraction && interactionAttachment) {
                    replyPayload.files = [interactionAttachment.url];
                }

                if (isInteraction) await message.editReply(replyPayload);
                else await message.reply(replyMsg);
                return;
            }

            trackLocationName = analysisResult.track_location_name;
            driverName = analysisResult.driver_name;
            teamName = analysisResult.team_name;
            lapTime = analysisResult.lap_time;
            s1Time = analysisResult.s1_time;
            s2Time = analysisResult.s2_time;
            s3Time = analysisResult.s3_time;
            isValid = analysisResult.is_valid;
            customSetupBoolean = analysisResult.custom_setup === 'Yes' ? true : false;
        }

        const submissionDate = new Date();

        // Insert into the database with centre_name
        const query = `
            INSERT INTO hotlaps (
                guild_id, channel_id, message_id, user_id, discord_tag, 
                driver_name, team_name, lap_time, s1_time, s2_time, s3_time, 
                is_valid, custom_setup, track_location_name, submission_date, 
                centre_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id;
        `;

        const values = [
            guildId, channelId, messageId, userId, discordTag,
            driverName, teamName, lapTime, s1Time, s2Time, s3Time,
            isValid, customSetupBoolean, trackLocationName, submissionDate,
            centreName
        ];

        const res = await db.query(query, values);
        console.log(`Hotlap saved with ID: ${res.rows[0].id}`);

        // --- CONSTRUCT FIELDS DYNAMICALLY ---
        // This ensures 'Centre' only appears if it exists (Special Guild)
        const embedFields = [
            { name: '🏎️ Driver', value: discordTag, inline: true },
        ];

        // CONDITIONAL ADD: Only add Centre if not null
        if (centreName) {
            embedFields.push({ name: '📍 Centre', value: centreName, inline: true });
        }

        embedFields.push(
            { name: '🏁 Track', value: trackLocationName, inline: true },
            { name: '⏱️ Lap Time', value: lapTime, inline: true },
            { name: '🏎️ Team', value: teamName, inline: true },
            { name: '✅ Valid?', value: isValid ? 'Yes' : 'No', inline: true },
            { name: '🔧 Custom Setup', value: customSetupBoolean ? 'Yes' : 'No', inline: true },
            { name: '⏱️ Sectors', value: `S1: ${s1Time} | S2: ${s2Time} | S3: ${s3Time}`, inline: true }
        );

        // --- CREATE RESPONSE EMBED ---
        const responseEmbed = new EmbedBuilder()
            .setColor(isValid ? 0x00AAFF : 0xFF0000) 
            .setTitle(manualData ? '📊 Hotlap Manually Submitted' : '📊 Hotlap Analysis Complete')
            .addFields(embedFields) // Use the dynamic array
            .setTimestamp()
            .setFooter({ text: 'CircuitCore - By R. Ottens' });

        if (interactionAttachment) {
            responseEmbed.setImage(interactionAttachment.url);
        }

        const responsePayload = { 
            content: `✅ **Hotlap recorded successfully!**`,
            embeds: [responseEmbed]
        };

        if (isInteraction) {
            await message.editReply(responsePayload);
        } else {
            await message.reply(responsePayload);
        }
        // --- REPOST LOGIC (New Feature) ---
        // Only repost if we have an image (skips manual submissions)
        if (interactionAttachment) {
            const REPOST_CHANNEL_ID = '1440733073338535987';
            try {
                const targetChannel = await message.client.channels.fetch(REPOST_CHANNEL_ID);
                if (targetChannel) {
                    const uploaderTag = isInteraction ? message.user.tag : message.author.tag;
                    const uploaderAvatar = isInteraction ? message.user.displayAvatarURL() : message.author.displayAvatarURL();

                    const embed = new EmbedBuilder()
                        .setColor(0x00AAFF) // CircuitCore Blue-ish
                        .setTitle('🔥 New Hotlap Uploaded!')
                        .setAuthor({ name: `Uploaded by ${uploaderTag}`, iconURL: uploaderAvatar })
                        .addFields(
                            { name: '🏎️ Driver', value: discordTag, inline: true }, // This shows the "Driver Name" (overridden if applicable)
                            { name: '📍 Centre', value: centreName || 'N/A', inline: true },
                            { name: '🏁 Track', value: trackLocationName, inline: true },
                            { name: '⏱️ Lap Time', value: lapTime, inline: true },
                            { name: '🏎️ Team', value: teamName, inline: true },
                            { name: '✅ Valid?', value: isValid ? 'Yes' : 'No', inline: true },
                            { name: '🔧 Custom Setup', value: customSetupBoolean ? 'Yes' : 'No', inline: true },
                            { name: '⏱️ Sectors', value: `S1: ${s1Time} | S2: ${s2Time} | S3: ${s3Time}`, inline: true }
                        )
                        .setImage(interactionAttachment.url)
                        .setTimestamp()
                        .setFooter({ text: 'CircuitCore - By R. Ottens' });

                    await targetChannel.send({ embeds: [embed] });
                    console.log(`Reposted hotlap embed to channel ${REPOST_CHANNEL_ID}`);
                }
            } catch (err) {
                console.error('Failed to repost hotlap to log channel:', err.message);
            }
        }

    } catch (error) {
        console.error(`Error processing hotlap: ${error.message}`);
        const errorContent = `Failed to process hotlap: ${error.message}`;
        if (isInteraction) {
            // If reply was deferred, use editReply, otherwise reply
            await message.editReply({ content: errorContent });
        } else {
            await message.reply(`⚠️ Sorry, I couldn't analyze that image. ${error.message || 'An unknown error occurred.'}`);
        }
    }
}

module.exports = analyzeImage;
module.exports.analyzeAndSaveHotlap = analyzeAndSaveHotlap;