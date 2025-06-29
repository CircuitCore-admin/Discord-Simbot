const express = require('express');
const path = require('path'); // Make sure 'path' is imported
const cors = require('cors'); // Make sure 'cors' is imported (and installed!)

const app = express();
const port = process.env.WEB_PORT || 3000; // Use your desired port

// 1. Basic Middleware
app.use(cors());
app.use(express.json());

// 2. Mock API Endpoint (just to have one, to test order)
app.get('/api/test', (req, res) => {
    res.json({ message: "Test API endpoint reached!" });
});

// 3. Serve Static Files from React build
// Assuming 'leaderboard-frontend' is a sub-directory of 'Discord-Simbot'
const reactAppBuildPath = path.join(__dirname, 'leaderboard-frontend', 'dist');
console.log(`Serving static files from: ${reactAppBuildPath}`); // Check this path in console
app.use(express.static(reactAppBuildPath));

// 4. Fallback for React Client-Side Routing (THIS IS THE TROUBLEMAKER)
app.get('*', (req, res) => {
    const indexPath = path.join(reactAppBuildPath, 'index.html');
    console.log(`Attempting to serve index.html from: ${indexPath}`); // Check this path
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send('Failed to load application.');
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Test server running on http://localhost:${port}`);
});

// --- IMPORTANT: Ensure 'cors' and 'express' are installed ---
// In your Discord-Simbot directory, run:
// npm install express cors
// If you haven't already.