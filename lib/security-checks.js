import { config } from '../config.js';

// Security checks integration module
class SecurityChecker {
    constructor() {
        // Load configuration
        this.config = config;
    }

    async checkAllSecurity(url) {
        try {
            const [sslCheck, safeBrowsing, domainRep, secHeaders] = await Promise.all([
                this.checkSSL(url),
                this.checkSafeBrowsing(url),
                this.checkDomainReputation(url),
                this.checkSecurityHeaders(url)
            ]);

            return {
                ssl: sslCheck,
                safeBrowsing,
                domainReputation: domainRep,
                securityHeaders: secHeaders,
                score: this.calculateSecurityScore({
                    ssl: sslCheck,
                    safeBrowsing,
                    domainReputation: domainRep,
                    securityHeaders: secHeaders
                })
            };
        } catch (error) {
            console.error('Security check error:', error);
            return null;
        }
    }

    async checkSSL(url) {
        try {
            const response = await fetch(url);
            const protocol = new URL(url).protocol;
            const isSSL = protocol === 'https:';
            
            // Check certificate info from response headers
            const securityInfo = {
                isSecure: isSSL,
                protocol: response.headers.get('sec-ch-ua'),
                certificateValid: response.headers.get('strict-transport-security') !== null
            };

            return securityInfo;
        } catch (error) {
            console.error('SSL check error:', error);
            return { isSecure: false, error: error.message };
        }
    }

    async checkSafeBrowsing(url) {
        try {
            // Google Safe Browsing API v4
            const endpoint = `${this.config.API_ENDPOINTS.safeBrowsing}?key=${this.config.SAFE_BROWSING_API_KEY}`;
            const data = {
                client: {
                    clientId: "websafescore",
                    clientVersion: "1.0.0"
                },
                threatInfo: {
                    threatTypes: [
                        "MALWARE",
                        "SOCIAL_ENGINEERING",
                        "UNWANTED_SOFTWARE",
                        "POTENTIALLY_HARMFUL_APPLICATION",
                        "THREAT_TYPE_UNSPECIFIED"
                    ],
                    platformTypes: ["WINDOWS", "LINUX", "ANDROID", "OSX", "IOS", "ANY_PLATFORM"],
                    threatEntryTypes: ["URL", "EXECUTABLE"],
                    threatEntries: [{ url: url }]
                }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            const result = await response.json();
            return {
                isSafe: !result.matches || result.matches.length === 0,
                threats: result.matches || []
            };
        } catch (error) {
            console.error('Safe Browsing check error:', error);
            return { isSafe: null, error: error.message };
        }
    }

    async checkDomainReputation(url) {
        try {
            const hostname = new URL(url).hostname;
            
            // Check VirusTotal first
            const vtResponse = await fetch(`${this.config.API_ENDPOINTS.virusTotal}?apikey=${this.config.VIRUSTOTAL_API_KEY}&resource=${url}`);
            const vtData = await vtResponse.json();
            
            // Check domain age and registration info from WhoAPI
            const whoResponse = await fetch(`${this.config.API_ENDPOINTS.whoApi}?domain=${hostname}&apikey=${this.config.WHOAPI_API_KEY}`);
            const whoData = await whoResponse.json();
            
            // Calculate reputation score based on both services
            const vtScore = vtData.positives ? (100 - (vtData.positives / vtData.total) * 100) : 100;
            const domainAge = whoData.date_created ? this.calculateDomainAgeScore(whoData.date_created) : 50;
            
            return {
                score: Math.round((vtScore + domainAge) / 2),
                categories: {
                    virusTotal: {
                        positives: vtData.positives || 0,
                        total: vtData.total || 0,
                        scanDate: vtData.scan_date
                    },
                    domainInfo: {
                        created: whoData.date_created,
                        expires: whoData.date_expires,
                        registrar: whoData.registrar
                    }
                },
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Domain reputation check error:', error);
            return { score: null, error: error.message };
        }
    }
    
    calculateDomainAgeScore(creationDate) {
        const ageInDays = (new Date() - new Date(creationDate)) / (1000 * 60 * 60 * 24);
        // Domains older than 1 year get higher scores
        if (ageInDays > 365) return 100;
        // Domains older than 6 months get medium scores
        if (ageInDays > 180) return 75;
        // Domains older than 3 months get lower medium scores
        if (ageInDays > 90) return 50;
        // New domains get lower scores
        return 25;
    }

    async checkSecurityHeaders(url) {
        try {
            const response = await fetch(url);
            const headers = response.headers;
            
            // Check important security headers
            const securityHeaders = {
                'Content-Security-Policy': headers.get('content-security-policy'),
                'X-Content-Type-Options': headers.get('x-content-type-options'),
                'X-Frame-Options': headers.get('x-frame-options'),
                'X-XSS-Protection': headers.get('x-xss-protection'),
                'Strict-Transport-Security': headers.get('strict-transport-security')
            };

            // Score the headers implementation
            const headerScore = Object.values(securityHeaders).filter(Boolean).length / Object.keys(securityHeaders).length * 100;

            return {
                headers: securityHeaders,
                score: headerScore
            };
        } catch (error) {
            console.error('Security headers check error:', error);
            return { score: 0, error: error.message };
        }
    }

    calculateSecurityScore(checks) {
        // Weight factors for different security aspects
        const weights = {
            ssl: 0.3,
            safeBrowsing: 0.3,
            domainReputation: 0.2,
            securityHeaders: 0.2
        };

        let score = 0;

        // SSL check contribution
        if (checks.ssl && checks.ssl.isSecure) {
            score += 100 * weights.ssl;
        }

        // Safe Browsing contribution
        if (checks.safeBrowsing && checks.safeBrowsing.isSafe) {
            score += 100 * weights.safeBrowsing;
        }

        // Domain reputation contribution
        if (checks.domainReputation && checks.domainReputation.score) {
            score += checks.domainReputation.score * weights.domainReputation;
        }

        // Security headers contribution
        if (checks.securityHeaders && checks.securityHeaders.score) {
            score += checks.securityHeaders.score * weights.securityHeaders;
        }

        return Math.round(score);
    }
}

export default SecurityChecker;