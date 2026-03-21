import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { TextStreamChatTransport } from 'ai';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Moon, Sun, Trash2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Textarea } from './components/ui/textarea';
// import { Separator } from 'radix-ui';
// import {
//   Item,
//   ItemActions,
//   ItemContent,
//   ItemDescription,
//   ItemMedia,
//   ItemTitle,
// } from "@/components/ui/item"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ChatUIProps {
  chatId: string;
  darkMode: boolean;
  initialMessages: any[];
}

interface SidebarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  allChats: any[];
  currentChatId: string;
  chatTopic: string;
  switchToChat: (id: string) => void;
  createNewChat: () => void;
  handleClearChat: () => void;
}

// ─────────────────────────────────────────────
// ChatUI — only mounts after history is ready
// ─────────────────────────────────────────────
function ChatUI({ chatId, darkMode, initialMessages }: ChatUIProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    transport: new TextStreamChatTransport({
      api: 'http://localhost:3000/api/chat',
    }),
    messages: initialMessages, // ✅ stable — history fetch is complete before this mounts
    onError: (err) => {
      console.error('SendMessage error:', err);
      toast.error('Chat error', {
        description: err.message || 'Failed to get response. Try again.',
      });
    },
  });

  const isLoading = status === 'submitted';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Surface connection errors as toasts
  useEffect(() => {
    if (error) {
      console.error('Connection error:', error);
      toast.error('Connection issue', {
        description: error.message || 'Could not reach the server.',
      });
    }
  }, [error]);

  // Auto-grow textarea
  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        sendMessage({ text: input });
        setInput('');
        handleInput();
      }
    }
  };

  // console.log('Rendering ChatUI with messages:', messages);

  return (
    <div className={cn('min-h-screen flex flex-col w-full', darkMode ? 'dark bg-gray-950' : 'bg-gray-50')}>
      {/* Messages */}
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

            {messages.map((m, index) => (
              <div
                key={m.id || index}
                className={cn(
                  'flex gap-3 max-w-3xl mx-auto animate-in fade-in-0 duration-200',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {m.role !== 'user' && (
                  <Avatar className="h-9 w-9 mt-1">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
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
                  <div className="whitespace-pre-wrap text-sm leading-relaxed break-words w-fit text-left">
                    {m.parts && m.parts.length > 0
                      ? m.parts.map((part, index) => {
                        if (part.type === 'text') {
                          return <span key={index}>{part.text}</span>;
                        }
                      })
                      : (m as any).content
                    }
                  </div>
                </div>

                {m.role === 'user' && (
                  <Avatar className="h-9 w-9 mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground font-medium">
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
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e: any) => { setInput(e.target.value); handleInput(); }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Shift+Enter for new line)"
              rows={1}
              disabled={isLoading}
              className="resize-none min-h-12.5 max-h-40 rounded-xl px-5 py-4"
            />
            <Button
              type="submit"
              size="icon"
              className="h-13.5 w-13.5 rounded-xl"
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
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar — lists all chats, allows switching & creating new
// ─────────────────────────────────────────────
function Sidebar({ darkMode, setDarkMode, allChats, currentChatId, chatTopic, switchToChat, createNewChat, handleClearChat }: SidebarProps) {
  return (
    <aside className="min-h-screen w-72 border-r bg-card flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className='flex flex-row'>
            <img src="/knowrag-icon.svg" alt="Knowrag Logo" className="h-6 w-6 inline-block mr-2 mt-1" />
            <h4 className="text-xl md:text-2xl mt-0 mb-0 font-bold tracking-tight">
              Knowrag
            </h4>
          </div>
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
      
      {/* <Item>
        <ItemContent>
          <ItemTitle>{chatTopic}</ItemTitle>
        </ItemContent>
      </Item> */}

      <Button variant="destructive" size="sm" onClick={handleClearChat}>
        <Trash2 className="h-4 w-4 mr-2" /> Clear Chat
      </Button>
      <Button onClick={createNewChat} className="m-3">+ New Chat</Button>
      <ScrollArea className="flex-1">
        {allChats.map((c: any) => (
          <button
            key={c.chatId}
            onClick={() => switchToChat(c.chatId)}
            className={`w-full text-left px-4 py-3 hover:bg-accent ${currentChatId === c.chatId ? 'bg-accent' : ''}`}>
            <div className="font-medium truncate">{c.topic}</div>
            <div className="text-xs text-muted-foreground truncate">{c.messages?.[c.messages.length - 1]?.content?.slice(0, 40)}...</div>
          </button>
        ))}
      </ScrollArea>
    </aside>);
}

// ─────────────────────────────────────────────
// App — parent, owns history fetch & dark mode
// ─────────────────────────────────────────────
export default function App() {
  const [chatId] = useState(() => {
    const saved = localStorage.getItem('currentChatId');
    return saved || `chat-${Date.now()}`;
  });

  const [chatTopic, setChatTopic] = useState(() => {
    const saved = localStorage.getItem('currentChatTopic');
    return saved || '...';
  });

  const [darkMode, setDarkMode] = useState<boolean>(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>("");

  // Get list of all chats for sidebar
  useEffect(() => {
    fetch('/api/chats').then(r => r.json()).then(setAllChats);
  }, []);

  const switchToChat = (chatId: string) => {
    setCurrentChatId(chatId);
    fetch(`/api/chat/${chatId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.messages) {
          setInitialMessages(data.messages);
          setChatTopic(data.meta.topic || "...");
        }
      })
      .catch(err => {
        console.warn('No chat history found or fetch failed:', err);
        // Non-fatal — new chat starts with empty messages
      })
      .finally(() => setIsHistoryLoaded(true)); // always unblocks, even on error

    localStorage.setItem('currentChatId', chatId);
    localStorage.setItem('currentChatTopic', chatTopic);

  };

  const createNewChat = () => {
    const newId = `chat-${Date.now()}`;
    setCurrentChatId(newId);
    localStorage.setItem('currentChatId', newId);
    console.log('New Id', newId);
    setInitialMessages([]);
    setChatTopic("New Conversation");

    window.location.reload();
  };

  const handleClearChat = () => {
    fetch(`/api/chat/${chatId}`, { method: 'DELETE' });
    toast.success('Chat deleted');
    window.location.reload();
  };

  // Dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Fetch history — ChatUI only mounts once this resolves
  useEffect(() => {
    switchToChat(chatId);
  }, [chatId, chatTopic]);

  // Show spinner while history is loading
  if (!isHistoryLoaded) {
    return (
      <div className={cn(
        'min-h-screen flex flex-col items-center justify-center gap-3',
        darkMode ? 'dark bg-gray-950 text-white' : 'bg-gray-50 text-gray-600'
      )}>
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="text-sm">Loading chat history...</p>
        <Toaster position="top-right" />
      </div>
    );
  }

  // ✅ ChatUI mounts here — initialMessages is finalized, no race condition
  if (isHistoryLoaded) {
    // console.log('Chat history loaded, rendering ChatUI with messages:', initialMessages);
    return (
      <div className='min-h-screen flex flex-row'>
        <Sidebar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          allChats={allChats}
          currentChatId={currentChatId}
          chatTopic={chatTopic}
          switchToChat={switchToChat}
          createNewChat={createNewChat}
          handleClearChat={handleClearChat}
        />
        <ChatUI
          darkMode={darkMode}
          chatId={chatId}
          initialMessages={initialMessages}
        />
        <Toaster position="top-right" />
      </div>
    );
  }
}