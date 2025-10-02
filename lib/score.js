// Minimal scoring core extracted for unit tests

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeScoreFromFactors(factors, domainPenalties = 0, url = '') {
  let score = 60;
  if (factors.ssl) score += 15; else score -= 30;
  if (factors.reputation) score += 10; else score -= 15;
  if (factors.domainAge) score += 5;
  if (factors.blocklist) score -= 50;

  const urlLower = (url || '').toLowerCase();
  if (urlLower.includes('phish') || urlLower.includes('malware') || urlLower.includes('verify')) score -= 40;

  score -= domainPenalties;
  return { score: clamp(score) };
}

module.exports = { computeScoreFromFactors, clamp };
