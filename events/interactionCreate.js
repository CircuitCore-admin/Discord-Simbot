const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js'); // Added MessageFlags
const db = require('../services/database');

// --- REMOVED: No longer need cache or cleanup for a single modal ---

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
                    flags: [MessageFlags.Ephemeral], // MODIFIED
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
            // --- REMOVED: Logic for 'edit-hotlap-2-' ---

            // Handle the single modal submission
            if (interaction.customId.startsWith('edit-hotlap-')) {
                try {
                    const recordId = interaction.customId.replace('edit-hotlap-', '');
                    
                    // Get values from the single modal
                    const driverName = interaction.fields.getTextInputValue('driver_name');
                    const lapTime = interaction.fields.getTextInputValue('lap_time');
                    const s1Time = interaction.fields.getTextInputValue('s1_time');
                    const s2Time = interaction.fields.getTextInputValue('s2_time');
                    const s3Time = interaction.fields.getTextInputValue('s3_time');

                    // --- REMOVED: Cache logic ---
                    // --- REMOVED: Button reply ---

                    // --- ADDED: Direct database update ---
                    await db.query(
                        `UPDATE hotlaps 
                         SET driver_name = $1, lap_time = $2, s1_time = $3, 
                             s2_time = $4, s3_time = $5
                         WHERE id = $6`,
                        [
                            driverName,
                            lapTime,
                            s1Time,
                            s2Time,
                            s3Time,
                            recordId
                        ]
                    );

                    await interaction.reply({
                        content: `✅ Hotlap record (ID: ${recordId}) has been successfully updated!\nNew lap time: ${lapTime}`,
                        flags: [MessageFlags.Ephemeral] // MODIFIED
                    });
                    // --- END OF MODIFICATION ---

                } catch (error) {
                    console.error('❌ Error handling modal submission:', error);
                    // Try to reply if we haven't shown the modal yet
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            return interaction.reply({
                                content: '⚠️ An error occurred while processing your edit. Please try again.',
                                flags: [MessageFlags.Ephemeral] // MODIFIED
                            });
                        }
                    } catch (replyError) {
                        // If we can't reply (e.g., modal was already shown), just log the error
                        console.error('❌ Could not send error message to user:', replyError);
                    }
                }
            }
        } else if (interaction.isButton()) {
            // --- REMOVED: All 'edit-hotlap-continue-' logic ---
            console.log(`Unhandled button interaction: ${interaction.customId}`);

        } else if (interaction.isStringSelectMenu()) {
            // Handle select menu interactions for choosing which record to edit
            if (interaction.customId.startsWith('edit-hotlap-select-')) {
                try {
                    const recordId = interaction.values[0];
                    
                    // Fetch the selected record
                    const result = await db.query('SELECT * FROM hotlaps WHERE id = $1', [recordId]);
                    
                    if (result.rows.length === 0) {
                        return interaction.update({
                            content: '❌ Record not found. It may have been deleted.',
                            components: [],
                            flags: [MessageFlags.Ephemeral] // MODIFIED
                        });
                    }

                    const record = result.rows[0];
                    
                    // --- MODIFIED: Create the new 5-field modal ---
                    const modal = new ModalBuilder()
                        .setCustomId(`edit-hotlap-${record.id}`)
                        .setTitle(`Edit Lap: ${record.driver_name} - ${record.track_location_name} - ${record.lap_time}`);

                    // Create text input components for 5 editable fields
                    const driverNameInput = new TextInputBuilder()
                        .setCustomId('driver_name')
                        .setLabel('Driver Name')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.driver_name || '')
                        .setRequired(true);

                    // --- REMOVED: teamNameInput ---

                    const lapTimeInput = new TextInputBuilder()
                        .setCustomId('lap_time')
                        .setLabel('Lap Time')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.lap_time || '')
                        .setRequired(true);

                    const s1TimeInput = new TextInputBuilder()
                        .setCustomId('s1_time')
                        .setLabel('Sector 1 Time')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.s1_time || '')
                        .setRequired(true);

                    const s2TimeInput = new TextInputBuilder()
                        .setCustomId('s2_time')
                        .setLabel('Sector 2 Time')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.s2_time || '')
                        .setRequired(true);
                    
                    const s3TimeInput = new TextInputBuilder()
                        .setCustomId('s3_time')
                        .setLabel('Sector 3 Time')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.s3_time || '')
                        .setRequired(true);

                    const row1 = new ActionRowBuilder().addComponents(driverNameInput);
                    const row2 = new ActionRowBuilder().addComponents(lapTimeInput);
                    const row3 = new ActionRowBuilder().addComponents(s1TimeInput);
                    const row4 = new ActionRowBuilder().addComponents(s2TimeInput);
                    const row5 = new ActionRowBuilder().addComponents(s3TimeInput);

                    modal.addComponents(row1, row2, row3, row4, row5);
                    // --- END OF MODIFICATION ---

                    // Show the modal
                    await interaction.showModal(modal);

                } catch (error) {
                    console.error('❌ Error handling select menu for edit:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            return interaction.reply({
                                content: '⚠️ An error occurred while loading the edit modal. Please try again.',
                                flags: [MessageFlags.Ephemeral] // MODIFIED
                            });
                        }
                    } catch (replyError) {
                        console.error('❌ Could not send error message to user:', replyError);
                    }
                }
            }
            // Handle select menu interactions for choosing which record to delete
            else if (interaction.customId.startsWith('delete-hotlap-select-')) {
                try {
                    const recordId = interaction.values[0];
                    
                    // Fetch the selected record
                    const result = await db.query('SELECT * FROM hotlaps WHERE id = $1', [recordId]);
                    
                    if (result.rows.length === 0) {
                        return interaction.update({
                            content: '❌ Record not found. It may have been already deleted.',
                            components: [],
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    const record = result.rows[0];
                    
                    // Delete the record
                    await db.query('DELETE FROM hotlaps WHERE id = $1', [record.id]);

                    await interaction.update({
                        content: `✅ Successfully deleted hotlap record!\n\n**Details:**\n🏎️ Driver: ${record.discord_tag}\n🏁 Track: ${record.track_location_name}\n⏱️ Lap Time: ${record.lap_time}\n📅 Submitted: ${new Date(record.submission_date).toLocaleString()}`,
                        components: []
                    });

                } catch (error) {
                    console.error('❌ Error handling select menu for delete:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            return interaction.reply({
                                content: '⚠️ An error occurred while deleting the record. Please try again.',
                                flags: [MessageFlags.Ephemeral]
                            });
                        }
                    } catch (replyError) {
                        console.error('❌ Could not send error message to user:', replyError);
                    }
                }
            }
        }
    },
};