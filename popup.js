// popup.js - Website Safety Scanner (updated with caching and runtime assertion)

class SafetyScanner {
    constructor() {
        this.currentUrl = '';
        this.currentHostname = '';
        // load shared presets when available (node/script env). Browser will fall back to built-in values.
        this._presets = null;
        try {
            // CommonJS preset module
            // eslint-disable-next-line global-require
            this._presets = require('./lib/presets.cjs');
        } catch (e) {
            try {
                // ESM import path (if running under import)
                // note: dynamic import may not be supported in some extension contexts
                // ignore failures and fall back to inline defaults
            } catch (err) { /* ignore */ }
        }
        this._weights = { ssl: 1, reputation: 1, domainPenaltyMultiplier: 1, urlPatternMultiplier: 1 };
        this.init();
    }

    async init() {
        await this.getCurrentTab();
        this.setupEventListeners();
        // restore persisted preset (if any) but don't trigger a rescan yet — init will run analysis
        try {
            const stored = await new Promise((resolve) => chrome.storage.local.get(['selectedPreset'], (res) => resolve(res)));
            const preset = (stored && stored.selectedPreset) || 'balanced';
            // apply weights without forcing a rescan or persisting again
            this.applyPreset(preset, { persist: false, triggerRescan: false });
            // mark the UI active button
            const currentPresetEl = document.getElementById('current-preset');
            if (currentPresetEl) currentPresetEl.textContent = preset.charAt(0).toUpperCase() + preset.slice(1);
            const setActiveId = preset === 'safe' ? 'preset-safe' : (preset === 'strict' ? 'preset-strict' : 'preset-balanced');
            const setActive = (id) => {
                const pSafe = document.getElementById('preset-safe');
                const pBalanced = document.getElementById('preset-balanced');
                const pStrict = document.getElementById('preset-strict');
                [pSafe, pBalanced, pStrict].forEach(b => { if (b) b.classList.remove('active'); });
                const el = document.getElementById(id);
                if (el) el.classList.add('active');
            };
            setActive(setActiveId);
        } catch (e) {
            // ignore restore errors
        }

        // perform initial analysis
        this.analyzeSafety();
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                this.currentUrl = tab.url;
                this.currentHostname = new URL(tab.url).hostname;
                const el = document.getElementById('current-url');
                if (el) el.textContent = this.currentHostname;
            }
        } catch (error) {
            console.error('Error getting current tab:', error);
            const el = document.getElementById('current-url');
            if (el) el.textContent = 'Unable to access';
        }
    }

    setupEventListeners() {
        const rescanBtn = document.getElementById('rescan-btn');
        if (rescanBtn) rescanBtn.addEventListener('click', () => this.analyzeSafety());
        const explainBtn = document.getElementById('explain-btn');
        if (explainBtn) explainBtn.addEventListener('click', () => this.toggleExplanation());
        // preset buttons
        const pSafe = document.getElementById('preset-safe');
        const pBalanced = document.getElementById('preset-balanced');
        const pStrict = document.getElementById('preset-strict');
        const currentPresetEl = document.getElementById('current-preset');
        const setActive = (id) => {
            [pSafe, pBalanced, pStrict].forEach(b => { if (b) b.classList.remove('active'); });
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        };
        if (pSafe) pSafe.addEventListener('click', () => { this.applyPreset('safe'); setActive('preset-safe'); if (currentPresetEl) currentPresetEl.textContent = 'Safe'; });
        if (pBalanced) pBalanced.addEventListener('click', () => { this.applyPreset('balanced'); setActive('preset-balanced'); if (currentPresetEl) currentPresetEl.textContent = 'Balanced'; });
        if (pStrict) pStrict.addEventListener('click', () => { this.applyPreset('strict'); setActive('preset-strict'); if (currentPresetEl) currentPresetEl.textContent = 'Strict'; });
    }

    async analyzeSafety(force = false) {
        this.showLoading();
        try {
            // if not forcing, try to use cached result
            let cached = null;
            if (!force) {
                cached = await this.getCachedResult();
            }
            if (cached && this.isCacheValid(cached)) {
                this.displayResults(cached);
                return;
            }

            // if force is true, show an explicit transient message
            if (force) {
                const statusText = document.getElementById('status-text');
                if (statusText) {
                    const messageEl = statusText.querySelector('.status-message');
                    if (messageEl) messageEl.textContent = `Re-scanning with preset...`;
                }
            }

            const result = await this.performSafetyCheck();

            // Runtime assertion / dev-check: warn if score is 100 but factors don't justify it
            if (result.score === 100) {
                const f = result.details || {};
                const strongPositive = f.ssl && f.reputation && f.domainAge && !f.blocklist;
                if (!strongPositive) console.warn('Runtime check: score==100 but factors are not all positive', result);
            }

            await this.cacheResult(result);
            this.displayResults(result);
        } catch (error) {
            console.error('Safety analysis error:', error);
            this.showError('Unable to analyze website safety');
        }
    }

    async getCachedResult() {
        try {
            if (!this.currentHostname) return null; // avoid reading a shared empty-key cache
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
            if (!this.currentHostname) return; // don't cache results without a hostname
            const cacheData = { [this.currentHostname]: { ...result, timestamp: Date.now() } };
            await chrome.storage.local.set(cacheData);
        } catch (error) {
            console.error('Error caching result:', error);
        }
    }

    async performSafetyCheck() {
        // Gather inputs
        const safetyFactors = await this.checkSafetyFactors();
        const domainReputation = await this.checkDomainReputation();
        const url = this.currentUrl || '';

        // Use testable scoring core (lib/score.cjs) when available.
        let core;
        try {
            core = await import('./lib/score.cjs');
        } catch (e) {
            // fall back to require for older extension environments
            try { core = require('./lib/score.cjs'); } catch (er) { core = null; }
        }

        // Build normalized inputs for core
        const factors = {
            ssl: !!safetyFactors.ssl,
            domainAge: !!safetyFactors.domainAge,
            // allow reputation to be numeric or boolean
            reputation: safetyFactors.reputation,
            blocklist: !!safetyFactors.blocklist
        };

        const domainRep = domainReputation || { penalties: 0, malware: false, phishing: false };

        let result;
        if (core && core.computeScoreFromFactors) {
            // core may be a namespace (import) or a module (require)
            const fn = core.computeScoreFromFactors || (core.default && core.default.computeScoreFromFactors) || core.default;
            try {
                result = fn(factors, domainRep, url, { ssl: this._weights.ssl, reputation: this._weights.reputation, domainPenaltyMultiplier: this._weights.domainPenaltyMultiplier, urlPatternMultiplier: this._weights.urlPatternMultiplier });
            } catch (err) {
                console.warn('Scoring core failed, falling back to local scoring', err);
                result = null;
            }
        }

        // If module import/require failed, try browser shim exposed on window
        if (!result && typeof window !== 'undefined' && typeof window.computeScoreFromFactors === 'function') {
            try {
                result = window.computeScoreFromFactors(factors, domainRep, url, { ssl: this._weights.ssl, reputation: this._weights.reputation, domainPenaltyMultiplier: this._weights.domainPenaltyMultiplier, urlPatternMultiplier: this._weights.urlPatternMultiplier });
            } catch (err) {
                console.warn('Browser scoring shim failed', err);
                result = null;
            }
        }

        // Fallback simpler scoring if the core failed
        if (!result) {
            let score = 50;
            if (factors.ssl) score += 20; else score -= 15;
            if (typeof factors.reputation === 'number') score += Math.round((factors.reputation - 0.5) * 20);
            else if (factors.reputation) score += 8; else score -= 6;
            if (factors.domainAge) score += 4;
            if (factors.blocklist) score -= 60;
            const urlLower = url.toLowerCase();
            if (urlLower.includes('phish') || urlLower.includes('malware') || urlLower.includes('verify')) score -= 30;
            score -= domainRep.penalties || 0;
            // build a simple fallback breakdown so the explanation panel has details
            const fb = [];
            fb.push({ key: 'ssl', delta: factors.ssl ? 20 : -15, note: factors.ssl ? 'HTTPS present' : 'No HTTPS' });
            fb.push({ key: 'reputation', delta: (typeof factors.reputation === 'number') ? Math.round((factors.reputation - 0.5) * 20) : (factors.reputation ? 8 : -6), note: 'Reputation (fallback)' });
            fb.push({ key: 'domainAge', delta: factors.domainAge ? 4 : 0, note: 'Domain age (fallback)' });
            if (factors.blocklist) fb.push({ key: 'blocklist', delta: -60, note: 'Blocklisted (fallback)' });
            if (urlLower.includes('phish') || urlLower.includes('malware') || urlLower.includes('verify')) fb.push({ key: 'urlPatterns', delta: -30, note: 'Suspicious URL pattern (fallback)' });
            if (domainRep.penalties) fb.push({ key: 'domain_penalties', delta: -domainRep.penalties, note: 'External penalties (fallback)' });
            const conf = Math.max(0, Math.min(100, 50 + (fb.filter(b => b.delta > 10).length - fb.filter(b => b.delta < -10).length) * 20));
            result = { score: Math.max(0, Math.min(100, score)), rawScore: score, breakdown: fb, confidence: conf };
        }

        // Normalize returned structure
        const threats = { malware: 'clean', phishing: 'clean', suspicious: 'clean' };
        if (domainReputation.malware) threats.malware = 'detected';
        if (domainReputation.phishing) threats.phishing = 'detected';
        if (safetyFactors.blocklist) threats.suspicious = 'detected';

        return {
            score: result.score || Math.max(0, Math.min(100, Math.round(result.rawScore || 0))),
            threats,
            lastScan: new Date().toLocaleString(),
            details: { ...safetyFactors, breakdown: result.breakdown || [] },
            domainReputation: domainRep,
            confidence: result.confidence || 50
        };
    }

    async checkSafetyFactors() {
        // Deterministic heuristics based on hostname to avoid random results during testing
        const hostname = this.currentHostname || '';
        const ssl = (this.currentUrl || '').startsWith('https://');
        // domainAge heuristic: domains with longer names are more likely new/throwaway
        const domainAge = hostname.length <= 20;
        // reputation heuristic: known good domains get true, others are judged by TLD length
        const knownGood = ['google.com','github.com','stackoverflow.com','mozilla.org','microsoft.com','apple.com','wikipedia.org','youtube.com','linkedin.com'];
        const reputation = knownGood.includes(hostname) || hostname.split('.').pop().length <= 3;
        // blocklist heuristic: suspicious keywords in hostname
        const blocklist = /phish|malware|fake|scam|fraud/.test(hostname);
        return { ssl, domainAge, reputation, blocklist };
    }

    async checkDomainReputation() {
        // Deterministic, lightweight reputation checks for demo/testing
        const knownSafeDomains = ['google.com','github.com','stackoverflow.com','mozilla.org','microsoft.com','apple.com','wikipedia.org','youtube.com','linkedin.com'];
        const knownDangerousDomains = ['example-phishing.com','fake-bank.com','malware-site.com'];
        let penalties = 0, malware = false, phishing = false;
        const host = this.currentHostname || '';
        if (knownSafeDomains.includes(host)) {
            penalties = 0;
        } else if (knownDangerousDomains.includes(host)) {
            penalties = 50; malware = true; phishing = true;
        } else {
            // Heuristic: suspicious TLDs or keywords increase penalties
            if (/\.(ru|cn|tk|ml|ga)$/i.test(host)) { penalties += 30; }
            if (/bank|login|secure|verify|account|update|pay|free|gift|temp-mail/.test(host)) { penalties += 20; }
            if (/phish|fraud|scam|malware|fake/.test(host)) { penalties += 40; malware = true; }
            // Normalize to a max penalty
            penalties = Math.min(penalties, 60);
            // crude phishing flag
            if (/verify|login|account|secure/.test(host)) phishing = true;
        }
        return { penalties, malware, phishing };
    }

    applyPreset(name) {
        // allow options: { persist: true/false, triggerRescan: true/false }
        const opts = (typeof arguments[1] === 'object' && arguments[1]) ? arguments[1] : { persist: true, triggerRescan: true };
        // presets adjust weights. Prefer shared presets module if available.
        if (this._presets && this._presets[name]) {
            this._weights = Object.assign({}, this._presets[name]);
        } else {
            // fallback inline presets
            if (name === 'safe') {
                this._weights = { ssl: 1.0, reputation: 0.6, domainPenaltyMultiplier: 0.6, urlPatternMultiplier: 0.6 };
            } else if (name === 'strict') {
                // strict mode (tuned): more conservative – lowers reputation contribution and increases penalties
                this._weights = { ssl: 0.85, reputation: 0.5, domainPenaltyMultiplier: 2.0, urlPatternMultiplier: 1.8 };
            } else { // balanced
                this._weights = { ssl: 1.0, reputation: 1.0, domainPenaltyMultiplier: 1.0, urlPatternMultiplier: 1.0 };
            }
        }

        // persist selection if requested
        if (opts.persist) {
            try { chrome.storage.local.set({ selectedPreset: name }); } catch (e) { /* ignore */ }
        }

        // update current preset UI text
        const currentPresetEl = document.getElementById('current-preset');
        if (currentPresetEl) currentPresetEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);

        // After changing weights, clear any cached result for this hostname so a rescan reflects new settings
        if (opts.triggerRescan) {
            try {
                if (this.currentHostname) {
                    // remove cached entry so next analyzeSafety will compute fresh result
                    chrome.storage.local.remove(this.currentHostname, () => {
                        // ignore errors; re-run analysis to apply preset immediately and bypass cache
                        setTimeout(() => this.analyzeSafety(true), 100);
                    });
                } else {
                    setTimeout(() => this.analyzeSafety(true), 100);
                }
            } catch (e) {
                setTimeout(() => this.analyzeSafety(true), 100);
            }
        }
    }

    showLoading() {
        const spinner = document.getElementById('loading-spinner');
        const status = document.getElementById('status-text');
        const details = document.getElementById('threat-details');
        const rescan = document.getElementById('rescan-btn');
        if (spinner) spinner.style.display = 'block';
        if (status) { status.textContent = 'Analyzing...'; status.className = 'status-text'; }
        if (details) details.style.display = 'none';
        if (rescan) rescan.disabled = true;
    }

    displayResults(result) {
        const { score, threats, lastScan } = result;
        const scoreNumber = document.getElementById('score-number');
        const lastScanEl = document.getElementById('last-scan');
        const scoreCircle = document.getElementById('score-circle');
        const statusText = document.getElementById('status-text');
        const scoreEmoji = document.getElementById('score-emoji');

        // Animate score number counting up with bouncy effect
        if (scoreNumber) {
            const startScore = parseInt(scoreNumber.textContent) || 0;
            const duration = 1500;
            const steps = 60;
            const increment = (score - startScore) / steps;
            let currentStep = 0;

            const easeOutBounce = (x) => {
                const n1 = 7.5625;
                const d1 = 2.75;
                if (x < 1 / d1) {
                    return n1 * x * x;
                } else if (x < 2 / d1) {
                    return n1 * (x -= 1.5 / d1) * x + 0.75;
                } else if (x < 2.5 / d1) {
                    return n1 * (x -= 2.25 / d1) * x + 0.9375;
                } else {
                    return n1 * (x -= 2.625 / d1) * x + 0.984375;
                }
            };

            const animateScore = () => {
                currentStep++;
                const progress = currentStep / steps;
                const easedProgress = easeOutBounce(progress);
                const currentScore = Math.round(startScore + (score - startScore) * easedProgress);
                scoreNumber.textContent = String(currentScore);

                if (currentStep < steps) {
                    requestAnimationFrame(animateScore);
                }
            };
            requestAnimationFrame(animateScore);
        }

        // Update emoji based on score
        if (scoreEmoji) {
            if (score >= 80) {
                scoreEmoji.textContent = '😊';
                scoreEmoji.title = 'Safe and sound!';
            } else if (score >= 60) {
                scoreEmoji.textContent = '🙂';
                scoreEmoji.title = 'Looking good';
            } else if (score >= 40) {
                scoreEmoji.textContent = '😐';
                scoreEmoji.title = 'Be careful';
            } else if (score >= 20) {
                scoreEmoji.textContent = '😟';
                scoreEmoji.title = 'Stay alert!';
            } else {
                scoreEmoji.textContent = '😨';
                scoreEmoji.title = 'Danger zone!';
            }
        }

        if (lastScanEl) lastScanEl.textContent = lastScan;
        if (scoreCircle) {
            scoreCircle.className = 'score-circle';
            // Add pulse animation on score update
            scoreCircle.style.animation = 'none';
            void scoreCircle.offsetWidth; // Trigger reflow
            scoreCircle.style.animation = 'pulse 0.5s ease-out';
        }

        if (statusText) {
            const messageEl = statusText.querySelector('.status-message');
            const iconEl = statusText.querySelector('.status-icon');
            
            if (score >= 80) {
                scoreCircle.classList.add('safe');
                if (iconEl) iconEl.innerHTML = '<i class="fas fa-check-circle"></i>';
                if (messageEl) messageEl.textContent = 'All good! This website is safe';
                statusText.className = 'status-text safe';
                this.addConfetti();
            } else if (score >= 50) {
                scoreCircle.classList.add('warning');
                if (iconEl) iconEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                if (messageEl) messageEl.textContent = 'Proceed with caution';
                statusText.className = 'status-text warning';
            } else {
                scoreCircle.classList.add('danger');
                if (iconEl) iconEl.innerHTML = '<i class="fas fa-times-circle"></i>';
                if (messageEl) messageEl.textContent = 'Warning! Unsafe website detected';
                statusText.className = 'status-text danger';
            }
        }
        
        // Add gentle pulse animation to score circle
        if (scoreCircle) {
            scoreCircle.style.animation = 'none';
            void scoreCircle.offsetWidth; // Trigger reflow
            scoreCircle.style.animation = 'pulse 0.5s ease-out, floatAnimation 3s ease-in-out infinite';
        }
        const malwareEl = document.getElementById('malware-status');
        const phishingEl = document.getElementById('phishing-status');
        const suspiciousEl = document.getElementById('suspicious-status');
        if (malwareEl) { malwareEl.textContent = threats.malware; malwareEl.className = `threat-value ${threats.malware}`; }
        if (phishingEl) { phishingEl.textContent = threats.phishing; phishingEl.className = `threat-value ${threats.phishing}`; }
        if (suspiciousEl) { suspiciousEl.textContent = threats.suspicious; suspiciousEl.className = `threat-value ${threats.suspicious}`; }
        const spinner = document.getElementById('loading-spinner');
        const details = document.getElementById('threat-details');
        const rescan = document.getElementById('rescan-btn');
        if (spinner) spinner.style.display = 'none';
        if (details) details.style.display = 'block';
        if (rescan) rescan.disabled = false;
        // Prepare explanation data (attach to object so toggle can read it)
        this._lastResult = result;
    // update confidence badge on main UI
    const confBadge = document.getElementById('confidence-badge');
    if (confBadge) confBadge.textContent = `Confidence: ${result.confidence != null ? result.confidence + '%' : '--'}`;
        // update visual gauge
        const gauge = document.getElementById('gauge-fg');
        const gaugeText = document.getElementById('gauge-text');
        if (gauge && gaugeText) {
            const conf = Math.max(0, Math.min(100, result.confidence || 0));
            // stroke-dasharray is 100,100; we set dashoffset inversely
            const offset = 100 - conf;
            gauge.setAttribute('stroke-dasharray', `${conf},100`);
            gaugeText.textContent = `${conf}%`;
        }
        // hide explanation panel after every run
        const panel = document.getElementById('explanation-panel');
        if (panel) panel.style.display = 'none';
    }

    toggleExplanation() {
        const panel = document.getElementById('explanation-panel');
        const list = document.getElementById('score-breakdown');
        if (!panel || !list) return;

        if (panel.style.display === 'block') {
            panel.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => { panel.style.display = 'none'; }, 300);
            return;
        }

        // populate breakdown using structured data from the last result
        list.innerHTML = '';
        const r = this._lastResult || { details: {}, threats: {}, score: '--', domainReputation: { penalties: 0 }, confidence: '--' };

        const confEl = document.getElementById('confidence-display');
        if (confEl) confEl.textContent = `Confidence: ${r.confidence != null ? r.confidence + '%' : '--'}`;

        const breakdown = (r.details && r.details.breakdown) || [];
        if (breakdown.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.innerHTML = `<span class="item-key">No detailed breakdown available</span><span class="item-val neutral">--</span>`;
            list.appendChild(li);
        } else {
            breakdown.forEach((b) => {
                const li = document.createElement('li');
                li.className = 'list-item';
                const sign = b.delta > 0 ? '+' : '';
                const valueText = `${sign}${b.delta}`;
                const colorClass = b.delta > 0 ? 'positive' : (b.delta < 0 ? 'negative' : 'neutral');
                li.innerHTML = `<span class="item-key">${b.note || b.key}</span><span class="item-val ${colorClass}">${valueText}</span>`;
                list.appendChild(li);
            });
        }

        // append final score as last item
        const finalLi = document.createElement('li');
        finalLi.className = 'list-item';
        finalLi.innerHTML = `<span class="item-key">Final Score</span><span class="item-val ${r.score >= 80 ? 'positive' : (r.score >= 50 ? 'neutral' : 'negative')}">${r.score}</span>`;
        list.appendChild(finalLi);
        panel.style.display = 'block';
    }

    showError(message) {
        const spinner = document.getElementById('loading-spinner');
        const status = document.getElementById('status-text');
        const rescan = document.getElementById('rescan-btn');
        if (spinner) spinner.style.display = 'none';
        if (status) { 
            const messageEl = status.querySelector('.status-message');
            const iconEl = status.querySelector('.status-icon');
            if (iconEl) iconEl.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            if (messageEl) messageEl.textContent = message;
            status.className = 'status-text danger'; 
        }
        if (rescan) rescan.disabled = false;
    }

    addConfetti() {
        const colors = ['#a5b4fc', '#c4b5fd', '#86efac', '#fde68a'];
        const confettiCount = 50;
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            confetti.style.animationDelay = (Math.random() * 2) + 's';
            container.appendChild(confetti);
        }

        setTimeout(() => container.remove(), 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const scanner = new SafetyScanner();
    
    // Add hover effect to score circle
    const scoreCircle = document.getElementById('score-circle');
    if (scoreCircle) {
        scoreCircle.addEventListener('mouseenter', () => {
            scoreCircle.style.transform = 'scale(1.05) translateY(-5px)';
        });
        scoreCircle.addEventListener('mouseleave', () => {
            scoreCircle.style.transform = 'none';
        });
    }
});