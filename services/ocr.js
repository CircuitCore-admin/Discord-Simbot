const Tesseract = require('tesseract.js');

async function extractTextFromImage(imageBuffer) {
  const result = await Tesseract.recognize(imageBuffer, 'eng');
  return result.data.text;
}

module.exports = { extractTextFromImage };