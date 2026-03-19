// src/App.tsx
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function App() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:3000/api/chat',
    }),
  });

const isLoading = status === 'submitted';
const handleSubmit = (e: React.SyntheticEvent) => {
  e.preventDefault();
  if (!input.trim()) return;
  sendMessage({ text: input });
  setInput('');
};
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b p-4">
        <h1 className="text-2xl font-bold">Onboarding RAG Chat</h1>
      </header>
      <main className="flex-1 flex flex-col p-4 max-w-4xl mx-auto w-full">
        <ScrollArea className="flex-1 border rounded-lg p-4 mb-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`mb-4 ${m.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <div
                className={`inline-block max-w-[80%] p-3 rounded-lg ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {m.parts
                  .filter((part) => part.type === 'text')
                  .map((part, i) => (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  ))}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-muted-foreground">Thinking...</div>
          )}
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about onboarding, policies, or your notes..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </form>
      </main>
    </div>
  );
}