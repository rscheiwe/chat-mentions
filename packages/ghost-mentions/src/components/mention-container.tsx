"use client";

import { ReactNode, useRef, useLayoutEffect, useState, MutableRefObject } from "react";
import type { UseMentionsResult } from "../types";
import { MentionHighlights } from "./mention-highlights";
import { MentionPopup } from "./mention-popup";
import { MentionDialog } from "./mention-dialog";

export interface MentionContainerProps {
  mention: UseMentionsResult;
  children: ReactNode;
  mode?: "popup" | "dialog";
}

/**
 * Container that wraps your input with mention functionality
 *
 * @example
 * ```tsx
 * const mention = useMentions({ value, onValueChange, triggers });
 *
 * <MentionContainer mention={mention}>
 *   <PromptInput {...mention.bind} />
 * </MentionContainer>
 * ```
 */
export function MentionContainer({
  mention,
  children,
  mode = "popup"
}: MentionContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textareaFound, setTextareaFound] = useState(false);

  // Auto-discover the native <textarea> inside the container when the ref
  // hasn't been forwarded (e.g., wrapped in non-forwardRef components like
  // AI Elements PromptInputTextarea).
  useLayoutEffect(() => {
    if (mention.bind.ref.current) {
      if (!textareaFound) setTextareaFound(true);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const textarea = container.querySelector("textarea");
    if (textarea) {
      (mention.bind.ref as MutableRefObject<HTMLTextAreaElement | null>).current = textarea;
      setTextareaFound(true);
    }
  });

  return (
    <div ref={containerRef} className="relative w-full" style={{ position: "relative", width: "100%" }}>
      <MentionHighlights
        key={textareaFound ? "found" : "pending"}
        overlay={mention.highlights}
        textareaRef={mention.bind.ref}
      />
      {children}
      {mode === "dialog" ? (
        <MentionDialog
          menu={mention.menu}
          onSelect={mention.insertMention}
          onClose={mention.closeMenu}
        />
      ) : (
        <MentionPopup
          menu={mention.menu}
          onSelect={(item) => mention.insertMention(item)}
        />
      )}
    </div>
  );
}
