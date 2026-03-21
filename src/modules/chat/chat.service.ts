import { Response } from 'express';
import { runSecurityPipeline } from '../../middleware/security/securityPipeline.js';
import { vectorDB } from '../../services/vector-db/qdrant/qdrant.service.ts';
import { llm } from '../../config/llm-providers.js';
import env from '../../config/env.js';
import { generateSparseVector } from '../ingest/bm25.ts';

const chatStore = new Map<string, Array<{ role: string; content: string; timestamp?: number }>>();
const chats = new Map<string, {
    id: string;
    topic: string;
    messages: Array<{ role: string; content: string; timestamp: number }>;
}>();

export const chatService = {

    getHistory(chatId: string) {
        return chatStore.get(chatId) || [];
    },

    listChats() {
        return Array.from(chats.values())
            .sort((a, b) => (b.messages[b.messages.length - 1]?.timestamp || 0) - (a.messages[a.messages.length - 1]?.timestamp || 0));
    },

    deleteChat(chatId: string) {
        chatStore.delete(chatId);
        return { success: true };
    },

    deleteMessage(chatId: string, messageIndex: number) {
        const history = chatStore.get(chatId);
        if (history && messageIndex >= 0 && messageIndex < history.length) {
            history.splice(messageIndex, 1);
            chatStore.set(chatId, history);
            return { success: true };
        }
        return { success: false };
    },

    async processChat(userMessage: string, history: Array<{ role: string; content: string; timestamp?: number }>, chatId: string, stream = false) {
        console.log(`[ProcessChat] user-message`, userMessage);

        // Generate Chat Topic if new chat
        const isNewChat = history.length === 0;

        let chatTopic = "General Chat";

        // Step -1: Generate chat topic only for brand new chats
        if (isNewChat) {
            const topicPrompt = `
Generate a very short, meaningful topic/title (max 6-8 words) for this new conversation.
It should be descriptive and natural, like a folder name or note title.

User first message: "${userMessage}"

Respond with ONLY the topic text. No quotes, no explanation, no extra words.
`;

            try {
                const topicResponse = await llm.generateChatCompletion([
                    { role: 'system', content: 'You are a helpful assistant that creates concise chat titles.' },
                    { role: 'user', content: topicPrompt },
                ], { temperature: 0.5, max_tokens: 30, stream: false, });
                let fullContent = '';

                // If it's somehow a stream (edge case)
                if (topicResponse.data && typeof topicResponse.data.on === 'function') {
                    await new Promise<void>((resolve, reject) => {
                        topicResponse.data.on('data', (chunk: Buffer) => {
                            const lines = chunk.toString().split('\n');
                            for (const line of lines) {
                                if (line.trim()) {
                                    try {
                                        const parsed = JSON.parse(line);
                                        if (parsed.message?.content) fullContent += parsed.message.content;
                                    } catch { }
                                }
                            }
                        });

                        topicResponse.data.on('end', resolve);
                        topicResponse.data.on('error', reject);
                    });
                } else {
                    // Normal completed topicResponse
                    fullContent = topicResponse?.choices?.[0]?.message?.content
                        ?? topicResponse?.message?.content
                        ?? '';
                }

                chatTopic = topicResponse.choices[0].message.content.trim().replace(/["']/g, '');
                console.log(`[Chat] Generated new topic: "${chatTopic}" for chat ${chatId}`);
            } catch (e) {
                console.warn('[Chat] Topic generation failed, using default', e);
            }
        }

        // ---


        const userRequestTimestamp = Date.now();
        // Step 0: Security check
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

        // Step 1: Pull History
        const effectiveChatId = chatId || `chat-${Date.now()}`;

        // Load existing history if chatId provided
        let fullHistory = chatStore.get(effectiveChatId) || [];
        if (history && history.length > 0) {
            // fullHistory = [...fullHistory, ...history]            
            fullHistory = [...history]
        };


        // Step 2: Embed the user query
        const queryEmbedding = await llm.generateEmbedding(userMessage);
        const querySparse = generateSparseVector(userMessage);

        // Step 3: Hybrid retrieval of relevant chunks from Qdrant (Dense + BM25 Sparse + RRF)
        const retrieval = await vectorDB.query({
            vector: queryEmbedding,
            sparseVector: {
                bm25: querySparse
            },
            // fusion: 'rrf',  // Reciprocal Rank Fusion
            limit: 12,                  // prev: top-5 chunks
            filter: undefined,
            withPayload: true,
            withVector: false,
        });

        // const contexts = retrieval.results
        //     .filter(r => r.score > 0.65)  // cosine similarity threshold – adjust as needed
        //     .map(r => r.payload?.text || '')
        //     .filter(Boolean);

        // if (contexts.length === 0) {
        //     contexts.push('No relevant knowledge found in the personal documents.');
        // }
        const contexts = retrieval.results
            .map(r => {
                const p = r.payload as any || {};
                const score = r.score || 0;

                // Optional soft boost (keep it light)
                let boost = 0;
                if (p.topicHint && userMessage.toLowerCase().includes(p.topicHint.toLowerCase().split(' > ').pop() || '')) {
                    boost = 0.08;  // tiny nudge
                }

                return {
                    text: p.text || '',
                    score: score + boost,
                    topic: p.topicHint || 'unknown',
                    file: p.originalFileName || 'unknown',
                    fullPath: p.relativePath || 'unknown',
                };
            })
            .filter(c => c.text.trim().length > 30)  // only drop junk
            .sort((a, b) => b.score - a.score)
            .slice(0, 12);  // take up to 12 — plenty for most prompts

        // Log all kept chunks
        // console.log(`[RAG Context] Kept ${contexts.length} chunks after sorting (no hard score filter)`);
        // contexts.forEach((c, i) => {
        //     console.log(`Chunk ${i + 1} (${c.score.toFixed(3)}): ${c.topic} / ${c.file}`);
        //     console.log(c.text.slice(0, 150) + (c.text.length > 150 ? '...' : ''));
        //     console.log('---');
        // });

        // Step 4: Build prompt with context + history
        const systemPrompt = `
You are a helpful personal assistant for the user.
Use only the provided context from personal documents.
Do not hallucinate or make up information.
If unsure, say so clearly.
Answer concisely and professionally.
    `.trim();

        const contextBlock = contexts.length
            ? `Relevant context from your Obsidian notes (sorted by relevance, with folder paths):\n\n` +
            contexts.map(c => `From ${c.topic} / ${c.file} (score: ${c.score.toFixed(3)}):\n${c.text}`).join('\n\n---\n\n')
            : 'No sufficiently relevant notes found.';
        // console.log(`[RAG Prompt] Sending ${contexts.length} chunks to LLM (total context length: ${contextBlock.length})`);

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt + '\n\n' + contextBlock },
            ...history.slice(-6).map(msg => ({
                role: msg.role as 'system' | 'user' | 'assistant',
                content: msg.content,
            })),
            { role: 'user', content: userMessage },
        ];

        // Step 5: Generate response

        // if (stream) {
        //     console.log('[ProcessChat] Generating response...');
        //     // Return a function that will be called by controller to stream
        //     try {
        //         return async (res: Response) => {
        //             console.log('[ProcessChat] Setting headers...');
        //             res.setHeader('Content-Type', 'text/event-stream');
        //             res.setHeader('Cache-Control', 'no-cache');
        //             res.setHeader('Connection', 'keep-alive');

        //             let generationStream;
        //             try {
        //                 generationStream = await llm.generateChatCompletion(messages, {
        //                     temperature: 0.7,
        //                     max_tokens: 1024,
        //                     stream: true,
        //                 });
        //             } catch (err: any) {
        //                 console.error('[ProcessChat] Stream generation error:', err);
        //                 res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        //                 res.end();
        //                 return;
        //             }

        //             // Ollama stream handling (adjust based on your updated provider)
        //             let fullReply = '';

        //             console.log('[ProcessChat] generationStream:', generationStream);
        //             generationStream.data.on('data', (chunk: Buffer) => {
        //                 const lines = chunk.toString().split('\n').filter(Boolean);
        //                 for (const line of lines) {
        //                     try {
        //                         const parsed = JSON.parse(line);
        //                         if (parsed.message?.content) {
        //                             fullReply += parsed.message.content;
        //                             res.write(`data: ${JSON.stringify({ content: parsed.message.content })}\n\n`);
        //                             console.log('[ProcessChat - Stream] content:', parsed.message.content);
        //                         }
        //                         if (parsed.done) {
        //                             res.write(`data: ${JSON.stringify({ done: true, fullReply })}\n\n`);
        //                             res.end();
        //                         }
        //                     } catch (err: any) {
        //                         console.warn('[ProcessChat - Stream] error:', err);
        //                     }
        //                 }
        //             });

        //             generationStream.data.on('error', (err: any) => {
        //                 res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        //                 res.end();
        //             });
        //         };
        //     } catch (err: any) {
        //         console.error('[ProcessChat] Stream generation error:', err);
        //         // return {
        //         //     success: false,
        //         //     blocked: false,
        //         //     error: err.message || 'Streaming generation failed',
        //         // };
        //     }

        //     console.warn('[ProcessChat] Stream generation setup failed, falling back to non-streaming response');
        //     // For non-streaming, just return the full response
        //     const generation = await llm.generateChatCompletion(messages, {
        //         temperature: 0.7,
        //         max_tokens: 1024,
        //         stream: false, // <-- For simplicity, we do non-streaming here. Can be enhanced later.
        //     });

        //     const assistantReply = generation.choices[0].message.content.trim();

        //     // Optional: return full trace for debugging
        //     // return {
        //     //     success: true,
        //     //     blocked: false,
        //     //     reply: assistantReply,
        //     //     retrievedChunks: contexts.length,
        //     //     retrievalScores: retrieval.results.map((r: { score: any; }) => r.score),
        //     //     usedContext: contexts,
        //     //     debug: { security, messagesLength: messages.length },
        //     // };

        //     return {
        //         messages: {
        //             id: `msg-assistant-${Date.now()}`,
        //             role: "assistant",
        //             content: assistantReply,
        //             parts: [{ type: 'text', text: assistantReply }],
        //             // You can keep these for your own debugging (SDK will ignore them)
        //             debug: {
        //                 retrievedChunks: contexts.length,
        //                 retrievalScores: retrieval.results.map((r: any) => r.score || 0),
        //             },
        //         }
        //     };
        // }

        if (stream) {
            return async (res: Response) => {
                // ✅ Text stream protocol: plain text, no SSE envelope needed
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no'); // prevents nginx buffering

                let generationStream;
                try {
                    generationStream = await llm.generateChatCompletion(messages, {
                        temperature: 0.7,
                        max_tokens: 1024,
                        stream: true,
                    });
                } catch (err: any) {
                    console.error('[ProcessChat] Stream generation error:', err);
                    res.status(500).end(err.message);
                    return;
                }

                let fullReply = '';

                generationStream.data.on('data', (chunk: Buffer) => {
                    const lines = chunk.toString().split('\n').filter(Boolean);
                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message?.content) {
                                const token = parsed.message.content;
                                fullReply += token;
                                res.write(parsed.message.content);
                                console.log('[ProcessChat - Stream] delta:', parsed.message.content);
                            }
                            if (parsed.done) {
                                fullHistory.push({
                                    role: 'user',
                                    content: userMessage,
                                    timestamp: userRequestTimestamp
                                });
                                fullHistory.push({
                                    role: 'assistant',
                                    content: fullReply,
                                    timestamp: Date.now(),
                                });
                                chatStore.set(chatId, fullHistory);

                                console.log(`[ChatStore] Saved streaming chat ${chatId} | ${fullHistory.length} messages`);
                                res.end();
                            }
                        } catch (err: any) {
                            console.warn('[ProcessChat - Stream] parse error:', err);
                        }
                    }
                });

                generationStream.data.on('error', (err: any) => {
                    console.error('[ProcessChat] stream error:', err);
                    res.end();
                });
            };
        }

    }
}
