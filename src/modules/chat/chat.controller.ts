import { Request, Response } from 'express';
import { chatService } from './chat.service.ts';

export async function chatHandler(req: Request, res: Response) {
    const { message, history = [], stream = false } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required (string)' });
    }

    if (!Array.isArray(history)) {
        return res.status(400).json({ error: 'history must be an array' });
    }

    try {
        const result = await chatService.processChat(message, history, stream);

        if (typeof result === 'function') {
            // Streaming
            await result(res);
        } else {
            // Normal JSON
            res.json(result);
        }
    } catch (err: any) {
        console.warn('[Chat Handler] error:', err);
        res.status(500).json({ error: err.message });
    }
}