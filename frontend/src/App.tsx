import { useEffect, useRef, useState, type RefObject, type Ref, type TextareaHTMLAttributes, forwardRef, type ForwardedRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, } from '@/components/ui/button-group';
import { TextStreamChatTransport } from 'ai';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Moon, Sun, Trash2, SquarePen, MailCheckIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Textarea } from './components/ui/textarea';
import {
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from './components/ui/dropdown-menu';


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
  forwardedTextareaRef: ForwardedRef<HTMLTextAreaElement>;
}

interface SidebarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  allChats: any[];
  currentChatId: string;
  chatTopic: string;
  switchToChat: (id: string) => void;
  createNewChat: () => void;
  handleClearChat: (id: string) => void;
}

// ─────────────────────────────────────────────
// ChatUI — only mounts after history is ready
// ─────────────────────────────────────────────
function ChatUI({ chatId, darkMode, initialMessages, forwardedTextareaRef }: ChatUIProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = forwardedTextareaRef as RefObject<HTMLTextAreaElement>;

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
    <div className={cn('h-screen overflow-hidden flex flex-col w-full', darkMode ? 'dark bg-gray-950' : 'bg-gray-50')}>
      {/* Messages */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background min-h-0 relative">

        {/* Floating SidebarTrigger */}
        <div className="absolute top-3 left-3 z-20">
          <SidebarTrigger />
        </div>

        {/* Chat Area */}
        <ScrollArea className="flex-1 min-h-0 px-4 pt-6 pb-0">

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
            className="max-w-3xl mx-auto p-4 flex gap-3 items-end"
          >
            <Textarea
              ref={forwardedTextareaRef}
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
// AppSidebar — lists all chats, allows switching & creating new
// ─────────────────────────────────────────────
function AppSidebar({ darkMode, setDarkMode, allChats, currentChatId, chatTopic, switchToChat, createNewChat, handleClearChat }: SidebarProps) {
  return (
    <Sidebar variant='sidebar'>
      <SidebarHeader>
        <div className='flex flex-row'>
          <img src="/knowrag-icon.svg" alt="Knowrag Logo" className="h-6 w-6 inline-block mr-2 mt-1" />
          <h4 className="text-xl md:text-2xl mt-0 mb-0 font-bold tracking-tight">
            Knowrag
          </h4>
        </div>
      </SidebarHeader>
      <Separator className='mb-5' />
      <Button variant="outline"
        onClick={() => createNewChat()}
        className='text-left mx-3'>
        <SquarePen className='mr-2' /> New Chat
      </Button>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          {/* <SidebarGroupAction>
            <SquarePen /> <span className="sr-only">New Chat</span>
          </SidebarGroupAction> */}
          <SidebarGroupContent className='flex flex-col gap-3 w-full'>
            {allChats.map((c: any) => (
              <ButtonGroup
                key={c.chatId}
                className='w-full'>
                <Button variant="outline"
                  onClick={() => switchToChat(c.chatId)}
                  className={`flex-1 text-left justify-start truncate ${currentChatId === c.chatId ? 'bg-accent' : ''}`}>
                  <div className="font-medium truncate">{c.topic}</div>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="More Options">
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuGroup>
                      {/* <DropdownMenuItem>
                        <MailCheckIcon />
                        Mark as Read
                      </DropdownMenuItem> */}
                      <DropdownMenuItem variant="destructive" onClick={() => handleClearChat(c.chatId)}>
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ButtonGroup>
            ))}
          </SidebarGroupContent>
        </ SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
      </SidebarFooter>
    </Sidebar>
  );

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

  const forwardTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Get list of all chats for sidebar
  useEffect(() => {
    fetch('/api/chats').then(r => r.json()).then(setAllChats);
  }, []);

  const switchToChat = (chatId: string) => {
    console.log('[SwitchToChat] chatId', chatId);
    setCurrentChatId(chatId);
    setInitialMessages([]);
    setIsHistoryLoaded(false);
    fetch(`/api/chat/${chatId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.messages) {
          setInitialMessages(data.messages);
          setChatTopic(data.meta.topic || "...");
        }
      })
      .catch(err => {
        forwardTextareaRef.current?.focus();
        console.warn('No chat history found or fetch failed:', err);
        // Non-fatal — new chat starts with empty messages
      })
      .finally(() => {
        forwardTextareaRef.current?.focus();
        setIsHistoryLoaded(true) // always unblocks, even on error
      });

    localStorage.setItem('currentChatId', chatId);
    localStorage.setItem('currentChatTopic', chatTopic);

  };

  // const createNewChat = () => {
  //   const newId = `chat-${Date.now()}`;
  //   setCurrentChatId(newId);
  //   localStorage.setItem('currentChatId', newId);
  //   console.log('New Id', newId);
  //   setInitialMessages([]);
  //   setChatTopic("New Conversation");

  //   window.location.reload();
  // };

  const createNewChat = () => {
    const newId = `chat-${Date.now()}`;

    // 1. Clear old messages immediately
    setInitialMessages([]);

    // 2. Update current ID and topic
    setCurrentChatId(newId);
    setChatTopic("New Conversation");

    // 3. Persist to localStorage
    localStorage.setItem('currentChatId', newId);
    localStorage.setItem('currentChatTopic', "New Conversation");

    // 4. Reset useChat internal state by forcing a remount
    // (the cleanest way without conditional hook)
    switchToChat(newId);

    // // 5. Optional: tell backend a new chat exists (empty)
    // fetch(`/api/chat/${newId}`, { method: 'POST' }).catch(() => { });

    toast.success("New chat started");
  };

  const handleClearChat = (id: string) => {
    fetch(`/api/chat/${id}`, { method: 'DELETE' });
    toast.success('Chat deleted');
    window.location.reload();
  };

  // Dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Fetch history — ChatUI only mounts once this resolves
  useEffect(() => {
    console.log('[UseEffect - FetchHistory] ChatId called', chatId);
    switchToChat(chatId);
  }, []);

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

  if (isHistoryLoaded) {
    // console.log('Chat history loaded, rendering ChatUI with messages:', initialMessages);
    return (
      <div className='min-h-full flex w-full'>
        <AppSidebar
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
          forwardedTextareaRef={forwardTextareaRef}
        />
        <Toaster position="top-right" />
      </div>
    );
  }
}