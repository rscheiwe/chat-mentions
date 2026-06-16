# Chat Mentions

[![npm version](https://img.shields.io/npm/v/chat-mentions.svg)](https://www.npmjs.com/package/chat-mentions)
[![license](https://img.shields.io/npm/l/chat-mentions.svg)](https://github.com/rscheiwe/chat-mentions/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6.svg)](https://www.typescriptlang.org/)

A lightweight React mention system built for controlled `textarea` inputs and AI chat prompt fields.
It provides a headless hook, textarea bindings, ghost-highlight rendering, and popup/dialog pickers without requiring a rich text editor.

## Features

- **Textarea-first:** Works with native textareas and textarea-like prompt components.
- **Headless hook:** `useMentions` owns token tracking, trigger detection, keyboard handling, and serialization.
- **Atomic mentions:** Backspace/Delete removes an entire mention token, including the small post-mention cursor gap.
- **Picker UI:** Includes caret-anchored popup and Radix Dialog picker components.
- **Configurable triggers:** Supports `@`, `#`, `/`, or any trigger string key.
- **Custom display:** Per-trigger `display(entity)` and `highlightStyle` hooks.
- **Markdown output:** Serializes mentions as `@[Label](type:id)`.
- **TypeScript:** Exports typed entities, tokens, config, payloads, and hook result types.

## Preview

### Demo Flow

The markdown mention is correctly parsed from the message text before being sent to the LLM.

| Input | Output |
| --- | --- |
| <img src="https://raw.githubusercontent.com/rscheiwe/chat-mentions/main/docs/assets/mentions.png" alt="Chat Mentions demo input" width="420" /> | <img src="https://raw.githubusercontent.com/rscheiwe/chat-mentions/main/docs/assets/request-text.png" alt="Chat Mentions request text output" width="420" /> |

### Pickers

Two picker modes are available to choose from: a caret-anchored popup for inline composition and a dialog for more deliberate selection flows.

| Popup picker                                                                              | Dialog picker                                                                 |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| <img src="https://raw.githubusercontent.com/rscheiwe/chat-mentions/main/docs/assets/mentions-popup.png" alt="Chat Mentions popup picker" width="420" /> | <img src="https://raw.githubusercontent.com/rscheiwe/chat-mentions/main/docs/assets/mentions-dialogue.png" alt="Chat Mentions dialog picker" width="420" /> |

## Installation

```bash
pnpm add chat-mentions
# or
npm install chat-mentions
```

Peer dependencies:

```bash
pnpm add react react-dom @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

`@radix-ui/react-dialog` is used by `MentionDialog`. The dropdown-menu peer remains declared for compatibility with the current package metadata and demo ecosystem.

## CSS

Import the package stylesheet once in your app, usually from a layout or global CSS entry:

```tsx
import "chat-mentions/styles";
```

or:

```css
@import "chat-mentions/styles";
```

The stylesheet is plain CSS. It does not bundle Tailwind base or utilities.

Default styles use shadcn-style CSS variables:

```css
--accent
--accent-foreground
--foreground
--muted-foreground
```

If your app does not define those variables, either define them globally or override:

```css
.mention-highlight {
}
.mention-highlight-overlay {
}
.mention-textarea {
}
```

`mention-textarea` sets the textarea text color to transparent so the highlight overlay can show the mention pills behind the caret. Keep that class on textareas managed by Chat Mentions.

## Quick Start

### Plain Textarea

```tsx
"use client";

import { useState } from "react";
import { MentionInput } from "chat-mentions";
import type { MentionEntity, Triggers } from "chat-mentions";
import "chat-mentions/styles";

const agents: MentionEntity[] = [
  { id: "coder", label: "Coder", type: "agent" },
  { id: "designer", label: "Designer", type: "agent" },
];

const triggers: Triggers = {
  "@": {
    type: "agent",
    fetch: async (query) =>
      agents.filter((agent) =>
        agent.label.toLowerCase().includes(query.toLowerCase())
      ),
    highlightStyle: { backgroundColor: "#d4eefb" },
  },
};

export function ChatInput() {
  const [value, setValue] = useState("");

  return (
    <MentionInput
      value={value}
      onValueChange={setValue}
      triggers={triggers}
      onSend={({ text, mentions, markdown }) => {
        console.log({ text, mentions, markdown });
      }}
      persistOnSend="clear"
      picker={{ mode: "popup" }}
    >
      <textarea
        className="mention-textarea w-full rounded-md border px-3 py-2 text-sm"
        placeholder="Type @ to mention someone..."
        rows={4}
      />
    </MentionInput>
  );
}
```

### Hook + Container

Use this when you need to integrate with a custom textarea component.

```tsx
"use client";

import { useState } from "react";
import { MentionContainer, useMentions } from "chat-mentions";
import type { Triggers } from "chat-mentions";
import "chat-mentions/styles";

export function CustomInput({ triggers }: { triggers: Triggers }) {
  const [value, setValue] = useState("");

  const mention = useMentions({
    value,
    onValueChange: setValue,
    triggers,
    onSend: ({ text, mentions, markdown }) => {
      console.log({ text, mentions, markdown });
    },
    persistOnSend: "keep",
  });

  return (
    <MentionContainer mention={mention} mode="popup">
      <textarea
        {...mention.bind}
        className="mention-textarea w-full rounded-md border px-3 py-2 text-sm"
        placeholder="Your textarea..."
        rows={4}
      />
    </MentionContainer>
  );
}
```

## AI SDK Elements PromptInput

Chat Mentions can wrap the AI Elements `PromptInputTextarea` while leaving `PromptInput` responsible for layout and submit-button behavior.

Install AI SDK packages and add the AI Elements prompt input component:

```bash
pnpm add ai @ai-sdk/react @ai-sdk/openai
npx ai-elements@latest add prompt-input
```

### Client Example

This matches the demo app pattern: the user enters an OpenAI key locally, and each request sends it via an `Authorization` header.

```tsx
"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MentionContainer, useMentions } from "chat-mentions";
import type { SendPayload, Triggers } from "chat-mentions";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { TooltipProvider } from "@/components/ui/tooltip";

export function ChatInput({
  apiKey,
  triggers,
}: {
  apiKey: string;
  triggers: Triggers;
}) {
  const [inputValue, setInputValue] = useState("");

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { sendMessage, status } = useChat({ transport });
  const isStreaming = status === "streaming" || status === "submitted";

  const authHeaders = () => ({
    Authorization: `Bearer ${apiKey}`,
  });

  const handleSend = (payload: SendPayload) => {
    if (!apiKey) return;
    const text = payload.markdown || payload.text;
    if (!text.trim()) return;
    sendMessage({ text }, { headers: authHeaders() });
    setInputValue("");
  };

  const mention = useMentions({
    value: inputValue,
    onValueChange: setInputValue,
    triggers,
    onSend: handleSend,
    persistOnSend: "clear",
  });

  const { ref: _mentionRef, ...mentionBindProps } = mention.bind;

  return (
    <TooltipProvider>
      <PromptInput
        onSubmit={(message) => {
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
            placeholder="Ask something... (@ agents, # tags)"
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
  );
}
```

### Server Route

Create `app/api/chat/route.ts`:

```ts
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body;
  const authorization = req.headers.get("authorization") ?? "";
  const apiKey = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!apiKey) {
    return new Response("Missing OpenAI API key", { status: 401 });
  }

  const openai = createOpenAI({ apiKey });

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

If your app uses a server-side `OPENAI_API_KEY` instead, keep the client `sendMessage({ text })` calls and create the OpenAI provider from `process.env.OPENAI_API_KEY` in the route.

### Ref Handling

If the child textarea forwards refs, spread `mention.bind` directly:

```tsx
<textarea {...mention.bind} className="mention-textarea ..." />
```

If the child is a wrapper that does not forward refs, remove `ref` before spreading. `MentionContainer` will discover the native textarea inside itself:

```tsx
const { ref: _mentionRef, ...mentionBindProps } = mention.bind;

<MentionContainer mention={mention} mode="popup">
  <PromptInputTextarea {...mentionBindProps} />
</MentionContainer>;
```

Chat Mentions handles Enter through `useMentions({ onSend })`. `PromptInput.onSubmit` should still handle submit-button clicks, and both paths should send the same payload.

## API Reference

### `useMentions(config)`

| Prop            | Type                             | Description                                              |
| --------------- | -------------------------------- | -------------------------------------------------------- |
| `value`         | `string`                         | Controlled textarea value                                |
| `onValueChange` | `(value: string) => void`        | Controlled value setter                                  |
| `triggers`      | `Record<string, TriggerConfig>`  | Trigger definitions                                      |
| `onSend`        | `(payload: SendPayload) => void` | Called on Enter when provided                            |
| `persistOnSend` | `"keep" \| "prefix" \| "clear"`  | How mention tokens persist after send. Default: `"keep"` |
| `picker`        | `{ mode: "popup" \| "dialog" }`  | Picker mode. Default: `{ mode: "popup" }`                |

### `TriggerConfig`

```ts
interface TriggerConfig {
  type: string;
  fetch: (query: string) => Promise<MentionEntity[]>;
  minChars?: number;
  debounce?: number;
  display?: (entity: MentionEntity) => string;
  highlightStyle?: CSSProperties;
}
```

### `MentionEntity`

```ts
interface MentionEntity {
  id: string;
  label: string;
  type: string;
}
```

### `MentionToken`

```ts
interface MentionToken extends MentionEntity {
  start: number;
  end: number;
  trigger: string;
}
```

`start` and `end` are internal positions in the controlled textarea string. They can include invisible spacing used to keep the textarea caret and overlay aligned, so prefer `markdown()` or `strip()` for external payloads.

### `SendPayload`

```ts
interface SendPayload {
  text: string;
  mentions: MentionToken[];
  markdown: string;
}
```

### `UseMentionsResult`

| Property        | Type                              | Description                                       |
| --------------- | --------------------------------- | ------------------------------------------------- |
| `bind`          | `TextareaBindings`                | Props to spread onto a textarea                   |
| `tokens`        | `MentionToken[]`                  | Current mention tokens                            |
| `highlights`    | `HighlightRange[]`                | Ranges consumed by `MentionHighlights`            |
| `menu`          | `MenuState`                       | Current picker state                              |
| `strip()`       | `() => string`                    | Text with mention token display text removed      |
| `markdown()`    | `() => string`                    | Text serialized with `@[Label](type:id)` mentions |
| `insertMention` | `(entity: MentionEntity) => void` | Insert the selected entity                        |
| `closeMenu`     | `() => void`                      | Close the picker                                  |

### Components

- `MentionInput`: all-in-one wrapper for a textarea child.
- `MentionContainer`: wraps custom inputs with highlights plus popup/dialog picker.
- `MentionPopup`: caret-anchored dropdown rendered in a portal.
- `MentionDialog`: modal mention selector powered by Radix Dialog.
- `MentionHighlights`: overlay that renders mention pills behind transparent textarea text.

## Markdown Output

Mentions serialize to `trigger[Label](type:id)`.

Example user-facing text:

```text
Ask @Coder about #performance
```

Example markdown:

```text
Ask @[Coder](agent:coder) about #[performance](tag:perf)
```

Example send payload shape:

```json
{
  "text": "Ask about",
  "mentions": [
    {
      "id": "coder",
      "label": "Coder",
      "type": "agent",
      "trigger": "@",
      "start": 4,
      "end": 12
    },
    {
      "id": "perf",
      "label": "performance",
      "type": "tag",
      "trigger": "#",
      "start": 19,
      "end": 33
    }
  ],
  "markdown": "Ask @[Coder](agent:coder) about #[performance](tag:perf)"
}
```

The exact token positions depend on the controlled textarea value and internal spacing. Treat them as useful for local token maintenance, not as stable storage identifiers.

## Development

```bash
git clone https://github.com/rscheiwe/chat-mentions
cd chat-mentions
pnpm install
pnpm dev
```

`pnpm dev` runs the package watcher and the demo app. The demo is served at:

```text
http://localhost:3003
```

Useful checks:

```bash
pnpm --filter chat-mentions test:run
pnpm -r build
```

To inspect the publish tarball:

```bash
cd packages/chat-mentions
pnpm pack --pack-destination /tmp
```

## License

MIT
