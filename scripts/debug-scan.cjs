const { computeScoreFromFactors } = require('../lib/score.cjs');
const presets = require('../lib/presets.cjs');

const samples = [
  { url: 'https://google.com', hostname: 'google.com' },
  { url: 'http://example-phishing.com/login', hostname: 'example-phishing.com' },
  { url: 'https://suspicious-verify-phish-malware.example.com/verify', hostname: 'suspicious-verify-phish-malware.example.com' },
  { url: 'https://unknown-site.xyz', hostname: 'unknown-site.xyz' }
];


function checkFactors(url, hostname) {
  const ssl = url.startsWith('https://');
  const domainAge = hostname.length <= 20;
  const knownGood = ['google.com','github.com','stackoverflow.com','mozilla.org','microsoft.com','apple.com','wikipedia.org','youtube.com','linkedin.com'];
  const reputation = knownGood.includes(hostname) || hostname.split('.').pop().length <= 3;
  const blocklist = /phish|malware|fake|scam|fraud/.test(hostname);
  return { ssl, domainAge, reputation, blocklist };
}

function mockDomainReputation(host) {
  const knownDangerousDomains = ['example-phishing.com','fake-bank.com','malware-site.com'];
  if (knownDangerousDomains.includes(host)) return { penalties: 50, malware: true, phishing: true };
  if (/phish|malware/.test(host)) return { penalties: 40, malware: true, phishing: false };
  return { penalties: 0, malware: false, phishing: false };
}

for (const s of samples) {
  console.log('\n---', s.url);
  const f = checkFactors(s.url, s.hostname);
  console.log('factors:', f);
  const dr = mockDomainReputation(s.hostname);
  console.log('domainRep:', dr);
  for (const p of Object.keys(presets)) {
    const score = computeScoreFromFactors(f, dr, s.url, presets[p]);
    console.log(p, '->', score.score, 'confidence', score.confidence);
  }
}
