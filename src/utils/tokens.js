/**
 * Token Statistics Utilities
 */

const TOKEN_RATES = {
  input: 15.0,
  output: 75.0,
  cacheRead: 1.5,
  cacheWrite: 18.75,
};

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

function formatNumber(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calculateCostForBucket(bucket) {
  const inputCost = (bucket.input / 1_000_000) * TOKEN_RATES.input;
  const outputCost = (bucket.output / 1_000_000) * TOKEN_RATES.output;
  const cacheReadCost = (bucket.cacheRead / 1_000_000) * TOKEN_RATES.cacheRead;
  const cacheWriteCost = (bucket.cacheWrite / 1_000_000) * TOKEN_RATES.cacheWrite;
  return {
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost: inputCost + outputCost + cacheReadCost + cacheWriteCost,
  };
}

function getTokenStats(sessions) {
  // Count active sessions
  let activeCount = 0;
  let activeMainCount = 0;
  let activeSubagentCount = 0;

  sessions.forEach((s) => {
    if (s.active) {
      activeCount++;
      if (s.sessionKey && s.sessionKey.includes(":subagent:")) {
        activeSubagentCount++;
      } else {
        activeMainCount++;
      }
    }
  });

  // Simplified usage (would be calculated from JSONL in full implementation)
  const totalTokens = sessions.reduce((sum, s) => sum + (s.tokens || 0), 0);
  const estCost = totalTokens > 0 ? (totalTokens / 1_000_000) * 20 : 0; // Rough estimate
  const planCost = 200;
  const monthlyApiCost = estCost * 30;
  const monthlySavings = monthlyApiCost - planCost;

  return {
    total: formatTokens(totalTokens),
    input: formatTokens(Math.round(totalTokens * 0.7)),
    output: formatTokens(Math.round(totalTokens * 0.3)),
    cacheRead: "0",
    cacheWrite: "0",
    requests: sessions.length,
    activeCount,
    activeMainCount,
    activeSubagentCount,
    mainLimit: 12,
    subagentLimit: 24,
    estCost: `$${formatNumber(estCost)}`,
    planCost: `$${planCost}`,
    planName: "Claude Code Max",
    estSavings: monthlySavings > 0 ? `$${formatNumber(monthlySavings)}/mo` : null,
    savingsPercent: monthlySavings > 0 ? Math.round((monthlySavings / monthlyApiCost) * 100) : 0,
    estMonthlyCost: `$${Math.round(monthlyApiCost).toLocaleString()}`,
    savingsWindows: {},
    avgTokensPerSession: formatTokens(sessions.length > 0 ? Math.round(totalTokens / sessions.length) : 0),
    avgCostPerSession: `$${sessions.length > 0 ? (estCost / sessions.length).toFixed(2) : "0.00"}`,
    sessionCount: sessions.length,
  };
}

module.exports = { getTokenStats, formatTokens, formatNumber, calculateCostForBucket, TOKEN_RATES };
