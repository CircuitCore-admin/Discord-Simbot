// services/analyzeImage.js
const axios = require('axios');
const model = require('./gemini'); // Path from services/analyzeImage.js to services/gemini.js

async function analyzeImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(response.data).toString('base64');

    // **Aggressive Forced-Step Prompt: Prioritizes Completeness Check with Strict Output**
    const prompt = `You are an F1 game leaderboard analysis AI. Your task is to process a single screenshot. You MUST follow these instructions precisely.

**===== PHASE 1: SCREENSHOT COMPLETENESS VALIDATION =====**

* **Your ABSOLUTE FIRST PRIORITY is to determine if the screenshot is a COMPLETE F1 hotlap leaderboard.**
* A screenshot is considered **COMPLETE** ONLY IF it clearly and unambiguously displays **ALL** of the following exact UI elements/column headers:
    1.  The **Track Location Name** at the top-left (e.g., "BELGIUM - TIME TRIAL").
    2.  The main "FASTEST LAP" section, which MUST visibly include **ALL** of these specific column headers, exactly as they appear (case-insensitive, but match visual style):
        * "DRIVER"
        * "TEAM"
        * "TIME"
        * "S1"
        * "S2"
        * "S3"
        * "PEN."
    3.  Below the main leaderboard table, the distinct UI elements for **"CUSTOM SETUP"** and **"ASSISTS"**. These must be clearly visible.

* **CRITICAL RULE for PHASE 1:**
    * If **ANY ONE** of the above listed elements/column headers (Track Location, DRIVER, TEAM, TIME, S1, S2, S3, PEN., CUSTOM SETUP, ASSISTS) is **missing, cropped, obscured, illegible, or not clearly distinct and present**, then the screenshot is **INCOMPLETE.**
    * **If the screenshot is INCOMPLETE, you MUST IMMEDIATELY and ONLY output this EXACT string:**
        \`\`\`
        Hotlap Submission Denied: Incomplete picture
        \`\`\`
        *AND YOU MUST STOP ALL FURTHER ANALYSIS.*

**===== PHASE 2: LAP ANALYSIS (ONLY IF SCREENSHOT IS COMPLETE) =====**

* **If and ONLY if you have confidently determined the screenshot is COMPLETE (all required elements from PHASE 1 are clearly visible), then proceed with lap analysis.**
* **Identify the TOP-MOST DISPLAYED LAP TIME:**
    * Locate the section clearly titled "FASTEST LAP".
    * Find the very first (top-most) row of data under this section.
    * From *only this top row*, extract the complete lap time (e.g., "1:49.631") and any associated sector times (S1, S2, S3). This is your target lap.

* **Determine Validity for THIS TARGET LAP ONLY (Extreme Caution on Penalties):**
    * Focus *EXCLUSIVELY* on the single cell directly under the "PEN." column that aligns precisely with the **TOP-MOST LAP TIME'S ROW** you just identified.
    * **DEFAULT ASSUMPTION: The lap is VALID.** A penalty will *only* be marked if a very specific, obvious, and *graphical* penalty icon is present.
    * **INVALID LAP CRITERIA (ONLY IF OVERWHELMINGLY PRESENT):**
        * This cell MUST contain a **CLEARLY VISIBLE, DISTINCT, and OBVIOUS GRAPHICAL SYMBOL** representing a penalty.
        * Examples: a solid black/white checkered flag, a prominent red "X", a "⚠️" (warning) symbol, or any small, sharp, and intentional penalty graphic.
        * It MUST be a *symbol*, *not* just a dark spot, a slight discoloration, or background texture.
        * **DO NOT MISINTERPRET as a penalty:** Any empty space, subtle shading, light variations, minor background textures, faint lines, dots, general UI background elements that are NOT a clear penalty icon, slight shadows, faint reflections, or blurry/indistinct marks.
        * If there is *ANY* doubt, *ANY* ambiguity, or if the graphic is not undeniably a penalty icon, you **MUST** mark the lap as VALID.
    * **VALID LAP CRITERIA:** If the "PEN." cell for the top-most displayed lap is **visibly empty, blank, or lacks any *obvious, explicit penalty icon*** as described above, then the lap is **VALID**. This is the default state.

**===== YOUR FINAL RESPONSE (CRITICAL - Output ONLY one of these three EXACT formats. NO other text, NO explanations, NO deviations) =====**

**If the screenshot is INCOMPLETE (based on PHASE 1 failure):**
Hotlap Submission Denied: Incomplete picture

**If the screenshot is COMPLETE AND the TOP-MOST DISPLAYED LAP is Valid:**
Top Lap Time: [EXTRACTED_LAP_TIME_HERE_E.G._1:49.631]
Valid: ✅
Notes: None

**If the screenshot is COMPLETE AND the TOP-MOST DISPLAYED LAP is Invalid:**
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

    return result.response.text();
  } catch (error) {
    console.error('❌ Error analyzing image with Gemini:', error);
    // Throw a specific error message that can be caught by the caller
    throw new Error('Failed to analyze image with AI. Please ensure the image is clear and try again.');
  }
}

module.exports = analyzeImage;