// services/analyzeImage.js
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

module.exports = analyzeImage;