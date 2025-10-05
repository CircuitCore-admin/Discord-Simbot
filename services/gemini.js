// services/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // Make sure you have your .env file with GEMINI_API_KEY

// Initialize the Google Generative AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get the Generative Model instance
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash', // You can choose 'gemini-pro-vision' or other suitable models for images
  generationConfig: {
    temperature: 0.4,       // Controls randomness of the output
    maxOutputTokens: 512,   // Maximum number of tokens in the response
  },
});

// Export the model instance directly
module.exports = model;