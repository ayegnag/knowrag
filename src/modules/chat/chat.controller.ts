import { Request, Response } from 'express';
import { chatService } from './chat.service.ts';

export async function chatHandler(req: Request, res: Response) {
    const body = req.body;

    // Log incoming payload for debug
    console.log('[Chat Handler] Received payload:', JSON.stringify(body, null, 2));

    let userMessage: string | undefined;
    let history: Array<{ role: string; content: string }> = [];

    // AI SDK format (messages array)
    if (body.messages && Array.isArray(body.messages)) {
        // Find the latest user message
        const userMsgs = body.messages.filter((m: any) => m.role === 'user');
        if (userMsgs.length > 0) {
            const latestUser = userMsgs[userMsgs.length - 1];
            // Extract text from parts (AI SDK format)
            userMessage = latestUser.parts
                ?.find((p: any) => p.type === 'text')?.text
                ?? latestUser.content;  // fallback if no parts

            // Build history (all previous messages)
            history = body.messages
                .slice(0, -1)  // exclude current user message
                .map((m: any) => ({
                    role: m.role,
                    content: m.parts?.find((p: any) => p.type === 'text')?.text ?? m.content ?? '',
                }));
        }
    }

    // Fallback to your original simple format
    if (!userMessage && body.message) {
        userMessage = body.message;
        history = body.history || [];
    }

    if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({ error: 'No valid message found in payload' });
    }

    try {
        // const response = await chatService.processChat(userMessage, history, true);
        // res.json(response);
        const result = await chatService.processChat(userMessage, history, true);

        if (typeof result === 'function') {
            // Streaming
            await result(res);
        } else {
            // Normal JSON
            res.json(result);
        }
    } catch (err: any) {
        console.error('[Chat Handler] Error:', err);
        res.status(500).json({ error: err.message || 'Chat processing failed' });
    }
}