// Website Safety Scanner - Background Service Worker

class SafetyBackground {
    constructor() {
        this.init();
    }

    init() {
        // Listen for messages from content scripts and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Listen for tab updates to analyze new pages
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.analyzeTabSafety(tab);
            }
        });

        // Listen for installation/startup
        chrome.runtime.onInstalled.addListener(() => {
            console.log('Website Safety Scanner installed');
        });
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'pageLoaded':
                await this.handlePageLoaded(message.data, sender);
                sendResponse({ status: 'success' });
                break;
            case 'getSafetyData':
                const safetyData = await this.getSafetyData(message.hostname);
                sendResponse(safetyData);
                break;
            case 'performSafetyCheck':
                const result = await this.performSafetyCheck(message.hostname);
                sendResponse(result);
                break;
        }
    }

    async handlePageLoaded(pageData, sender) {
        try {
            const securityChecker = new SecurityChecker();
            const securityResults = await securityChecker.checkAllSecurity(pageData.url);
            
            // Store security results along with page data
            await chrome.storage.local.set({
                [`page_${sender.tab.id}`]: {
                    ...pageData,
                    security: securityResults
                }
            });

            // Update badge with safety status if needed
            const safetyScore = await this.quickSafetyCheck(pageData.hostname);
            this.updateBadge(sender.tab.id, safetyScore);
        } catch (error) {
            console.error('Error handling page loaded:', error);
        }
    }

    async analyzeTabSafety(tab) {
        try {
            const hostname = new URL(tab.url).hostname;
            const safetyScore = await this.quickSafetyCheck(hostname);
            this.updateBadge(tab.id, safetyScore);
        } catch (error) {
            console.log('Could not analyze tab safety:', error);
        }
    }

    async quickSafetyCheck(hostname) {
        // Check cache first
        try {
            const cached = await chrome.storage.local.get([hostname]);
            if (cached[hostname] && this.isCacheValid(cached[hostname])) {
                return cached[hostname].score;
            }
        } catch (error) {
            console.error('Error checking cache:', error);
        }

        try {
            const securityChecker = new SecurityChecker();
            const url = `https://${hostname}`;
            const results = await securityChecker.checkAllSecurity(url);
            
            if (results) {
                // Cache the results
                await chrome.storage.local.set({
                    [hostname]: {
                        score: results.score,
                        timestamp: Date.now(),
                        security: results
                    }
                });
                return results.score;
            }
        } catch (error) {
            console.error('Security check error:', error);
        }

        // Return neutral score if checks fail
        return 75;
    }

    isCacheValid(cached) {
        if (!cached || !cached.timestamp) return false;
        const now = Date.now();
        const cacheAge = now - cached.timestamp;
        return cacheAge < (15 * 60 * 1000); // 15 minutes
    }

    updateBadge(tabId, score) {
        try {
            let badgeText = '';
            let badgeColor = '#28a745'; // Green

            if (score < 50) {
                badgeText = '!';
                badgeColor = '#dc3545'; // Red
            } else if (score < 80) {
                badgeText = '?';
                badgeColor = '#ffc107'; // Yellow
            }

            chrome.action.setBadgeText({
                text: badgeText,
                tabId: tabId
            });

            chrome.action.setBadgeBackgroundColor({
                color: badgeColor,
                tabId: tabId
            });
        } catch (error) {
            console.log('Could not update badge:', error);
        }
    }

    async getSafetyData(hostname) {
        try {
            const result = await chrome.storage.local.get([hostname]);
            return result[hostname] || null;
        } catch (error) {
            console.error('Error getting safety data:', error);
            return null;
        }
    }

    async performSafetyCheck(hostname) {
        // This would integrate with actual security APIs in production
        // For now, using simulated analysis
        return {
            score: Math.floor(Math.random() * 100),
            threats: {
                malware: Math.random() > 0.9 ? 'detected' : 'clean',
                phishing: Math.random() > 0.95 ? 'detected' : 'clean',
                suspicious: Math.random() > 0.8 ? 'detected' : 'clean'
            },
            timestamp: Date.now()
        };
    }
}

// Initialize background service
new SafetyBackground();