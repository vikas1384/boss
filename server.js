// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8000;

// Serve static files
app.use(express.static(__dirname));

// API keys middleware
app.get('/api/keys', (req, res) => {
  // Only provide keys in a secure way
  // In production, you should implement proper authentication
  res.json({
    groq: process.env.GROQ_API_KEY || '',
    perplexity: process.env.PERPLEXITY_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || ''
  });
});

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});