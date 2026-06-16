"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { useMentions, MentionContainer } from "ghost-mentions";
import type { MentionEntity, Triggers, SendPayload } from "ghost-mentions";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { TooltipProvider } from "@/components/ui/tooltip";

// ── Mock mention data ──────────────────────────────────────────────
const mockAgents: MentionEntity[] = [
  { id: "coder", label: "Coder", type: "agent" },
  { id: "researcher", label: "Researcher", type: "agent" },
  { id: "designer", label: "Designer", type: "agent" },
  { id: "analyst", label: "Analyst", type: "agent" },
];

const mockTags: MentionEntity[] = [
  { id: "urgent", label: "urgent", type: "tag" },
  { id: "bug", label: "bug", type: "tag" },
  { id: "feature", label: "feature", type: "tag" },
  { id: "docs", label: "docs", type: "tag" },
];

const fetchAgents = async (query: string) => {
  await new Promise((r) => setTimeout(r, 80));
  return mockAgents.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );
};

const fetchTags = async (query: string) => {
  await new Promise((r) => setTimeout(r, 80));
  return mockTags.filter((t) =>
    t.label.toLowerCase().includes(query.toLowerCase())
  );
};

const triggers: Triggers = {
  "@": { type: "agent", fetch: fetchAgents, highlightStyle: { backgroundColor: "#d4eefb" } },
  "#": { type: "tag", fetch: fetchTags, highlightStyle: { backgroundColor: "#fdf3cd" } },
};

// ── Render mention markdown tokens as pills ────────────────────────
// Parses `@[Label](type:id)` into styled spans, leaves rest as text
const MENTION_RE = /(@|#|\/)\[([^\]]+)\]\(([^:]+):([^)]+)\)/g;

const mentionStyles: Record<string, { bg: string; color: string }> = {
  "@": { bg: "#d4eefb", color: "#0c4a6e" },
  "#": { bg: "#fdf3cd", color: "#713f12" },
};

function renderMentionText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [, trigger, label] = match;
    parts.push(
      <span
        key={match.index}
        className="inline rounded px-1 py-px font-medium"
        style={{
          backgroundColor: mentionStyles[trigger]?.bg || "#e2e8f0",
          color: mentionStyles[trigger]?.color || "inherit",
        }}
      >
        {trigger}{label}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// ── Chat page ──────────────────────────────────────────────────────
export default function ChatPage() {
  const [apiKey, setApiKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore key from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("openai-key");
    if (stored) {
      setApiKey(stored);
      setKeyInput(stored);
    }
  }, []);

  const saveKey = () => {
    setApiKey(keyInput);
    localStorage.setItem("openai-key", keyInput);
  };

  // ── useChat from AI SDK v6 ───────────────────────────────────
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
    });
  }, []);

  const {
    messages,
    sendMessage,
    status,
    error,
  } = useChat({
    transport,
    onError: (err) => console.error("Chat error:", err),
  });

  // ── Mention-aware input ───────────────────────────────────────
  const [inputValue, setInputValue] = useState("");

  const authHeaders = () => ({
    Authorization: `Bearer ${apiKey}`,
  });

  const handleSend = (payload: SendPayload) => {
    if (!apiKey) return;
    const text = payload.markdown || payload.text;
    if (!text.trim()) return;

    sendMessage(
      { text },
      { headers: authHeaders() }
    );
    setInputValue("");
  };

  const mention = useMentions({
    value: inputValue,
    onValueChange: setInputValue,
    triggers,
    onSend: handleSend,
    persistOnSend: "clear",
  });

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const isStreaming = status === "streaming" || status === "submitted";

  // Destructure ref out — MentionContainer auto-discovers the textarea via DOM query,
  // so we don't need to forward ref through non-forwardRef components.
  const { ref: _mentionRef, ...mentionBindProps } = mention.bind;

  return (
    <main className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold">AI Chat + Ghost Mentions</h1>
          <p className="text-xs text-muted-foreground">
            Type @ for agents, # for tags. Uses <code>useChat</code> from AI SDK v6.
          </p>
        </div>
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to demos
        </a>
      </div>

      {/* API key bar */}
      {!apiKey && (
        <div className="border-b px-6 py-3 bg-muted/30 shrink-0">
          <div className="flex gap-2 items-center">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey()}
              placeholder="Paste your OpenAI API key (sk-...)"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={saveKey}
              disabled={!keyInput}
              className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Key is stored in localStorage and sent via an Authorization header.
          </p>
        </div>
      )}

      {apiKey && (
        <div className="border-b px-6 py-2 bg-muted/30 shrink-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            OpenAI key: {apiKey.slice(0, 7)}...{apiKey.slice(-4)}
          </span>
          <button
            onClick={() => {
              setApiKey("");
              setKeyInput("");
              localStorage.removeItem("openai-key");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear key
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-6 py-2 bg-destructive/10 text-destructive text-sm shrink-0">
          {error.message}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-20">
            <p className="text-lg font-medium">Send a message to get started</p>
            <p className="text-sm mt-1">
              Try: <code>@Coder help me with #bug in the login flow</code>
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted prose prose-sm prose-neutral dark:prose-invert max-w-none"
              }`}
            >
              {msg.parts?.map((part, i) => {
                if (part.type !== "text") return null;
                if (msg.role === "user") {
                  return <span key={i}>{renderMentionText(part.text)}</span>;
                }
                return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
              })}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input — real PromptInput from AI Elements */}
      <div className="border-t px-6 py-4 shrink-0">
        <TooltipProvider>
          <PromptInput
            onSubmit={(message) => {
              // Fallback for submit-button clicks (Enter is handled by ghost-mentions onSend)
              if (!apiKey) return;
              const text = mention.markdown() || message.text;
              if (!text.trim()) return;
              sendMessage({ text }, { headers: authHeaders() });
              setInputValue("");
            }}
          >
            <MentionContainer mention={mention} mode="popup">
              <PromptInputTextarea
                {...mentionBindProps}
                className="mention-textarea !min-h-[2.5rem] !py-2 !leading-normal"
                placeholder={
                  apiKey
                    ? "Ask something... (@ agents, # tags)"
                    : "Enter your OpenAI API key above"
                }
                disabled={!apiKey || isStreaming}
              />
            </MentionContainer>
            <PromptInputFooter>
              <span className="text-xs text-muted-foreground">
                @ agents &middot; # tags
              </span>
              <PromptInputSubmit
                status={status}
                disabled={!apiKey || !inputValue.trim()}
              />
            </PromptInputFooter>
          </PromptInput>
        </TooltipProvider>
      </div>
    </main>
  );
}
