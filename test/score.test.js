const assert = require('assert');
const { computeScoreFromFactors } = require('../lib/score');

function run() {
  console.log('Running scoring tests...');

  // Happy path: all positives -> high score but not necessarily 100
  let res = computeScoreFromFactors({ ssl: true, reputation: true, domainAge: true, blocklist: false }, 0, 'example.com');
  assert(res.score >= 80, 'Expected high score for very positive factors');

  // Negative path: no ssl, blocklisted -> low score
  res = computeScoreFromFactors({ ssl: false, reputation: false, domainAge: false, blocklist: true }, 0, 'malware-site');
  assert(res.score <= 20, 'Expected low score for strongly negative factors');

  // URL contains phishing keyword -> penalty
  res = computeScoreFromFactors({ ssl: true, reputation: true, domainAge: true, blocklist: false }, 0, 'http://verify.example.com');
  assert(res.score < 100, 'Verify keyword should reduce score below 100');

  // Domain penalty applied
  res = computeScoreFromFactors({ ssl: true, reputation: true, domainAge: true, blocklist: false }, 50, 'example.com');
  assert(res.score <= 50, 'Domain penalties should reduce score');

  console.log('All scoring tests passed');
}

run();
