import { regexFilter } from './regexFilter.js';
import { llmClassifier } from './llmClassifier.js';
import { policyEngine } from './policyEngine.js';
import env from '../../config/env.js';

export interface SecurityResult {
    isAllowed: boolean;
    stage: 'regex' | 'llm' | 'policy' | 'passed';
    reason?: string;
    confidence?: number;
}

/**
 * Full multi-stage security check
 * Short-circuits on first failure
 */
export async function runSecurityPipeline(query: string): Promise<SecurityResult> {
    // Stage 1: Regex (fast, no LLM cost)
    const regexResult = await regexFilter(query);
    if (!regexResult.isAllowed) {
        return {
            isAllowed: false,
            stage: 'regex',
            reason: regexResult.reason,
        };
    }

    // Stage 2: LLM classifier
    if (env.OLLAMA_CLASSIFIER_MODEL) {
        const classifierResult = await llmClassifier(query);
        if (!classifierResult.isSafe) {
            return {
                isAllowed: false,
                stage: 'llm',
                reason: classifierResult.explanation,
                confidence: classifierResult.confidence,
            };
        }

        if (classifierResult.confidence < env.SECURITY_CONFIDENCE_THRESHOLD) {
            return {
                isAllowed: false,
                stage: 'llm',
                reason: `Low confidence (${classifierResult.confidence}) in safety classification`,
                confidence: classifierResult.confidence,
            };
        }
    }

    // Stage 3: Policy engine
    const policyResult = await policyEngine(query);
    if (!policyResult.isAllowed) {
        return {
            isAllowed: false,
            stage: 'policy',
            reason: policyResult.reason,
        };
    }

    // All stages passed
    return {
        isAllowed: true,
        stage: 'passed',
    };
}