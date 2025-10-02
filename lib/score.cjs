// Minimal scoring core extracted for unit tests (CommonJS)

// Minimal scoring core extracted for unit tests (CommonJS)

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * computeScoreFromFactors
 * - factors: { ssl, reputation, domainAge, blocklist }
 * - domainReputation: { penalties, malware, phishing }
 * - url: string
 * Returns: { score, rawScore, breakdown, confidence }
 *
 * The algorithm uses weighted, explainable adjustments and returns a breakdown
 * so callers can display why a site received the score. We avoid extreme
 * penalties for uncertain signals to reduce false positives.
 */
function computeScoreFromFactors(factors = {}, domainReputation = { penalties: 0, malware: false, phishing: false }, url = '', weights = {}) {
  const breakdown = [];
  // start from neutral
  let raw = 55; // small bias toward safety when heuristics are uncertain

  // Backwards-compat: allow domainReputation to be a numeric penalty
  if (typeof domainReputation === 'number') {
    domainReputation = { penalties: domainReputation, malware: false, phishing: false };
  }

  // SSL (strong positive signal)
  const sslWeight = typeof weights.ssl === 'number' ? weights.ssl : 1;
  if (factors.ssl) {
    const delta = Math.round(20 * sslWeight);
    raw += delta; breakdown.push({ key: 'ssl', delta, note: 'HTTPS present' });
  } else {
    // less punishing for missing SSL because some internal pages may not have it
    const delta = Math.round(-12 * sslWeight);
    raw += delta; breakdown.push({ key: 'ssl', delta, note: 'No HTTPS' });
  }

  // Reputation (could be boolean or score 0..1). Prefer numeric if provided.
  const repWeight = typeof weights.reputation === 'number' ? weights.reputation : 1;
  // Normalize boolean reputation to a modest numeric contribution to avoid extremes
  if (typeof factors.reputation === 'number') {
    // map 0..1 to -12..+18 (give more upside for strong numeric reputation)
    const repDeltaBase = Math.round((factors.reputation * 30) - 12);
    const repDelta = Math.round(repDeltaBase * repWeight);
    raw += repDelta; breakdown.push({ key: 'reputation', delta: repDelta, note: 'Reputation score' });
  } else if (factors.reputation) {
    const delta = Math.round(8 * repWeight);
    raw += delta; breakdown.push({ key: 'reputation', delta, note: 'Good reputation (boolean)' });
  } else {
    const delta = Math.round(-6 * repWeight);
    raw += delta; breakdown.push({ key: 'reputation', delta, note: 'Poor reputation' });
  }

  // Domain age (weak positive)
  const ageWeight = typeof weights.domainAge === 'number' ? weights.domainAge : 1;
  if (factors.domainAge) { const delta = Math.round(6 * ageWeight); raw += delta; breakdown.push({ key: 'domainAge', delta, note: 'Established domain' }); }
  else { breakdown.push({ key: 'domainAge', delta: 0, note: 'Unknown/new domain' }); }

  // Blocklist (strong negative) - keep severe but avoid over-penalizing unknown lists
  const blocklistWeight = typeof weights.blocklist === 'number' ? weights.blocklist : 1;
  if (factors.blocklist) { const delta = Math.round(-40 * blocklistWeight); raw += delta; breakdown.push({ key: 'blocklist', delta, note: 'Listed on blocklist' }); }

  // URL pattern detection (suspicious terms)
  const urlLower = (url || '').toLowerCase();
  // Inspect hostname, path and query separately to better target suspicious tokens
  let pathAndQuery = '';
  let hostnamePart = '';
  try { const u = new URL(url); pathAndQuery = (u.pathname || '') + (u.search || ''); hostnamePart = u.hostname || ''; } catch (e) { pathAndQuery = urlLower; hostnamePart = urlLower; }
  pathAndQuery = pathAndQuery.toLowerCase();
  hostnamePart = hostnamePart.toLowerCase();
  const suspiciousPatterns = ['phish', 'phishing', 'malware', 'verify', 'login', 'account', 'free', 'gift', 'temp-mail', 'urgent', 'click', 'confirm', 'update', 'secure'];
  let patternPenalty = 0;
  const urlPatternWeight = typeof weights.urlPatternMultiplier === 'number' ? weights.urlPatternMultiplier : 1;
  suspiciousPatterns.forEach((p) => { if (pathAndQuery.includes(p) || hostnamePart.includes(p)) patternPenalty += Math.round(12 * urlPatternWeight); });
  if (patternPenalty > 0) {
    // apply smaller per-token penalty but cap (restore to -36 cap for compatibility with tests)
    patternPenalty = Math.min(patternPenalty, 36);
    raw -= patternPenalty; breakdown.push({ key: 'urlPatterns', delta: -patternPenalty, note: 'Suspicious URL path or query tokens' });
  }

  // Heuristic: extremely long query strings or many parameters are suspicious
  try {
    const u = new URL(url);
    const paramsCount = Array.from(u.searchParams.keys()).length;
    if (paramsCount >= 4) { raw -= 6; breakdown.push({ key: 'url_params', delta: -6, note: 'Many URL query parameters' }); }
    if ((u.search || '').length > 150) { raw -= 8; breakdown.push({ key: 'url_query_length', delta: -8, note: 'Long query string' }); }
  } catch (e) { /* ignore */ }

  // Domain reputation (external signals) - apply as additional penalties
  if (domainReputation && typeof domainReputation === 'object') {
    // Cap severe external penalties so a single signal doesn't zero the score
    const domainPenaltyMultiplier = typeof weights.domainPenaltyMultiplier === 'number' ? weights.domainPenaltyMultiplier : 1;
  // Malware/phishing are strong signals (keep strong penalties)
  if (domainReputation.malware) { const delta = Math.round(-60 * domainPenaltyMultiplier); raw += delta; breakdown.push({ key: 'domain_malware', delta, note: 'Known malware distributor' }); }
  if (domainReputation.phishing) { const delta = Math.round(-60 * domainPenaltyMultiplier); raw += delta; breakdown.push({ key: 'domain_phishing', delta, note: 'Known phishing domain' }); }
    if (domainReputation.penalties && domainReputation.penalties > 0) {
      // scale external penalties more smoothly and cap
      const mapped = Math.round(Math.log1p(domainReputation.penalties) * 10);
      const pen = Math.min(Math.round(mapped * domainPenaltyMultiplier), 40);
      raw -= pen; breakdown.push({ key: 'domain_penalties', delta: -pen, note: 'External reputation penalties' });
    }
  }

  // Compute a confidence metric (# of strong signals)
  // Improved confidence: account for number of moderate/strong signals and presence of explicit malware/phishing flags
  const strongPos = breakdown.filter(b => b.delta >= 12).length;
  const strongNeg = breakdown.filter(b => b.delta <= -12).length;
  const moderatePos = breakdown.filter(b => b.delta > 0 && b.delta < 12).length;
  const moderateNeg = breakdown.filter(b => b.delta < 0 && b.delta > -12).length;
  let confidence = 50 + (strongPos - strongNeg) * 15 + (moderatePos - moderateNeg) * 6;
  // increase confidence when domain reputation includes malware/phishing
  if (domainReputation && domainReputation.malware) confidence -= 10;
  if (domainReputation && domainReputation.phishing) confidence -= 10;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const final = clamp(raw);
  return { score: final, rawScore: raw, breakdown, confidence };
}

module.exports = { computeScoreFromFactors, clamp };
