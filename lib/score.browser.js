// Browser-friendly scoring wrapper — exposes computeScoreFromFactors on window for popup use
(function(){
  function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

  function computeScoreFromFactors(factors = {}, domainReputation = { penalties: 0, malware: false, phishing: false }, url = '', weights = {}) {
    const breakdown = [];
    let raw = 55;
    if (typeof domainReputation === 'number') {
      domainReputation = { penalties: domainReputation, malware: false, phishing: false };
    }

    const sslWeight = typeof weights.ssl === 'number' ? weights.ssl : 1;
    if (factors.ssl) { const delta = Math.round(20 * sslWeight); raw += delta; breakdown.push({ key: 'ssl', delta, note: 'HTTPS present' }); }
    else { const delta = Math.round(-12 * sslWeight); raw += delta; breakdown.push({ key: 'ssl', delta, note: 'No HTTPS' }); }

    const repWeight = typeof weights.reputation === 'number' ? weights.reputation : 1;
    if (typeof factors.reputation === 'number') {
      const repDeltaBase = Math.round((factors.reputation * 30) - 12);
      const repDelta = Math.round(repDeltaBase * repWeight);
      raw += repDelta; breakdown.push({ key: 'reputation', delta: repDelta, note: 'Reputation score' });
    } else if (factors.reputation) { const delta = Math.round(8 * repWeight); raw += delta; breakdown.push({ key: 'reputation', delta, note: 'Good reputation (boolean)' }); }
    else { const delta = Math.round(-6 * repWeight); raw += delta; breakdown.push({ key: 'reputation', delta, note: 'Poor reputation' }); }

    const ageWeight = typeof weights.domainAge === 'number' ? weights.domainAge : 1;
    if (factors.domainAge) { const delta = Math.round(6 * ageWeight); raw += delta; breakdown.push({ key: 'domainAge', delta, note: 'Established domain' }); }
    else { breakdown.push({ key: 'domainAge', delta: 0, note: 'Unknown/new domain' }); }

    const blocklistWeight = typeof weights.blocklist === 'number' ? weights.blocklist : 1;
    if (factors.blocklist) { const delta = Math.round(-40 * blocklistWeight); raw += delta; breakdown.push({ key: 'blocklist', delta, note: 'Listed on blocklist' }); }

    const urlLower = (url || '').toLowerCase();
    let pathAndQuery = '';
    let hostnamePart = '';
    try { const u = new URL(url); pathAndQuery = (u.pathname || '') + (u.search || ''); hostnamePart = u.hostname || ''; } catch (e) { pathAndQuery = urlLower; hostnamePart = urlLower; }
    pathAndQuery = pathAndQuery.toLowerCase();
    hostnamePart = hostnamePart.toLowerCase();

    const suspiciousPatterns = ['phish','phishing','malware','verify','login','account','free','gift','temp-mail','urgent','click','confirm','update','secure'];
    let patternPenalty = 0;
    const urlPatternWeight = typeof weights.urlPatternMultiplier === 'number' ? weights.urlPatternMultiplier : 1;
    suspiciousPatterns.forEach((p) => { if (pathAndQuery.includes(p) || hostnamePart.includes(p)) patternPenalty += Math.round(12 * urlPatternWeight); });
    if (patternPenalty > 0) { patternPenalty = Math.min(patternPenalty, 36); raw -= patternPenalty; breakdown.push({ key: 'urlPatterns', delta: -patternPenalty, note: 'Suspicious URL path or query tokens' }); }

    try {
      const u2 = new URL(url);
      const paramsCount = Array.from(u2.searchParams.keys()).length;
      if (paramsCount >= 4) { raw -= 6; breakdown.push({ key: 'url_params', delta: -6, note: 'Many URL query parameters' }); }
      if ((u2.search || '').length > 150) { raw -= 8; breakdown.push({ key: 'url_query_length', delta: -8, note: 'Long query string' }); }
    } catch (e) {}

    if (domainReputation && typeof domainReputation === 'object') {
      const domainPenaltyMultiplier = typeof weights.domainPenaltyMultiplier === 'number' ? weights.domainPenaltyMultiplier : 1;
      if (domainReputation.malware) { const delta = Math.round(-60 * domainPenaltyMultiplier); raw += delta; breakdown.push({ key: 'domain_malware', delta, note: 'Known malware distributor' }); }
      if (domainReputation.phishing) { const delta = Math.round(-60 * domainPenaltyMultiplier); raw += delta; breakdown.push({ key: 'domain_phishing', delta, note: 'Known phishing domain' }); }
      if (domainReputation.penalties && domainReputation.penalties > 0) {
        const mapped = Math.round(Math.log1p(domainReputation.penalties) * 10);
        const pen = Math.min(Math.round(mapped * domainPenaltyMultiplier), 40);
        raw -= pen; breakdown.push({ key: 'domain_penalties', delta: -pen, note: 'External reputation penalties' });
      }
    }

    const strongPos = breakdown.filter(b => b.delta >= 12).length;
    const strongNeg = breakdown.filter(b => b.delta <= -12).length;
    const moderatePos = breakdown.filter(b => b.delta > 0 && b.delta < 12).length;
    const moderateNeg = breakdown.filter(b => b.delta < 0 && b.delta > -12).length;
    let confidence = 50 + (strongPos - strongNeg) * 15 + (moderatePos - moderateNeg) * 6;
    if (domainReputation && domainReputation.malware) confidence -= 10;
    if (domainReputation && domainReputation.phishing) confidence -= 10;
    confidence = Math.max(0, Math.min(100, Math.round(confidence)));

    const final = clamp(raw);
    return { score: final, rawScore: raw, breakdown, confidence };
  }

  // expose
  if (typeof window !== 'undefined') {
    window.computeScoreFromFactors = computeScoreFromFactors;
    window.scoreClamp = clamp;
  }
})();
