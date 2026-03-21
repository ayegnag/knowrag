import { Request, Response } from 'express';
import { chatService } from './chat.service.js';

export async function chatHandler(req: Request, res: Response) {
  const body = req.body;

  // Log full incoming payload (very helpful for debugging)
  console.log('[Chat Handler] Received payload:', JSON.stringify(body, null, 2));

  let userMessage: string | undefined;
  let history: Array<{ role: string; content: string; timestamp: number }> = [];
  let chatId: string | undefined;

  // AI SDK format
  if (body.id) {
    chatId = body.id;  // chatId comes as "id" in the payload
  }

  if (body.messages && Array.isArray(body.messages)) {
    // Find the latest user message
    const userMsgs = body.messages.filter((m: any) => m.role === 'user');
    if (userMsgs.length > 0) {
      const latestUser = userMsgs[userMsgs.length - 1];
      userMessage = latestUser.parts
        ?.find((p: any) => p.type === 'text')?.text
        ?? latestUser.content;  // fallback

      // Build history (exclude the current user message)
      history = body.messages
        .slice(0, -1)
        .map((m: any) => ({
          role: m.role,
          content: m.parts?.find((p: any) => p.type === 'text')?.text ?? m.content ?? '',
          timestamp: m.timestamp ?? Date.now(),
        }));
    }
  }

  // Fallback (in case frontend sends old format)
  if (!userMessage && body.message) {
    userMessage = body.message;
    history = body.history || [];
    chatId = body.chatId || chatId;  // prefer id from AI SDK
  }

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'No valid message found in payload' });
  }

  if (!chatId) {
    chatId = `chat-${Date.now()}`;
  }

  try {
    const result = await chatService.processChat(userMessage, history, chatId, true);

    if (typeof result === 'function') {
      // Streaming response
      await result(res);
    } else {
      // Non-streaming: return only the assistant message (what useChat expects)
      res.json(result);
    }
  } catch (err: any) {
    console.error('[Chat Handler] Error:', err);
    res.status(500).json({ error: err.message || 'Chat processing failed' });
  }
}

export async function listChatsHandler(req: Request, res: Response) {
  const allChats = chatService.listChats();
  res.json(allChats);
}

export async function getHistoryHandler(req: Request, res: Response) {
  const { chatId } = req.params;
  const history = chatService.getHistory(chatId);
  const meta = chatService.getChatMeta(chatId);
  res.json({ chatId, messages: history, meta });
}

export async function deleteChatHandler(req: Request, res: Response) {
  const { chatId } = req.params;
  const result = chatService.deleteChat(chatId);
  res.json(result);
}