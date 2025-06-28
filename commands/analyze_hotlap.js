const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { extractTextFromImage } = require('../services/ocr');
const { parseAndValidate } = require('../services/validator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analyze_hotlap')
    .setDescription('Analyze an F1 hotlap screenshot using OCR')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Upload the screenshot of the hotlap')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const image = interaction.options.getAttachment('image');

    try {
      const response = await axios.get(image.url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      const rawText = await extractTextFromImage(buffer);
      if (!rawText) return interaction.editReply('❌ No text could be read from the image.');

      const summary = parseAndValidate(rawText);

      const formatted = `
Lap Summary:
- Lap Time: ${summary.lapTime || '❌ Not detected'}
- Sectors: ${summary.sectors.join(', ') || '❌ Not detected'}
- Valid: ${summary.valid ? '✅' : '❌'}
- Notes: ${summary.notes.length ? summary.notes.join('; ') : 'None'}
      `.trim();

      return interaction.editReply(`\`\`\`\n${formatted}\n\`\`\``);
    } catch (err) {
      console.error(err);
      return interaction.editReply('⚠️ Something went wrong while analyzing the image.');
    }
  }
};
