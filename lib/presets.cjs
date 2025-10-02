// Shared presets for Safe / Balanced / Strict
module.exports = {
  safe: { ssl: 1.0, reputation: 0.6, domainPenaltyMultiplier: 0.6, urlPatternMultiplier: 0.6 },
  balanced: { ssl: 1.0, reputation: 1.0, domainPenaltyMultiplier: 1.0, urlPatternMultiplier: 1.0 },
  strict: { ssl: 0.85, reputation: 0.5, domainPenaltyMultiplier: 2.0, urlPatternMultiplier: 1.8 }
};
