// commands/analyze_hotlap.js
const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const model = require('../services/gemini');

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

    try {
      const response = await axios.get(image.url, { responseType: 'arraybuffer' });
      const imageBase64 = Buffer.from(response.data).toString('base64');

      // The most targeted prompt to address false positives on "empty" space
      const prompt = `You are an F1 game leaderboard analysis AI. Your mission is to:

1.  **Identify the TOP-MOST DISPLAYED LAP TIME:**
    * Find the "FASTEST LAP" section.
    * Locate the very first (top-most) row of data in this section.
    * Extract the full lap time (e.g., 1:49.631) and its sector times (S1, S2, S3) from *this exact top row*. This is your target lap.

2.  **Crucially, Determine Validity for ONLY THIS TOP-MOST ROW'S "PEN." CELL:**
    * Focus *EXCLUSIVELY* on the cell directly under the "PEN." (Penalty) column within the row of the top-most displayed lap.
    * **DEFAULT ASSUMPTION: The lap is VALID.** A penalty will *only* be marked if a very specific, obvious, and *graphical* penalty icon is present.
    * **INVALID LAP CRITERIA (ONLY IF OVERWHELMINGLY PRESENT):**
        * This cell MUST contain a **CLEARLY VISIBLE, DISTINCT, and OBVIOUS GRAPHICAL SYMBOL** representing a penalty.
        * Examples: a solid black/white checkered flag, a prominent red "X", a "⚠️" (warning) symbol, or any other small, sharp, and intentional penalty graphic.
        * It MUST be a *symbol* or *icon*.
        * **DO NOT MISINTERPRET as a penalty:**
            * **Any empty space, even if it has subtle shading, light variations, or minor background textures.**
            * **Any faint lines, dots, or general UI background elements that are NOT a clear penalty icon.**
            * **Anything that resembles a slight shadow, a faint reflection, or is blurry/indistinct.**
            * **If the cell appears largely blank or devoid of a prominent symbol, it is VALID.**
        * If there is *ANY* doubt, *ANY* ambiguity, or if the graphic is not undeniably a penalty icon, you **MUST** mark the lap as VALID.
    * **VALID LAP CRITERIA:**
        * If the "PEN." cell for the top-most displayed lap is **visibly empty, blank, or contains no distinct, explicit penalty icon** as described above, then the lap is **VALID**. This is the default state.

**Your Response (CRITICAL - Output ONLY one of these two exact formats, NO other text, NO explanations, NO deviations):**

**If the TOP-MOST DISPLAYED LAP is Valid:**
Top Lap Time: [EXTRACTED_LAP_TIME_HERE_E.G._1:49.631]
Valid: ✅
Notes: None

**If the TOP-MOST DISPLAYED LAP is Invalid:**
Top Lap Time: [EXTRACTED_LAP_TIME_HERE_E.G._1:49.449]
Valid: ❌
Notes: Penalty detected on fastest lap`;

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: imageBase64 } }
          ]
        }]
      });

      const text = result.response.text();
      return interaction.editReply(`\`\`\`\n${text.trim()}\n\`\`\` `);
    } catch (err) {
      console.error('❌ Gemini Error:', err);
      return interaction.editReply('⚠️ An error occurred during analysis. The AI might be struggling with the image clarity or specific visual cues. Please provide a clear, high-resolution screenshot.');
    }
  }
};