const { computeScoreFromFactors } = require('../lib/score.cjs');

const sample = { url: 'https://google.com', hostname: 'google.com' };
const f = { ssl: true, domainAge: true, reputation: true, blocklist: false };
const dr = { penalties: 0, malware: false, phishing: false };

const candidates = [
  { name: 'current', w: { ssl: 0.95, reputation: 0.7, domainPenaltyMultiplier: 1.6, urlPatternMultiplier: 1.4 } },
  { name: 'stricter-1', w: { ssl: 0.9, reputation: 0.6, domainPenaltyMultiplier: 1.8, urlPatternMultiplier: 1.6 } },
  { name: 'stricter-2', w: { ssl: 0.85, reputation: 0.5, domainPenaltyMultiplier: 2.0, urlPatternMultiplier: 1.8 } },
  { name: 'mild', w: { ssl: 1.0, reputation: 0.8, domainPenaltyMultiplier: 1.4, urlPatternMultiplier: 1.2 } }
];

console.log('Tuning with sample', sample.url);
for (const c of candidates) {
  const res = computeScoreFromFactors(f, dr, sample.url, c.w);
  console.log(c.name, '->', res.score, 'raw', res.rawScore, 'confidence', res.confidence);
}
