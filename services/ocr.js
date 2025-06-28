const Tesseract = require('tesseract.js');

async function extractTextFromImage(imageBuffer) {
  const { data: { text } } = await Tesseract.recognize(
    imageBuffer,
    'eng',
    {
      logger: m => console.log(m), // Optional: shows progress
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // Forces single text block
      tessedit_char_whitelist: '0123456789:.-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ', // Clean OCR
    }
  );
  return text;
}

module.exports = { extractTextFromImage };
