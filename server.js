import express from 'express';
import { google } from 'googleapis';
import cors from 'cors';
import open from 'open';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Use environment variables for credentials
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URIS } = process.env;

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URIS.split(',')[0] // Use the first redirect URI from the list
);

// Temporary in-memory storage for tokens
let tokens = { access_token: null, refresh_token: null };

// Generate authentication URL
app.get('/auth', (req, res) => {
    const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
    });
    open(url);
    res.send('Authentication initiated. Please check your browser.');
});

// OAuth2 callback route to exchange code for tokens
app.get('/oauth2callback', async (req, res) => {
    if (!req.query.code) {
        res.status(400).send('Authorization code not provided');
        return;
    }

    try {
        const { tokens: newTokens } = await oauth2Client.getToken(req.query.code);
        oauth2Client.setCredentials(newTokens);
        tokens = newTokens; // Store tokens in memory
        res.send('Authentication successful. You can close this window and return to the Figma plugin.');
    } catch (error) {
        console.error('Error exchanging code:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint to get the current access token
app.get('/token', (req, res) => {
    console.log('Origin:', req.headers.origin);
    if (tokens.access_token) {
        res.json({ token: tokens.access_token });
    } else {
        res.status(404).json({ error: 'Token not available' });
    }
});

// Endpoint to refresh the access token
app.get('/refresh', async (req, res) => {
    if (!tokens.refresh_token) {
        return res.status(404).json({ error: 'Refresh token not available' });
    }

    try {
        oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
        const { credentials: newTokens } = await oauth2Client.refreshToken(tokens.refresh_token);
        tokens = newTokens; // Update in-memory tokens
        res.json({ token: newTokens.access_token });
    } catch (error) {
        console.error('Error refreshing access token:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/', (req, res) => {
    res.send('Server working!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server working!`);
});
