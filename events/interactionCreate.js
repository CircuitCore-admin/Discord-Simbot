const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../services/database');

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
                await interaction.respond([]);
            }
        } else if (interaction.isModalSubmit()) {
            // Handle modal submissions for edit hotlap
            if (interaction.customId.startsWith('edit-hotlap-')) {
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

                    // Create second modal for remaining fields
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
                        .setLabel('Is Valid (true or false)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.is_valid ? 'true' : 'false')
                        .setRequired(true);

                    const customSetupInput = new TextInputBuilder()
                        .setCustomId('custom_setup')
                        .setLabel('Custom Setup (true or false)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.custom_setup ? 'true' : 'false')
                        .setRequired(true);

                    const trackLocationInput = new TextInputBuilder()
                        .setCustomId('track_location_name')
                        .setLabel('Track Location Name')
                        .setStyle(TextInputStyle.Short)
                        .setValue(record.track_location_name || '')
                        .setRequired(true);

                    const row1 = new ActionRowBuilder().addComponents(s3TimeInput);
                    const row2 = new ActionRowBuilder().addComponents(isValidInput);
                    const row3 = new ActionRowBuilder().addComponents(customSetupInput);
                    const row4 = new ActionRowBuilder().addComponents(trackLocationInput);

                    modal2.addComponents(row1, row2, row3, row4);

                    // Store first modal data in a temporary cache (we'll encode it in customId)
                    // Encode the data as base64 in customId to pass to second modal
                    const firstModalData = JSON.stringify({
                        driver_name: driverName,
                        team_name: teamName,
                        lap_time: lapTime,
                        s1_time: s1Time,
                        s2_time: s2Time
                    });
                    const encodedData = Buffer.from(firstModalData).toString('base64');
                    
                    // Update customId to include encoded data
                    modal2.setCustomId(`edit-hotlap-2-${recordId}-${encodedData}`);

                    await interaction.showModal(modal2);

                } catch (error) {
                    console.error('❌ Error handling first modal submission:', error);
                    return interaction.reply({
                        content: '⚠️ An error occurred while processing your edit. Please try again.',
                        ephemeral: true
                    });
                }
            } else if (interaction.customId.startsWith('edit-hotlap-2-')) {
                try {
                    // Parse customId to get record ID and first modal data
                    const parts = interaction.customId.split('-');
                    const recordId = parts[3];
                    const encodedData = parts.slice(4).join('-');
                    
                    // Decode first modal data
                    const firstModalData = JSON.parse(Buffer.from(encodedData, 'base64').toString());

                    // Get values from second modal
                    const s3Time = interaction.fields.getTextInputValue('s3_time');
                    const isValidStr = interaction.fields.getTextInputValue('is_valid').toLowerCase();
                    const customSetupStr = interaction.fields.getTextInputValue('custom_setup').toLowerCase();
                    const trackLocationName = interaction.fields.getTextInputValue('track_location_name');

                    // Convert boolean strings to actual booleans
                    const isValid = isValidStr === 'true';
                    const customSetup = customSetupStr === 'true';

                    // Update the database
                    await db.query(
                        `UPDATE hotlaps 
                         SET driver_name = $1, team_name = $2, lap_time = $3, 
                             s1_time = $4, s2_time = $5, s3_time = $6, 
                             is_valid = $7, custom_setup = $8, track_location_name = $9
                         WHERE id = $10`,
                        [
                            firstModalData.driver_name,
                            firstModalData.team_name,
                            firstModalData.lap_time,
                            firstModalData.s1_time,
                            firstModalData.s2_time,
                            s3Time,
                            isValid,
                            customSetup,
                            trackLocationName,
                            recordId
                        ]
                    );

                    await interaction.reply({
                        content: `✅ Hotlap record (ID: ${recordId}) has been successfully updated!\nNew lap time: ${firstModalData.lap_time}`,
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('❌ Error handling second modal submission:', error);
                    return interaction.reply({
                        content: '⚠️ An error occurred while saving your changes. Please try again.',
                        ephemeral: true
                    });
                }
            }
        }
    },
};