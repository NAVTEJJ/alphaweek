'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, fetchChatHistory, clearChatHistoryServer } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send, Bot, User, Loader2, Trash2, FileText, X } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS_DEFAULT = [
  'How is my portfolio performing vs the S&P 500?',
  'What sectors should I rotate into right now?',
  'Are there any concentration risks in my portfolio?',
  'What does this week\'s macro setup mean for my holdings?',
];

const SUGGESTED_QUESTIONS_BRIEF = [
  'Summarise this brief in three bullet points.',
  'Which call in this brief carries the most risk?',
  'How does this brief apply to my specific holdings?',
  'What should I watch most closely from this brief?',
];

function ChatInner() {
  const params = useSearchParams();
  const briefId = params?.get('briefId') ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from server on mount. The server is source of truth across devices.
  const { data: serverHistory, isFetched } = useQuery({
    queryKey: ['chat-history'],
    queryFn: fetchChatHistory,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isFetched && serverHistory) {
      setMessages(serverHistory.map((m) => ({ role: m.role, content: m.content })));
    }
  }, [isFetched, serverHistory]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow textarea
  const growTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    // Reset textarea height after clearing
    setTimeout(() => {
      if (inputRef.current) inputRef.current.style.height = '44px';
    }, 0);
    setLoading(true);

    try {
      const { data } = await api.post('/chat', {
        message: content,
        history: messages.slice(-10),
        ...(briefId ? { briefId } : {}),
      });
      const reply = data.data?.reply ?? 'Sorry, I couldn\'t generate a response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again in a moment.' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function clearHistory() {
    setMessages([]);
    await clearChatHistoryServer().catch(() => undefined);
  }

  const suggested = briefId ? SUGGESTED_QUESTIONS_BRIEF : SUGGESTED_QUESTIONS_DEFAULT;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl text-white">AI Chat</h1>
          <p className="text-muted text-sm mt-1">
            Portfolio-aware analyst — powered by Llama 3.3
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            aria-label="Clear chat history"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-loss transition-colors px-2 py-1 rounded"
            title="Clear chat history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Brief-context pill: shown whenever the chat was opened from a brief */}
      {briefId && (
        <div className="mb-3 shrink-0 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-3.5 w-3.5 text-primary-light shrink-0" />
            <span className="text-slate-300 truncate">
              Discussing your brief —{' '}
              <Link href={`/briefs/${briefId}`} className="text-primary-light hover:underline">
                view brief
              </Link>
            </span>
          </div>
          <Link
            href="/chat"
            aria-label="Stop discussing this brief"
            className="text-muted hover:text-slate-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Bot className="h-12 w-12 text-primary-light/50 mb-4" />
              <h3 className="text-slate-300 font-medium mb-2">
                {briefId ? 'Ask anything about this brief' : 'Ask me anything'}
              </h3>
              <p className="text-muted text-sm mb-6">
                {briefId
                  ? 'I have the full brief plus your portfolio in context.'
                  : 'I have context on your portfolio and this week\'s market data.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {suggested.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="text-left text-sm text-muted hover:text-slate-200 border border-border hover:border-primary/30 rounded-lg px-3 py-2 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-primary-light" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary/20 border border-primary/20 text-slate-100 whitespace-pre-wrap'
                    : 'bg-surface-2 border border-border text-slate-200'
                )}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 text-slate-200">{children}</p>,
                      strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
                      ul: ({ children }) => <ul className="space-y-1 mb-2">{children}</ul>,
                      // eslint-disable-next-line jsx-a11y/no-list-item-without-parent
                      li: ({ children }) => <li className="flex items-start gap-1.5"><span className="text-accent mt-1 shrink-0">›</span><span>{children}</span></li>,
                      code: ({ children }) => <code className="font-mono text-xs bg-surface border border-border px-1 py-0.5 rounded text-accent-light">{children}</code>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-surface-2 border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-muted" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-primary-light" />
              </div>
              <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-muted animate-spin" />
                <span className="text-xs text-muted">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); growTextarea(); }}
              onKeyDown={handleKeyDown}
              placeholder={briefId ? 'Ask about this brief…' : 'Ask about your portfolio, market conditions, sectors…'}
              rows={1}
              className="flex-1 resize-none rounded-lg bg-surface-2 border border-border px-4 py-3 text-sm text-slate-100 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 overflow-hidden transition-all min-h-[44px] max-h-[160px]"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="shrink-0 h-[44px] w-[44px] p-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted mt-2">Not financial advice · Shift+Enter for new line</p>
        </div>
      </Card>
    </div>
  );
}

export default function ChatPage() {
  // useSearchParams requires Suspense in app-router pages
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-primary-light animate-spin" /></div>}>
      <ChatInner />
    </Suspense>
  );
}
