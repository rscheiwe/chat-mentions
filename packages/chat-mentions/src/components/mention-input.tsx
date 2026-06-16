"use client";

import React from "react";
import { useMentions } from "../hooks/use-mentions";
import type { UseMentionsConfig } from "../types";
import { MentionHighlights } from "./mention-highlights";
import { MentionPopup } from "./mention-popup";
import { MentionDialog } from "./mention-dialog";

export interface MentionInputProps extends UseMentionsConfig {
  children: React.ReactElement;
  className?: string;
}

/**
 * MentionInput - Wraps any textarea or input element with mention functionality
 *
 * @example
 * <MentionInput value={value} onValueChange={setValue} triggers={triggers}>
 *   <textarea className="my-textarea" placeholder="Type..." />
 * </MentionInput>
 *
 * @example with PromptInput
 * <MentionInput value={value} onValueChange={setValue} triggers={triggers}>
 *   <PromptInput />
 * </MentionInput>
 */
export function MentionInput({
  value,
  onValueChange,
  triggers,
  onSend,
  persistOnSend,
  picker = { mode: "popup" },
  children,
  className = "",
}: MentionInputProps) {
  const mention = useMentions({
    value,
    onValueChange,
    triggers,
    onSend,
    persistOnSend,
    picker,
  });

  // Clone the child element and add our props to it
  const wrappedChild = React.cloneElement(children, {
    ...mention.bind,
    className: `mention-textarea ${children.props.className || ""}`,
  });

  return (
    <div className={`relative ${className}`} style={{ position: "relative" }}>
      <MentionHighlights
        overlay={mention.highlights}
        textareaRef={mention.bind.ref}
      />
      {wrappedChild}
      {picker.mode === "dialog" ? (
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
