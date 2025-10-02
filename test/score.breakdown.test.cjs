const assert = require('assert');
const { computeScoreFromFactors } = require('../lib/score.cjs');

function run() {
  console.log('Running scoring breakdown tests...');

  // Pattern penalty accumulation and cap
  let res = computeScoreFromFactors({ ssl: true, reputation: true, domainAge: true, blocklist: false }, 0, 'http://verify-phish-malware.example.com');
  const pattern = res.breakdown.find(b => b.key === 'urlPatterns');
  assert(pattern, 'Expected urlPatterns entry when suspicious tokens present');
  assert(pattern.delta <= -36 && pattern.delta < 0, 'Pattern penalty should be negative and capped at -36');

  // Malware flag should add a significant penalty
  res = computeScoreFromFactors({ ssl: true, reputation: true, domainAge: true, blocklist: false }, { penalties: 0, malware: true, phishing: false }, 'example.com');
  const mal = res.breakdown.find(b => b.key === 'domain_malware');
  assert(mal && mal.delta <= -60, 'Malware breakdown should be present and strongly negative');

  // Phishing flag should add a significant penalty
  res = computeScoreFromFactors({ ssl: true, reputation: true, domainAge: true, blocklist: false }, { penalties: 0, malware: false, phishing: true }, 'example.com');
  const ph = res.breakdown.find(b => b.key === 'domain_phishing');
  assert(ph && ph.delta <= -60, 'Phishing breakdown should be present and strongly negative');

  // Blocklist should reduce score but not below 0 in raw
  res = computeScoreFromFactors({ ssl: false, reputation: false, domainAge: false, blocklist: true }, 0, 'malicious.com');
  const bl = res.breakdown.find(b => b.key === 'blocklist');
  assert(bl && bl.delta < 0, 'Blocklist should appear with negative delta');
  assert(res.score >= 0 && res.score <= 100, 'Score should be clamped to 0..100');

  console.log('All scoring breakdown tests passed');
}

run();
