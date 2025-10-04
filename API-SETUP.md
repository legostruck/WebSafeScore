# Setting up API Keys for WebSafeScore

To enable the full security checking capabilities of WebSafeScore, you'll need to set up API keys for the following services:

## 1. Google Safe Browsing API
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Safe Browsing API
4. Create credentials (API key)
5. Copy the API key and paste it in `config.js` as `SAFE_BROWSING_API_KEY`

## 2. VirusTotal API
1. Sign up for a [VirusTotal account](https://www.virustotal.com/gui/join-us)
2. Get your API key from your profile settings
3. Copy the API key and paste it in `config.js` as `VIRUSTOTAL_API_KEY`

## 3. WhoAPI
1. Sign up for a [WhoAPI account](https://whoapi.com/)
2. Get your API key from the dashboard
3. Copy the API key and paste it in `config.js` as `WHOAPI_API_KEY`

## Configuration

1. Open `config.js` in the root directory
2. Replace the placeholder API keys with your actual keys:
```javascript
export const config = {
    SAFE_BROWSING_API_KEY: 'your-google-api-key',
    VIRUSTOTAL_API_KEY: 'your-virustotal-api-key',
    WHOAPI_API_KEY: 'your-whoapi-key'
};
```

## Security Notes

- Never commit API keys to version control
- Consider using environment variables in production
- Monitor API usage to stay within free tier limits
- Implement rate limiting to avoid excessive API calls

## Testing

After setting up the API keys:

1. Load the extension in Chrome
2. Visit different types of websites
3. Check that the security scores are being calculated
4. Verify that threat detection is working
5. Monitor the console for any API errors

## API Usage Limits

- Google Safe Browsing: 10,000 requests per day (free tier)
- VirusTotal: 4 requests per minute (public API)
- WhoAPI: Varies by subscription level

Monitor your usage to avoid hitting rate limits.