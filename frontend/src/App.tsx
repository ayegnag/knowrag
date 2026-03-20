import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DefaultChatTransport, TextStreamChatTransport } from 'ai';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Moon, Sun } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function App() {
  // ✅ Fix 2 & 3: manage input manually since useChat v5 no longer returns it
  const [input, setInput] = useState('');

  const [darkMode, setDarkMode] = useState<boolean>(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new TextStreamChatTransport({
      api: 'http://localhost:3000/api/chat',
    }),
    onError: (err) => {
      console.error('SendMessage error:', err);
      toast.error('Chat error', {
        description: err.message || 'Failed to get response. Try again.',
      });
    },
  });

  const isLoading = status === 'submitted';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (error) {
      console.error('Connection error:', error);
      toast.error('Connection issue', {
        description: error.message || 'Could not reach the server.',
      });
    }
  }, [error]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // ✅ Fix 1: form onSubmit uses SyntheticEvent; sendMessage called manually with text
  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        sendMessage({ text: input });
        setInput('');
      }
    }
  };

  return (
    <div className={cn("min-h-screen flex flex-col", darkMode ? "dark bg-gray-950" : "bg-gray-50")}>
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h4 className="text-xl md:text-2xl mt-0 mb-0 font-bold tracking-tight">
            Knowrag Chat
          </h4>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <ScrollArea className="flex-1 px-4 py-6">
          <div className="max-w-5xl mx-auto space-y-6 pb-24">
            {messages.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <h2 className="text-2xl font-medium mb-5">Welcome to your personal AI chat</h2>
                <p className="max-w-md mx-auto">
                  Ask anything about onboarding, company policies, your Obsidian notes, brag docs, or projects.
                </p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex gap-3 max-w-3xl mx-auto animate-in fade-in-0 duration-200',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {m.role !== 'user' && (
                  <Avatar className="h-9 w-9 mt-1">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-left">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={cn(
                    'px-4 py-3 rounded-2xl shadow-sm max-w-[80%]',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : 'bg-muted rounded-tl-none'
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed break-words w-fit">
                    {m.parts.map((part, index) => {
                      if (part.type === 'text') {
                        return <span key={index}>{part.text}</span>;
                      }
                    })}
                  </div>

                  {/* ✅ Fix 4: use m.createdAt which is the correct field on UIMessage */}
                  {/* <div className="text-xs opacity-70 mt-1.5 text-right">
                    {new Date(m.createdAt ?? Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div> */}
                </div>

                {m.role === 'user' && (
                  <Avatar className="h-9 w-9 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium text-left">
                      ME
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start gap-3 max-w-3xl mx-auto">
                <Avatar className="h-9 w-9 mt-1">
                  <AvatarFallback className="bg-primary/10 text-primary">AI</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 text-muted-foreground bg-muted px-4 py-3 rounded-2xl rounded-tl-none">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t bg-background/80 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="max-w-5xl mx-auto p-4 flex gap-3 items-end"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}  // ✅ Fix 3: inline handler
              onKeyDown={handleKeyDown}
              placeholder="Ask about your notes, or anything..."
              disabled={isLoading}
              className="min-h-[56px] resize-none rounded-xl px-5"
            />
            <Button
              type="submit"
              size="icon"
              className="h-[56px] w-[56px] rounded-xl"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}