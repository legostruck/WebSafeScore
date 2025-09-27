// Website Safety Scanner - Content Script

// Content script to communicate with popup and analyze page content
class WebsiteAnalyzer {
    constructor() {
        this.url = window.location.href;
        this.hostname = window.location.hostname;
        this.init();
    }

    init() {
        // Send page info to background script
        this.sendPageInfo();
        
        // Set up message listener for popup communication
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'getPageInfo') {
                sendResponse({
                    url: this.url,
                    hostname: this.hostname,
                    title: document.title,
                    hasSSL: window.location.protocol === 'https:',
                    timestamp: Date.now()
                });
            }
        });
    }

    sendPageInfo() {
        try {
            chrome.runtime.sendMessage({
                action: 'pageLoaded',
                data: {
                    url: this.url,
                    hostname: this.hostname,
                    title: document.title,
                    hasSSL: window.location.protocol === 'https:',
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            console.log('Safety Scanner: Could not send page info:', error);
        }
    }

    analyzePageContent() {
        const analysis = {
            hasSSL: window.location.protocol === 'https:',
            hasFormsWithoutSSL: false,
            suspiciousLinks: 0,
            externalLinks: 0,
            hasPasswordFields: false
        };

        // Check for forms without SSL
        if (!analysis.hasSSL) {
            const forms = document.querySelectorAll('form');
            analysis.hasFormsWithoutSSL = forms.length > 0;
        }

        // Count external links and suspicious patterns
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.href;
            if (href && !href.startsWith(window.location.origin)) {
                analysis.externalLinks++;
                
                // Check for suspicious link patterns
                if (href.includes('bit.ly') || href.includes('tinyurl') || 
                    href.includes('urgent') || href.includes('verify-now')) {
                    analysis.suspiciousLinks++;
                }
            }
        });

        // Check for password fields
        const passwordFields = document.querySelectorAll('input[type="password"]');
        analysis.hasPasswordFields = passwordFields.length > 0;

        return analysis;
    }
}

// Initialize analyzer when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new WebsiteAnalyzer();
    });
} else {
    new WebsiteAnalyzer();
}