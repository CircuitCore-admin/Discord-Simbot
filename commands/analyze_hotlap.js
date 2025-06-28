// commands/analyze_hotlap.js
const { SlashCommandBuilder } = require('discord.js');
const analyzeImage = require('../services/analyzeImage');

// --- REMOVED: MIN_IMAGE_WIDTH and MIN_IMAGE_HEIGHT ---

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analyze_hotlap')
    .setDescription('Analyze an F1 hotlap screenshot using Gemini AI')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('Upload the screenshot of the hotlap')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const image = interaction.options.getAttachment('image');

    // --- REMOVED: Dimension Check ---

    try {
      const analysisResult = await analyzeImage(image.url);

      if (analysisResult.trim() === 'Hotlap Submission Denied: Incomplete picture') {
          return interaction.editReply('⚠️ Hotlap Submission Denied: Your picture is incomplete. Please upload a full screenshot showing ALL required sections and columns (Track Location, Driver, Team, Time, S1, S2, S3, PEN., Custom Setup, Assists).');
      } else {
          return interaction.editReply(`\`\`\`\n${analysisResult.trim()}\n\`\`\` `);
      }

    } catch (err) {
      console.error('❌ Command Error:', err);
      return interaction.editReply(`⚠️ ${err.message || 'Something went wrong while analyzing the screenshot.'}`);
    }
  }
};