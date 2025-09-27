// Website Safety Scanner - Popup Script

class SafetyScanner {
    constructor() {
        this.currentUrl = '';
        this.currentHostname = '';
        this.init();
    }

    async init() {
        await this.getCurrentTab();
        this.setupEventListeners();
        this.analyzeSafety();
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                this.currentUrl = tab.url;
                this.currentHostname = new URL(tab.url).hostname;
                document.getElementById('current-url').textContent = this.currentHostname;
            }
        } catch (error) {
            console.error('Error getting current tab:', error);
            document.getElementById('current-url').textContent = 'Unable to access';
        }
    }

    setupEventListeners() {
        const rescanBtn = document.getElementById('rescan-btn');
        rescanBtn.addEventListener('click', () => {
            this.analyzeSafety();
        });
    }

    async analyzeSafety() {
        this.showLoading();
        
        try {
            // Check if we have cached results
            const cached = await this.getCachedResult();
            if (cached && this.isCacheValid(cached)) {
                this.displayResults(cached);
                return;
            }

            // Perform safety analysis
            const result = await this.performSafetyCheck();
            await this.cacheResult(result);
            this.displayResults(result);
        } catch (error) {
            console.error('Safety analysis error:', error);
            this.showError('Unable to analyze website safety');
        }
    }

    async getCachedResult() {
        try {
            const result = await chrome.storage.local.get([this.currentHostname]);
            return result[this.currentHostname];
        } catch (error) {
            console.error('Error getting cached result:', error);
            return null;
        }
    }

    isCacheValid(cached) {
        if (!cached || !cached.timestamp) return false;
        const now = Date.now();
        const cacheAge = now - cached.timestamp;
        return cacheAge < (15 * 60 * 1000); // 15 minutes
    }

    async cacheResult(result) {
        try {
            const cacheData = {
                [this.currentHostname]: {
                    ...result,
                    timestamp: Date.now()
                }
            };
            await chrome.storage.local.set(cacheData);
        } catch (error) {
            console.error('Error caching result:', error);
        }
    }

    async performSafetyCheck() {
        // Simulate safety check with multiple factors
        const safetyFactors = await this.checkSafetyFactors();
        
        let score = 100;
        let threats = {
            malware: 'clean',
            phishing: 'clean',
            suspicious: 'clean'
        };

        // Check against known dangerous patterns
        const dangerousPatterns = [
            'phishing', 'malware', 'suspicious', 'unsafe',
            'temp-mail', 'click-here', 'urgent', 'verify-account'
        ];

        const urlLower = this.currentUrl.toLowerCase();
        dangerousPatterns.forEach(pattern => {
            if (urlLower.includes(pattern)) {
                score -= 30;
                threats.suspicious = 'detected';
            }
        });

        // Check domain reputation (simplified)
        const domainReputation = await this.checkDomainReputation();
        score -= domainReputation.penalties;
        
        if (domainReputation.malware) threats.malware = 'detected';
        if (domainReputation.phishing) threats.phishing = 'detected';

        return {
            score: Math.max(0, Math.min(100, score)),
            threats,
            lastScan: new Date().toLocaleString(),
            details: safetyFactors
        };
    }

    async checkSafetyFactors() {
        // In a real implementation, this would call actual security APIs
        return {
            ssl: this.currentUrl.startsWith('https://'),
            domainAge: Math.random() > 0.3, // Simulated
            reputation: Math.random() > 0.2, // Simulated
            blocklist: Math.random() > 0.9 // Simulated
        };
    }

    async checkDomainReputation() {
        // Simplified domain reputation check
        const knownSafeDomains = [
            'google.com', 'github.com', 'stackoverflow.com',
            'mozilla.org', 'microsoft.com', 'apple.com',
            'wikipedia.org', 'youtube.com', 'linkedin.com'
        ];

        const knownDangerousDomains = [
            'example-phishing.com', 'fake-bank.com', 'malware-site.com'
        ];

        let penalties = 0;
        let malware = false;
        let phishing = false;

        if (knownSafeDomains.includes(this.currentHostname)) {
            penalties = 0;
        } else if (knownDangerousDomains.includes(this.currentHostname)) {
            penalties = 50;
            malware = true;
            phishing = true;
        } else {
            // Random assessment for unknown domains
            const risk = Math.random();
            if (risk > 0.8) {
                penalties = 20;
                phishing = true;
            } else if (risk > 0.9) {
                penalties = 40;
                malware = true;
            }
        }

        return { penalties, malware, phishing };
    }

    showLoading() {
        document.getElementById('loading-spinner').style.display = 'block';
        document.getElementById('status-text').textContent = 'Analyzing...';
        document.getElementById('threat-details').style.display = 'none';
        document.getElementById('rescan-btn').disabled = true;
    }

    displayResults(result) {
        const { score, threats, lastScan } = result;
        
        // Update score display
        document.getElementById('score-number').textContent = score;
        document.getElementById('last-scan').textContent = lastScan;
        
        // Update score circle appearance
        const scoreCircle = document.getElementById('score-circle');
        const statusText = document.getElementById('status-text');
        
        scoreCircle.className = 'score-circle';
        if (score >= 80) {
            scoreCircle.classList.add('safe');
            statusText.textContent = 'Safe Website';
            statusText.className = 'status-text safe';
        } else if (score >= 50) {
            scoreCircle.classList.add('warning');
            statusText.textContent = 'Potentially Risky';
            statusText.className = 'status-text warning';
        } else {
            scoreCircle.classList.add('danger');
            statusText.textContent = 'Dangerous Website';
            statusText.className = 'status-text danger';
        }

        // Update threat details
        document.getElementById('malware-status').textContent = threats.malware;
        document.getElementById('malware-status').className = `threat-value ${threats.malware}`;
        
        document.getElementById('phishing-status').textContent = threats.phishing;
        document.getElementById('phishing-status').className = `threat-value ${threats.phishing}`;
        
        document.getElementById('suspicious-status').textContent = threats.suspicious;
        document.getElementById('suspicious-status').className = `threat-value ${threats.suspicious}`;

        // Show results
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('threat-details').style.display = 'block';
        document.getElementById('rescan-btn').disabled = false;
    }

    showError(message) {
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('status-text').textContent = message;
        document.getElementById('status-text').className = 'status-text danger';
        document.getElementById('rescan-btn').disabled = false;
    }
}

// Initialize the scanner when the popup opens
document.addEventListener('DOMContentLoaded', () => {
    new SafetyScanner();
});