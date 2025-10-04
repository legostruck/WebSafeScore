// Configuration for security services
export const config = {
    // Google Safe Browsing API
    SAFE_BROWSING_API_KEY: 'AIzaSyDG2Z4SPQAH3c2kgap9QNXcp4ubKX5cn4k',

    // Example Domain Reputation Services
    // 1. VirusTotal - Get key from: https://www.virustotal.com/gui/join-us
    VIRUSTOTAL_API_KEY: 'YOUR_VIRUSTOTAL_API_KEY',

    // 2. WhoAPI (for domain age and registration info) - Get key from: https://whoapi.com/
    WHOAPI_API_KEY: 'YOUR_WHOAPI_API_KEY',

    // Update API endpoints
    API_ENDPOINTS: {
        safeBrowsing: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
        virusTotal: 'https://www.virustotal.com/vtapi/v2/url/report',
        whoApi: 'https://api.whoapi.com/'
    },

    // Cache settings
    CACHE_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
    
    // Scoring weights
    WEIGHTS: {
        ssl: 0.25,
        safeBrowsing: 0.30,
        domainReputation: 0.25,
        securityHeaders: 0.20
    }
};