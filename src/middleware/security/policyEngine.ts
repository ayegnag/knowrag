/**
 * Stage 3: Business/policy rules (customizable)
 * Returns { isAllowed: boolean, reason?: string }
 */
export async function policyEngine(query: string): Promise<{ isAllowed: boolean; reason?: string }> {
  // Example rules – customize based on your company policies
  const rules = [
    {
      check: (q: string) => q.length > 2000,
      reason: 'Query exceeds maximum allowed length (2000 characters)',
    },
    {
      check: (q: string) => /confidential|secret|proprietary/i.test(q) && !/policy|guideline/i.test(q),
      reason: 'Query appears to request confidential information without justification',
    },
    // Add more: topic whitelist, rate-limit per user, etc.
  ];

  for (const rule of rules) {
    if (rule.check(query)) {
      return { isAllowed: false, reason: rule.reason };
    }
  }

  return { isAllowed: true };
}