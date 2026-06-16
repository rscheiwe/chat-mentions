"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type { HighlightRange } from "../types";

export interface MentionHighlightsProps {
  overlay: HighlightRange[];
  textareaRef: RefObject<HTMLTextAreaElement>;
}

export function MentionHighlights({ overlay, textareaRef }: MentionHighlightsProps) {
  const highlighterRef = useRef<HTMLDivElement>(null);
  const [textareaStyles, setTextareaStyles] = useState<CSSProperties>({});
  const [textareaValue, setTextareaValue] = useState("");

  // Copy textarea styles to highlighter (like SimpleMentionInput)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const computed = window.getComputedStyle(textarea);
    setTextareaStyles({
      padding: computed.padding,
      border: computed.border,
      font: computed.font,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      lineHeight: computed.lineHeight,
    });
  }, [textareaRef]);

  // Listen for input events to update immediately
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleInput = () => {
      setTextareaValue(textarea.value);
    };

    // Set initial value
    setTextareaValue(textarea.value);

    // Listen to input event for immediate updates during typing
    textarea.addEventListener('input', handleInput);
    return () => textarea.removeEventListener('input', handleInput);
  }, [textareaRef]);

  // Also sync when textarea value changes programmatically (e.g., mention insertion)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Update if textarea.value differs from our state (prevents infinite loop)
    if (textarea.value !== textareaValue) {
      setTextareaValue(textarea.value);
    }
  }, [overlay, textareaRef, textareaValue]); // Run when overlay changes (token added)

  // Sync scroll between textarea and highlighter (like SimpleMentionInput)
  useEffect(() => {
    const textarea = textareaRef.current;
    const highlighter = highlighterRef.current;
    if (!textarea || !highlighter) return;

    const handleScroll = () => {
      highlighter.scrollTop = textarea.scrollTop;
      highlighter.scrollLeft = textarea.scrollLeft;
    };

    textarea.addEventListener("scroll", handleScroll);
    return () => textarea.removeEventListener("scroll", handleScroll);
  }, [textareaRef]);

  const renderHighlightedText = () => {
    const text = textareaValue;
    if (!text) return null;

    // Sort ranges by start position
    const sortedRanges = overlay.slice().sort((a, b) => a.start - b.start);

    const nodes: ReactNode[] = [];
    let lastIndex = 0;

    sortedRanges.forEach((range, index) => {
      if (range.end <= lastIndex || range.start >= text.length) return;

      const start = Math.max(0, range.start);
      const end = Math.min(text.length, range.end);
      const beforeText = text.substring(lastIndex, start);
      if (beforeText) {
        nodes.push(<Fragment key={`text-${index}`}>{beforeText}</Fragment>);
      }

      nodes.push(
        <span
          className="mention-highlight"
          data-mention-type={range.type}
          key={`mention-${index}-${start}-${end}`}
          style={range.style}
        >
          {text.substring(start, end)}
        </span>
      );

      lastIndex = end;
    });

    const remainingText = text.substring(lastIndex);
    if (remainingText) {
      nodes.push(<Fragment key="text-tail">{remainingText}</Fragment>);
    }

    return nodes;
  };

  return (
    <div
      ref={highlighterRef}
      className="mention-highlight-overlay"
      style={textareaStyles}
      aria-hidden="true"
    >
      {renderHighlightedText()}
    </div>
  );
}
