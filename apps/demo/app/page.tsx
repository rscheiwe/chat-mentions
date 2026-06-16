"use client";

import { useState } from "react";
import { useMentions, MentionContainer, MentionInput } from "ghost-mentions";
import type { MentionEntity, Triggers } from "ghost-mentions";

// Mock data
const mockAgents = [
  { id: "coder", label: "Coder", type: "agent" },
  { id: "researcher", label: "Researcher", type: "agent" },
  { id: "designer", label: "Designer", type: "agent" },
  { id: "analyst", label: "Analyst", type: "agent" },
];

const mockTags = [
  { id: "urgent", label: "urgent", type: "tag" },
  { id: "bug", label: "bug", type: "tag" },
  { id: "feature", label: "feature", type: "tag" },
  { id: "docs", label: "docs", type: "tag" },
];

const mockCommands = [
  { id: "help", label: "help", type: "command" },
  { id: "clear", label: "clear", type: "command" },
  { id: "export", label: "export", type: "command" },
];

// Fetch functions
const fetchAgents = async (query: string): Promise<MentionEntity[]> => {
  await new Promise((r) => setTimeout(r, 100)); // Simulate API delay
  return mockAgents.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );
};

const fetchTags = async (query: string): Promise<MentionEntity[]> => {
  await new Promise((r) => setTimeout(r, 100));
  return mockTags.filter((t) =>
    t.label.toLowerCase().includes(query.toLowerCase())
  );
};

const fetchCommands = async (query: string): Promise<MentionEntity[]> => {
  await new Promise((r) => setTimeout(r, 100));
  return mockCommands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );
};

const triggers: Triggers = {
  "@": { type: "agent", fetch: fetchAgents, highlightStyle: { backgroundColor: "#d4eefb" } },
  "#": { type: "tag", fetch: fetchTags, highlightStyle: { backgroundColor: "#fdf3cd" } },
  "/": { type: "command", fetch: fetchCommands },
};

export default function Home() {
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [value3, setValue3] = useState("");
  const [lastSent, setLastSent] = useState<any>(null);

  // Example: Using the hook + container pattern for custom inputs
  const mention = useMentions({
    value: value3,
    onValueChange: setValue3,
    triggers,
    onSend: (payload) => {
      console.log("Sent:", payload);
      setLastSent(payload);
    },
    persistOnSend: "keep",
  });

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Ghost Mentions Demo</h1>
          <p className="text-muted-foreground">
            A lightweight mentions system for shadcn + Tailwind
          </p>
          <a
            href="/chat"
            className="inline-block mt-3 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Try AI Chat Demo →
          </a>
        </div>

        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Popup Mode</h2>
              <p className="text-sm text-muted-foreground">
                Type @ for agents, # for tags, or / for commands. Press Enter to send.
              </p>
            </div>
            <MentionInput
              value={value1}
              onValueChange={setValue1}
              triggers={triggers}
              onSend={(payload) => {
                console.log("Sent:", payload);
                setLastSent(payload);
              }}
              persistOnSend="keep"
              picker={{ mode: "popup" }}
            >
              <textarea
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Ask @Coder about #performance..."
                rows={4}
              />
            </MentionInput>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Dialog Mode</h2>
              <p className="text-sm text-muted-foreground">
                Opens a modal dialog for mention selection
              </p>
            </div>
            <MentionInput
              value={value2}
              onValueChange={setValue2}
              triggers={triggers}
              onSend={(payload) => {
                console.log("Sent:", payload);
                setLastSent(payload);
              }}
              persistOnSend="clear"
              picker={{ mode: "dialog" }}
            >
              <textarea
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Try @ # or / to open dialog..."
                rows={4}
              />
            </MentionInput>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Custom Input (Hook Pattern)</h2>
              <p className="text-sm text-muted-foreground">
                Use <code>useMentions</code> hook + <code>MentionContainer</code> to wrap your own input
              </p>
            </div>
            <MentionContainer mention={mention} mode="popup">
              <textarea
                {...mention.bind}
                className="mention-textarea w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Your custom textarea or PromptInput..."
                rows={4}
              />
            </MentionContainer>
          </section>

          {lastSent && (
            <section className="p-6 border rounded-lg bg-muted/50">
              <h3 className="text-lg font-semibold mb-3">Last Sent Message</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Plain Text:</span>
                  <pre className="mt-1 p-2 bg-background rounded border">
                    {lastSent.text}
                  </pre>
                </div>
                <div>
                  <span className="font-medium">Markdown:</span>
                  <pre className="mt-1 p-2 bg-background rounded border">
                    {lastSent.markdown}
                  </pre>
                </div>
                <div>
                  <span className="font-medium">Mentions ({lastSent.mentions.length}):</span>
                  <pre className="mt-1 p-2 bg-background rounded border overflow-x-auto">
                    {JSON.stringify(lastSent.mentions, null, 2)}
                  </pre>
                </div>
              </div>
            </section>
          )}
        </div>

        <section className="mt-8 p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Features</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>
                <strong>Atomistic Deletion:</strong> Backspace/Delete removes entire mention tokens
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>
                <strong>Ghost Highlights:</strong> Visual overlay shows mentions behind text
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>
                <strong>Keyboard Navigation:</strong> Arrow keys + Enter in popup
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>
                <strong>Persist Modes:</strong> Keep, prefix, or clear mentions after send
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>
                <strong>Markdown Output:</strong> @[Label](type:id) format
              </span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
