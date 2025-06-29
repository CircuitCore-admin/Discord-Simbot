// services/analyzeImage.js
const axios = require('axios');
const model = require('./gemini'); // Path from services/analyzeImage.js to services/gemini.js

async function analyzeImage(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBase64 = Buffer.from(response.data).toString('base64');

        // *** UPDATED PROMPT FOR TRACK LOCATION EXTRACTION ***
        const prompt = `You are an F1 game leaderboard analysis AI. Your task is to process a single screenshot and extract specific data in JSON format. You MUST follow these instructions precisely.

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
    * **If the screenshot is INCOMPLETE, you MUST IMMEDIATELY and ONLY output this EXACT JSON string:**
        \`\`\`json
        {"status": "incomplete", "message": "Hotlap Submission Denied: Incomplete picture"}
        \`\`\`
        *AND YOU MUST STOP ALL FURTHER ANALYSIS.*

**===== PHASE 2: LAP DATA EXTRACTION (ONLY IF SCREENSHOT IS COMPLETE) =====**

* **If and ONLY if you have confidently determined the screenshot is COMPLETE (all required elements from PHASE 1 are clearly visible), then proceed with data extraction.**
* **Extract the Track Location Name:** Locate the text at the top-left (e.g., "BELGIUM - TIME TRIAL"). **ONLY extract the main track name portion, excluding any suffixes like " - TIME TRIAL" or " - QUALIFYING". For example, if it says "BELGIUM - TIME TRIAL", extract "BELGIUM". If it says "SAUDI ARABIA - TIME TRIAL", extract "SAUDI ARABIA".**
* **Identify the TOP-MOST DISPLAYED LAP TIME:**
    * Locate the section clearly titled "FASTEST LAP".
    * Find the very first (top-most) row of data under this section.
    * From *only this top row*, extract:
        * **Driver Name:** The text under the "DRIVER" column.
        * **Team Name:** The text under the "TEAM" column.
        * **Lap Time:** The full lap time under the "TIME" column (e.g., "1:49.631").
        * **S1 Time:** The time under the "S1" column.
        * **S2 Time:** The time under the "S2" column.
        * **S3 Time:** The time under the "S3" column.
        * **Custom Setup:** "Yes" or "No" under "CUSTOM SETUP".
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

**===== YOUR FINAL RESPONSE (CRITICAL - Output ONLY one of these two EXACT JSON formats. NO other text, NO explanations, NO deviations) =====**

**If the screenshot is INCOMPLETE (based on PHASE 1 failure):**
\`\`\`json
{"status": "incomplete", "message": "Hotlap Submission Denied: Incomplete picture"}
\`\`\`

**If the screenshot is COMPLETE (based on PHASE 1 success):**
\`\`\`json
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
\`\`\`
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

module.exports = analyzeImage;