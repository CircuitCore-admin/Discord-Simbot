const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../services/database');

// In-memory cache to store first modal data temporarily
// Format: Map<recordId, { data: {...}, timestamp: number }>
const editDataCache = new Map();

// Cleanup old cache entries (older than 5 minutes)
setInterval(() => {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    for (const [key, value] of editDataCache.entries()) {
        if (value.timestamp < fiveMinutesAgo) {
            editDataCache.delete(key);
            console.log(`🧹 Cleaned up expired cache entry: ${key}`);
        }
    }
}, 60 * 1000); // Run every minute

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                console.log(`🚀 Executing command: ${interaction.commandName}`);
                await command.execute(interaction);
            } catch (error) {
                console.error('❌ Error executing command:', error);
                await interaction.reply({
                    content: 'There was an error executing that command.',
                    ephemeral: true,
                });
            }
        } else if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                console.log(`🔄 Handling autocomplete for: ${interaction.commandName}`);
                if (command.autocomplete) {
                    await command.autocomplete(interaction);
                } else {
                    console.warn(`⚠️ No autocomplete handler defined for: ${interaction.commandName}`);
                }
            } catch (error) {
                console.error('❌ Error handling autocomplete:', error);
                try {
                    await interaction.respond([]);
                } catch (respondError) {
                    console.error('❌ Could not respond to autocomplete interaction:', respondError);
                }
            }
        } else if (interaction.isModalSubmit()) {
            // Handle modal submissions for edit hotlap
            // Check for second modal first (more specific pattern)
            if (interaction.customId.startsWith('edit-hotlap-2-')) {
                try {
                    // Parse customId to get record ID
                    const recordId = interaction.customId.replace('edit-hotlap-2-', '');
                    
                    // Retrieve first modal data from cache
                    const cacheEntry = editDataCache.get(recordId);
                    
                    if (!cacheEntry) {
                        return interaction.reply({
                            content: '❌ Session expired. Please try the edit command again.',
                            ephemeral: true
                        });
                    }

                    const firstModalData = cacheEntry.data;

                    // Get values from second modal
                    const s3Time = interaction.fields.getTextInputValue('s3_time');
                    const isValidStr = interaction.fields.getTextInputValue('is_valid').toLowerCase();
                    const customSetupStr = interaction.fields.getTextInputValue('custom_setup').toLowerCase();

                    // Convert boolean strings to actual booleans
                    const isValid = isValidStr === 'true';
                    const customSetup = customSetupStr === 'true';

                    try {
                        // Update the database (without track_location_name)
                        await db.query(
                            `UPDATE hotlaps 
                             SET driver_name = $1, team_name = $2, lap_time = $3, 
                                 s1_time = $4, s2_time = $5, s3_time = $6, 
                                 is_valid = $7, custom_setup = $8
                             WHERE id = $9`,
                            [
                                firstModalData.driver_name,
                                firstModalData.team_name,
                                firstModalData.lap_time,
                                firstModalData.s1_time,
                                firstModalData.s2_time,
                                s3Time,
                                isValid,
                                customSetup,
                                recordId
                            ]
                        );

                        await interaction.reply({
                            content: `✅ Hotlap record (ID: ${recordId}) has been successfully updated!\nNew lap time: ${firstModalData.lap_time}`,
                            ephemeral: true
                        });
                    } finally {
                        // Always clear cache entry, even if update fails
                        editDataCache.delete(recordId);
                    }

                } catch (error) {
                    console.error('❌ Error handling second modal submission:', error);
                    // Check if we already replied, if not reply, otherwise followUp
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            return interaction.reply({
                                content: '⚠️ An error occurred while saving your changes. Please try again.',
                                ephemeral: true
                            });
                        } else {
                            return interaction.followUp({
                                content: '⚠️ An error occurred while saving your changes. Please try again.',
                                ephemeral: true
                            });
                        }
                    } catch (replyError) {
                        console.error('❌ Could not send error message to user:', replyError);
                    }
                }
            } else if (interaction.customId.startsWith('edit-hotlap-')) {
                try {
                    const recordId = interaction.customId.replace('edit-hotlap-', '');
                    
                    // Get values from first modal
                    const driverName = interaction.fields.getTextInputValue('driver_name');
                    const teamName = interaction.fields.getTextInputValue('team_name');
                    const lapTime = interaction.fields.getTextInputValue('lap_time');
                    const s1Time = interaction.fields.getTextInputValue('s1_time');
                    const s2Time = interaction.fields.getTextInputValue('s2_time');

                    // Fetch current record to get remaining fields for second modal
                    const result = await db.query('SELECT * FROM hotlaps WHERE id = $1', [recordId]);
                    
                    if (result.rows.length === 0) {
                        return interaction.reply({
                            content: '❌ Record not found. It may have been deleted.',
                            ephemeral: true
                        });
                    }

                    const record = result.rows[0];

                    // Create second modal for remaining 3 fields
                    const modal2 = new ModalBuilder()
                        .setCustomId(`edit-hotlap-2-${recordId}`)
                        .setTitle('Edit Lap (Part 2/2)');

                    const s3TimeInput = new TextInputBuilder()
                        .setCustomId('s3_time')
                        .setLabel('Sector 3 Time')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.s3_time || '')
                        .setRequired(true);

                    const isValidInput = new TextInputBuilder()
                        .setCustomId('is_valid')
                        .setLabel('Valid:')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.is_valid ? 'true' : 'false')
                        .setRequired(true);

                    const customSetupInput = new TextInputBuilder()
                        .setCustomId('custom_setup')
                        .setLabel('Setup:')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.custom_setup ? 'true' : 'false')
                        .setRequired(true);

                    const row1 = new ActionRowBuilder().addComponents(s3TimeInput);
                    const row2 = new ActionRowBuilder().addComponents(isValidInput);
                    const row3 = new ActionRowBuilder().addComponents(customSetupInput);

                    modal2.addComponents(row1, row2, row3);

                    // Store first modal data in cache with timestamp
                    editDataCache.set(recordId, {
                        data: {
                            driver_name: driverName,
                            team_name: teamName,
                            lap_time: lapTime,
                            s1_time: s1Time,
                            s2_time: s2Time
                        },
                        timestamp: Date.now()
                    });

                    // Show the second modal
                    await interaction.showModal(modal2);

                } catch (error) {
                    console.error('❌ Error handling first modal submission:', error);
                    // Try to reply if we haven't shown the modal yet
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            return interaction.reply({
                                content: '⚠️ An error occurred while processing your edit. Please try again.',
                                ephemeral: true
                            });
                        }
                    } catch (replyError) {
                        // If we can't reply (e.g., modal was already shown), just log the error
                        console.error('❌ Could not send error message to user:', replyError);
                    }
                }
            }
        }
    },
};