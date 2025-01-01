const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const db = require('../services/database');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Dynamic import for node-fetch v3+

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upload_drivers')
        .setDescription('Upload a CSV file with driver information')
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('The CSV file to upload')
                .setRequired(true)
        ),

    async execute(interaction) {
        const file = interaction.options.getAttachment('file');

        if (!file) {
            return interaction.reply('❌ Please upload a CSV file.');
        }

        console.log(`🚀 File Received: ${file.name}`);

        const filePath = path.join(__dirname, '..', 'uploads', path.basename(file.name));

        try {
            // 🚦 **Download and Save CSV Securely**
            const response = await fetch(file.url);
            if (!response.ok) throw new Error('Failed to download file.');

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            fs.writeFileSync(filePath, buffer);
            console.log('✅ File saved locally.');

            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            const requiredHeaders = [
                'username',
                'real name',
                'identifier',
                'steam64_id',
                'car class',
                'car number',
                'car name',
                'registered at'
            ];

            const rows = []; // Store rows for batch processing

            // 🚦 **Parse CSV and Validate Headers**
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csvParser())
                    .on('headers', (headers) => {
                        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                        if (missingHeaders.length > 0) {
                            reject(new Error(`❌ Missing headers: ${missingHeaders.join(', ')}`));
                        }
                    })
                    .on('data', (row) => rows.push(row))
                    .on('end', resolve)
                    .on('error', reject);
            });

            console.log(`🔄 Processing ${rows.length} rows...`);

            // 🚦 **Process Rows with SQL Protection**
            for (const row of rows) {
                const username = row['username']?.trim() || null;
                const real_name = row['real name']?.trim() || null;
                const steam64_id = row['steam64_id']?.trim() || null;

                if (!steam64_id) {
                    console.warn(`⏭️ Skipping row due to missing steam64_id.`);
                    skippedCount++;
                    continue;
                }

                try {
                    // 🚦 Check if Driver Exists
                    const { rows: existingDrivers } = await db.query(
                        `SELECT username, real_name FROM driver_info WHERE steam_id = $1`,
                        [steam64_id]
                    );

                    if (existingDrivers.length > 0) {
                        const driver = existingDrivers[0];
                        const updates = [];
                        const updateValues = [];
                        let paramIndex = 1;

                        if (username && driver.username !== username) {
                            updates.push(`username = $${paramIndex++}`);
                            updateValues.push(username);
                        }

                        if (real_name && driver.real_name !== real_name) {
                            updates.push(`real_name = $${paramIndex++}`);
                            updateValues.push(real_name);
                        }

                        if (updates.length > 0) {
                            updateValues.push(steam64_id);
                            const query = `
                                UPDATE driver_info 
                                SET ${updates.join(', ')} 
                                WHERE steam_id = $${paramIndex}
                            `;
                            await db.query(query, updateValues);
                            updatedCount++;
                        } else {
                            // console.log(`⏭️ No changes needed for SteamID: ${steam64_id}`);
                            skippedCount++;
                        }
                    } else {
                        await db.query(
                            `INSERT INTO driver_info (steam_id, username, real_name) 
                            VALUES ($1, $2, $3)`,
                            [steam64_id, username || null, real_name || null]
                        );
                        addedCount++;
                    }
                } catch (dbError) {
                    console.error(`❌ Database Error for SteamID: ${steam64_id}`, dbError.message);
                    skippedCount++;
                }
            }

            console.log('✅ CSV Processing Complete:');
            console.log(`🆕 Added: ${addedCount}`);
            console.log(`🔄 Updated: ${updatedCount}`);
            console.log(`⏭️ Skipped: ${skippedCount}`);

            await interaction.reply(
                `✅ CSV Processing Complete:\n🆕 Added: ${addedCount}\n🔄 Updated: ${updatedCount}\n⏭️ Skipped: ${skippedCount}`
            );

            // 🧹 **Cleanup Temporary Files**
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('🧹 Temporary file deleted.');
            }
        } catch (error) {
            console.error('❌ Error handling the CSV upload:', error.message || error);
            await interaction.reply('❌ An error occurred while uploading and processing the CSV file.');

            // 🧹 Ensure Cleanup on Exception
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('🧹 Temporary file deleted.');
            }
        }
    },
};
