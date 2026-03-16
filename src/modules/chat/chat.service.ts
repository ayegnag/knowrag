import { Response } from 'express';
import { runSecurityPipeline } from '../../middleware/security/securityPipeline.js';
import { vectorDB } from '../../services/vector-db/qdrant/qdrant.service.js';
import { llm } from '../../config/llm-providers.js';
import env from '../../config/env.js';

export const chatService = {
    async processChat(userMessage: string, history: Array<{ role: string; content: string }>, stream = false) {
        // Step 1: Security check
        const security = await runSecurityPipeline(userMessage);
        if (!security.isAllowed) {
            return {
                success: false,
                blocked: true,
                reason: security.reason,
                stage: security.stage,
                confidence: security.confidence,
            };
        }

        // Step 2: Embed the user query
        const queryEmbedding = await llm.generateEmbedding(userMessage);

        // Step 3: Retrieve relevant chunks from Qdrant
        const retrieval = await vectorDB.query({
            vector: queryEmbedding,
            limit: 5,                  // top-5 chunks
            withPayload: true,
            withVector: false,
        });

        const contexts = retrieval.results
            .filter(r => r.score > 0.65)  // cosine similarity threshold – adjust as needed
            .map(r => r.payload?.text || '')
            .filter(Boolean);

        if (contexts.length === 0) {
            contexts.push('No relevant knowledge found in the personal documents.');
        }

        // Step 4: Build prompt with context + history
        const systemPrompt = `
You are a helpful personal assistant for the user.
Use only the provided context from personal documents.
Do not hallucinate or make up information.
If unsure, say so clearly.
Answer concisely and professionally.
    `.trim();

        const contextBlock = contexts.length > 0
            ? `Relevant context from documents:\n${contexts.join('\n\n---\n\n')}`
            : 'No specific context found.';

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt + '\n\n' + contextBlock },
            ...history.slice(-6).map(msg => ({
                role: msg.role as 'system' | 'user' | 'assistant',
                content: msg.content,
            })),
            { role: 'user', content: userMessage },
        ];

        // Step 5: Generate response

        if (stream) {
            // Return a function that will be called by controller to stream
            return async (res: Response) => {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                const generationStream = await llm.generateChatCompletion(messages, {
                    temperature: 0.7,
                    max_tokens: 1024,
                    stream: true,
                });

                // Ollama stream handling (adjust based on your updated provider)
                let fullReply = '';

                // console.log('[ProcessChat] generationStream:', generationStream);
                generationStream.data.on('data', (chunk: Buffer) => {
                    const lines = chunk.toString().split('\n').filter(Boolean);
                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message?.content) {
                                fullReply += parsed.message.content;
                                res.write(`data: ${JSON.stringify({ content: parsed.message.content })}\n\n`);
                            }
                            if (parsed.done) {
                                res.write(`data: ${JSON.stringify({ done: true, fullReply })}\n\n`);
                                res.end();
                            }
                        } catch(err: any) {
                            console.warn('[ProcessChat - Stream] error:', err);
                        }
                    }
                });

                generationStream.data.on('error', (err: any) => {
                    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                    res.end();
                });
            };
        }

        // For non-streaming, just return the full response
        const generation = await llm.generateChatCompletion(messages, {
            temperature: 0.7,
            max_tokens: 1024,
            stream: false, // <-- For simplicity, we do non-streaming here. Can be enhanced later.
        });

        const assistantReply = generation.choices[0].message.content.trim();

        // Optional: return full trace for debugging
        return {
            success: true,
            blocked: false,
            reply: assistantReply,
            retrievedChunks: contexts.length,
            retrievalScores: retrieval.results.map(r => r.score),
            usedContext: contexts,
            debug: { security, messagesLength: messages.length },
        };
    },
};