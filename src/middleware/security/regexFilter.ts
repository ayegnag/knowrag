/**
 * Stage 1: Fast regex-based filtering for obvious malicious or disallowed patterns
 * Returns { isAllowed: boolean, reason?: string }
 */
export async function regexFilter(query: string): Promise<{ isAllowed: boolean; reason?: string }> {
  // Common dangerous patterns (expand as needed)
  const dangerousPatterns = [
    { pattern: /(<script>|javascript:|on\w+=)/i, reason: 'Potential XSS attempt' },
    { pattern: /(union\s+select|drop\s+table|insert\s+into|--|;|\/\*)/i, reason: 'Potential SQL injection' },
    { pattern: /prompt\s*:\s*ignore\s*previous/i, reason: 'Jailbreak attempt detected' },
    { pattern: /system\s*instructions?/i, reason: 'Attempt to override system prompt' },
    { pattern: /\b(credit\s*card|ssn|password|api[-_]?key)\b/i, reason: 'Potential PII leak attempt' },
  ];

  for (const { pattern, reason } of dangerousPatterns) {
    if (pattern.test(query)) {
      return { isAllowed: false, reason };
    }
  }

  return { isAllowed: true };
}