/**
 * Cost Utilities
 * 
 * Token cost calculations and breakdowns.
 */

const { execSync } = require("child_process");
const { CONFIG } = require("../config");

// Token pricing (per 1M tokens)
const TOKEN_RATES = {
  input: 3.0,
  output: 15.0,
  cacheRead: 0.3,
  cacheWrite: 3.75,
};

// Cache for daily token usage
let dailyTokenUsageCache = null;
let dailyTokenUsageCacheTime = 0;
const DAILY_TOKEN_CACHE_TTL = 60000; // 1 minute

/**
 * Get daily token usage from llm_usage skill
 */
function getDailyTokenUsage() {
  const now = Date.now();
  if (dailyTokenUsageCache && now - dailyTokenUsageCacheTime < DAILY_TOKEN_CACHE_TTL) {
    return dailyTokenUsageCache;
  }

  try {
    const output = execSync(
      `cd "${CONFIG.paths.skills}/llm_usage" && python -m llm_usage daily --json 2>/dev/null`,
      {
        encoding: "utf8",
        timeout: 10000,
      },
    );
    const data = JSON.parse(output);
    dailyTokenUsageCache = data;
    dailyTokenUsageCacheTime = now;
    return data;
  } catch (e) {
    // Fallback: return empty data
    return {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      requests: 0,
    };
  }
}

/**
 * Calculate costs for a token usage bucket
 */
function calculateCostForBucket(usage) {
  const inputCost = (usage.input / 1_000_000) * TOKEN_RATES.input;
  const outputCost = (usage.output / 1_000_000) * TOKEN_RATES.output;
  const cacheReadCost = (usage.cacheRead / 1_000_000) * TOKEN_RATES.cacheRead;
  const cacheWriteCost = (usage.cacheWrite / 1_000_000) * TOKEN_RATES.cacheWrite;

  return {
    inputCost: Math.round(inputCost * 100) / 100,
    outputCost: Math.round(outputCost * 100) / 100,
    cacheReadCost: Math.round(cacheReadCost * 100) / 100,
    cacheWriteCost: Math.round(cacheWriteCost * 100) / 100,
    totalCost: Math.round((inputCost + outputCost + cacheReadCost + cacheWriteCost) * 100) / 100,
  };
}

/**
 * Get top sessions by token usage
 */
function getTopSessionsByTokens(limit = 5) {
  try {
    const { getSessions } = require("./sessions");
    const sessions = getSessions({ limit: null });
    return sessions
      .filter((s) => s.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, limit)
      .map((s) => ({
        label: s.label,
        tokens: s.tokens,
        channel: s.channel,
        active: s.active,
      }));
  } catch (e) {
    return [];
  }
}

/**
 * Get cost breakdown for dashboard
 */
function getCostBreakdown() {
  const usage = getDailyTokenUsage();
  if (!usage) {
    return { error: "Failed to get usage data" };
  }

  // Calculate costs for 24h (primary display)
  const costs = calculateCostForBucket(usage);

  // Get plan info from config
  const planCost = CONFIG.billing?.claudePlanCost || 200;
  const planName = CONFIG.billing?.claudePlanName || "Claude Code Max";

  // Calculate moving averages for each window
  const windowConfigs = {
    "24h": { days: 1, label: "24h" },
    "3d": { days: 3, label: "3dma" },
    "7d": { days: 7, label: "7dma" },
  };

  const windows = {};
  for (const [key, config] of Object.entries(windowConfigs)) {
    const bucket = usage.windows?.[key] || usage;
    const bucketCosts = calculateCostForBucket(bucket);
    const dailyAvg = bucketCosts.totalCost / config.days;
    const monthlyProjected = dailyAvg * 30;
    const monthlySavings = monthlyProjected - planCost;

    windows[key] = {
      label: config.label,
      days: config.days,
      totalCost: bucketCosts.totalCost,
      dailyAvg,
      monthlyProjected,
      monthlySavings,
      savingsPercent:
        monthlySavings > 0 ? Math.round((monthlySavings / monthlyProjected) * 100) : 0,
      requests: bucket.requests,
      tokens: {
        input: bucket.input,
        output: bucket.output,
        cacheRead: bucket.cacheRead,
        cacheWrite: bucket.cacheWrite,
      },
    };
  }

  return {
    // Raw token counts (24h for backward compatibility)
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheRead: usage.cacheRead,
    cacheWrite: usage.cacheWrite,
    requests: usage.requests,

    // Pricing rates
    rates: {
      input: TOKEN_RATES.input.toFixed(2),
      output: TOKEN_RATES.output.toFixed(2),
      cacheRead: TOKEN_RATES.cacheRead.toFixed(2),
      cacheWrite: TOKEN_RATES.cacheWrite.toFixed(2),
    },

    // Cost calculation breakdown (24h)
    calculation: {
      inputCost: costs.inputCost,
      outputCost: costs.outputCost,
      cacheReadCost: costs.cacheReadCost,
      cacheWriteCost: costs.cacheWriteCost,
    },

    // Totals (24h for backward compatibility)
    totalCost: costs.totalCost,
    planCost,
    planName,

    // Period
    period: "24 hours",

    // Multi-window data for moving averages
    windows,

    // Top sessions by tokens
    topSessions: getTopSessionsByTokens(5),
  };
}

module.exports = {
  getCostBreakdown,
  getDailyTokenUsage,
  calculateCostForBucket,
  TOKEN_RATES,
};
