import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Enable CORS for Chrome extension
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Serve extension files statically
app.use(express.static(__dirname));

// Root endpoint with extension info
app.get('/', (req, res) => {
    res.send(`
        <h1>Website Safety Scanner - Chrome Extension</h1>
        <p>Development server running on port ${PORT}</p>
        <h2>Extension Files:</h2>
        <ul>
            <li><a href="/manifest.json">manifest.json</a> - Extension manifest</li>
            <li><a href="/popup.html">popup.html</a> - Extension popup</li>
            <li><a href="/popup.js">popup.js</a> - Popup script</li>
            <li><a href="/popup.css">popup.css</a> - Popup styles</li>
            <li><a href="/content.js">content.js</a> - Content script</li>
            <li><a href="/background.js">background.js</a> - Background script</li>
        </ul>
        <h2>How to install:</h2>
        <ol>
            <li>Open Chrome and go to chrome://extensions/</li>
            <li>Enable "Developer mode" in the top right</li>
            <li>Click "Load unpacked" and select this directory</li>
            <li>The extension should now appear in your browser</li>
        </ol>
    `);
});

// API endpoint for safety checks (for future use)
app.get('/api/safety/:domain', (req, res) => {
    const { domain } = req.params;
    res.json({
        domain,
        score: Math.floor(Math.random() * 100),
        status: 'success',
        timestamp: Date.now()
    });
});

// Reputation proxy endpoint - returns deterministic mock when no API key provided
app.get('/api/reputation/:domain', async (req, res) => {
    const { domain } = req.params;
    const apiKey = process.env.REPUTATION_API_KEY;
    if (!apiKey) {
        // Deterministic mock: keywords increase penalties
        let penalties = 0, malware = false, phishing = false;
        if (/phish|fraud|scam|malware|fake/.test(domain)) { penalties += 50; malware = true; }
        if (/verify|login|account|secure/.test(domain)) { penalties += 20; phishing = true; }
        penalties = Math.min(penalties, 60);
        return res.json({ domain, penalties, malware, phishing, source: 'mock' });
    }

    // Placeholder for real provider forwarding: implement server-side request to provider here.
    // Keep keys on server; do not expose to the client.
    return res.json({ domain, penalties: 0, malware: false, phishing: false, source: 'stub' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Website Safety Scanner server running at http://0.0.0.0:${PORT}`);
    console.log(`📁 Serving Chrome extension files from: ${__dirname}`);
    console.log(`🔧 To install extension: Load unpacked extension from this directory`);
});