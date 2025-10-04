// Test the Google Safe Browsing API connection
import { config } from '../config.js';

async function testSafeBrowsingAPI() {
    const testUrl = 'http://malware.testing.google.test/testing/malware/';
    const endpoint = `${config.API_ENDPOINTS.safeBrowsing}?key=${config.SAFE_BROWSING_API_KEY}`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client: {
                    clientId: "websafescore",
                    clientVersion: "1.0.0"
                },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: [{ url: testUrl }]
                }
            })
        });

        const data = await response.json();
        console.log('API Test Results:', {
            status: response.status,
            success: response.ok,
            data: data
        });

        return {
            success: response.ok,
            status: response.status,
            data: data
        };
    } catch (error) {
        console.error('API Test Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test
testSafeBrowsingAPI().then(result => {
    console.log('Safe Browsing API Test Complete');
    if (result.success) {
        console.log('✅ API connection successful');
        console.log('Response:', result.data);
    } else {
        console.log('❌ API connection failed');
        console.log('Error:', result.error);
    }
});