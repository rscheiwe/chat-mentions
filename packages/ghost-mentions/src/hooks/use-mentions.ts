import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";
import type {
  UseMentionsConfig,
  UseMentionsResult,
  MentionToken,
  MentionEntity,
  MenuState,
  HighlightRange,
} from "../types";
import { adjustTokenRanges } from "../utils/diff";
import { serializeMarkdown } from "../utils/markdown";
import { getCaretRect } from "../utils/caret";

export function useMentions(config: UseMentionsConfig): UseMentionsResult {
  const {
    value,
    onValueChange,
    triggers,
    onSend,
    persistOnSend = "keep",
    picker = { mode: "popup" },
  } = config;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [tokens, setTokens] = useState<MentionToken[]>([]);
  const [menu, setMenu] = useState<MenuState>({
    open: false,
    trigger: "",
    query: "",
    items: [],
    selectedIndex: 0,
    loading: false,
    caretRect: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const previousValueRef = useRef<string>(value);
  const triggerStartRef = useRef<number>(0);
  const isComposingRef = useRef(false);

  // When the DOM changes the caret (e.g., setRangeText), record it here and restore
  // after the controlled value re-renders.
  const pendingCaretRef = useRef<number | null>(null);

  // ---------- utilities ----------
  const inToken = (pos: number) =>
    tokens.find((t) => pos > t.start && pos <= t.end);

  const tokenAtOrAdjacentForBackspace = (pos: number) =>
    tokens.find((t) => pos === t.end || (pos > t.start && pos <= t.end));

  const tokenAtOrAdjacentForDelete = (pos: number) =>
    tokens.find((t) => pos === t.start || (pos >= t.start && pos < t.end));

  const deleteTokenRange = (start: number, end: number) => {
    const ta = textareaRef.current!;
    const removedLen = end - start;

    // Atomic DOM delete moves caret to "start"
    ta.setRangeText("", start, end, "start");
    const afterDeletePos = ta.selectionStart;
    pendingCaretRef.current = afterDeletePos;

    // Shift remaining tokens and drop intersected ones
    setTokens((prev) =>
      prev
        .filter((t) => t.end <= start || t.start >= end)
        .map((t) =>
          t.start >= end
            ? { ...t, start: t.start - removedLen, end: t.end - removedLen }
            : t
        )
    );

    // Sync controlled value
    previousValueRef.current = ta.value;
    onValueChange(ta.value);
  };

  // ---------- trigger detection ----------
  const detectTrigger = useCallback(
    async (text: string, caretPos: number) => {
      if (isComposingRef.current) return;

      // Don't open inside an existing token
      if (inToken(caretPos)) return;

      // Walk backward to find a trigger at a word boundary
      for (let i = caretPos - 1; i >= 0; i--) {
        // Skip positions inside existing tokens so we don't re-detect their trigger char
        const hitToken = tokens.find((t) => i >= t.start && i < t.end);
        if (hitToken) {
          i = hitToken.start; // loop decrements to start - 1
          continue;
        }

        const ch = text[i];
        if (ch in triggers) {
          if (i === 0 || /\s/.test(text[i - 1])) {
            const query = text.slice(i + 1, caretPos);
            const cfg = triggers[ch];
            const min = cfg.minChars ?? 0;

            triggerStartRef.current = i;

            const caretRect = textareaRef.current
              ? getCaretRect(textareaRef.current)
              : null;

            setMenu((m) => ({
              ...m,
              open: true,
              trigger: ch,
              query,
              caretRect,
              loading: true,
              selectedIndex: 0,
            }));

            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(async () => {
              try {
                const items = query.length >= min ? await cfg.fetch(query) : [];
                setMenu((m) => ({ ...m, items, loading: false }));
              } catch (e) {
                console.error("mention fetch failed", e);
                setMenu((m) => ({ ...m, items: [], loading: false }));
              }
            }, 120);
            return;
          }
        }
        if (/\s/.test(ch)) break; // stop at whitespace
      }

      if (menu.open) setMenu((m) => ({ ...m, open: false }));
    },
    [triggers, menu.open, tokens]
  );

  // ---------- external value sync ----------
  useEffect(() => {
    if (value === previousValueRef.current) return;
    const adjusted = adjustTokenRanges(tokens, previousValueRef.current, value);
    previousValueRef.current = value;
    setTokens(adjusted);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep popup anchored when menu is open
  useLayoutEffect(() => {
    if (!menu.open) return;
    const ta = textareaRef.current;
    if (!ta) return;
    setMenu((m) => ({ ...m, caretRect: getCaretRect(ta) }));
  }, [value, menu.open]);

  // Restore caret *after* React has re-rendered the controlled value.
  useLayoutEffect(() => {
    if (pendingCaretRef.current == null) return;
    const ta = textareaRef.current;
    if (!ta) {
      pendingCaretRef.current = null;
      return;
    }
    // Only restore if the DOM value matches the controlled prop value
    if (value === ta.value) {
      const pos = pendingCaretRef.current;
      ta.setSelectionRange(pos!, pos!);
      ta.focus();
      pendingCaretRef.current = null;
    }
  }, [value]);

  // ---------- change / selection / composition ----------
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      const caret = e.target.selectionStart ?? next.length;
      previousValueRef.current = next;
      onValueChange(next);
      detectTrigger(next, caret);
    },
    [onValueChange, detectTrigger]
  );

  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    detectTrigger(ta.value, ta.selectionStart ?? ta.value.length);
  }, [detectTrigger]);

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);
  const onCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    const ta = textareaRef.current;
    if (ta) detectTrigger(ta.value, ta.selectionStart ?? ta.value.length);
  }, [detectTrigger]);

  // ---------- insert mention (DOM-first) ----------
  const insertMention = useCallback(
    (entity: MentionEntity) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const triggerStart = triggerStartRef.current;
      const caretPos = ta.selectionStart ?? value.length;

      const cfg = triggers[menu.trigger];
      const label = cfg?.display?.(entity) ?? entity.label;
      const tokenText = `${menu.trigger}${label}`;
      const replacement = `${tokenText} `; // includes trailing space

      // 1) Replace in DOM; browser updates caret atomically
      ta.setRangeText(replacement, triggerStart, caretPos, "end");
      pendingCaretRef.current = ta.selectionStart; // capture true caret

      const newValue = ta.value;

      // 2) Shift existing tokens & add new token (token excludes trailing space)
      const removedLen = caretPos - triggerStart;
      const delta = replacement.length - removedLen;

      const newToken: MentionToken = {
        ...entity,
        trigger: menu.trigger,
        start: triggerStart,
        end: triggerStart + tokenText.length,
      };

      setTokens((prev) => {
        const shifted = prev.map((t) =>
          t.start >= caretPos
            ? { ...t, start: t.start + delta, end: t.end + delta }
            : t
        );
        return [...shifted, newToken].sort((a, b) => a.start - b.start);
      });

      // 3) Sync controlled value
      previousValueRef.current = newValue;
      onValueChange(newValue);

      // 4) Close menu
      setMenu((m) => ({ ...m, open: false, items: [], query: "" }));
    },
    [menu.trigger, onValueChange, triggers, value]
  );

  const closeMenu = useCallback(() => {
    setMenu((m) => ({ ...m, open: false }));
  }, []);

  // ---------- key handling ----------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposingRef.current) return;

      // Menu navigation
      if (menu.open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMenu((m) => ({
            ...m,
            selectedIndex: Math.min(m.selectedIndex + 1, m.items.length - 1),
          }));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMenu((m) => ({
            ...m,
            selectedIndex: Math.max(m.selectedIndex - 1, 0),
          }));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const sel = menu.items[menu.selectedIndex];
          if (sel) insertMention(sel);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeMenu();
          return;
        }
      }

      const ta = e.currentTarget;
      const posStart = ta.selectionStart ?? 0;
      const posEnd = ta.selectionEnd ?? posStart;

      // Send on Enter (no Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        if (onSend) {
          e.preventDefault();
          const payload = {
            text: strip(),
            mentions: tokens,
            markdown: markdown(),
          };

          if (persistOnSend === "clear") {
            setTokens([]);
            previousValueRef.current = "";
            onValueChange("");
          } else if (persistOnSend === "prefix") {
            // move mentions to front as raw text
            const ordered = [...tokens].sort((a, b) => a.start - b.start);
            const head = ordered
              .map((t) => value.slice(t.start, t.end))
              .join(" ");
            const next = head ? head + " " : "";
            const remapped = ordered.map((t, i) => {
              const text = value.slice(t.start, t.end);
              const offset =
                i === 0
                  ? 0
                  : ordered
                      .slice(0, i)
                      .reduce(
                        (acc, tt) =>
                          acc + value.slice(tt.start, tt.end).length + 1,
                        0
                      );
              return { ...t, start: offset, end: offset + text.length };
            });
            setTokens(remapped);
            previousValueRef.current = next;
            onValueChange(next);
          }
          onSend(payload);
        }
        return;
      }

      // Atomistic deletion with selection spanning tokens
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        posStart !== posEnd
      ) {
        const touched = tokens.filter(
          (t) => Math.max(posStart, t.start) < Math.min(posEnd, t.end)
        );
        if (touched.length) {
          e.preventDefault();
          const start = Math.min(posStart, ...touched.map((t) => t.start));
          const end = Math.max(posEnd, ...touched.map((t) => t.end));
          deleteTokenRange(start, end);
          return;
        }
      }

      // Backspace at/inside token → delete whole token
      if (e.key === "Backspace" && posStart === posEnd) {
        const tok = tokenAtOrAdjacentForBackspace(posStart);
        if (tok) {
          e.preventDefault();
          deleteTokenRange(tok.start, tok.end);
          return;
        }
      }

      // Delete at/inside token → delete whole token
      if (e.key === "Delete" && posStart === posEnd) {
        const tok = tokenAtOrAdjacentForDelete(posStart);
        if (tok) {
          e.preventDefault();
          deleteTokenRange(tok.start, tok.end);
          return;
        }
      }
    },
    [
      menu.open,
      menu.items,
      menu.selectedIndex,
      closeMenu,
      insertMention,
      onSend,
      persistOnSend,
      tokens,
      value,
    ]
  );

  // ---------- strip & markdown ----------
  const strip = useCallback((): string => {
    if (!tokens.length) return value.trim();
    const ordered = [...tokens].sort((a, b) => a.start - b.start);
    let out = "";
    let idx = 0;
    for (const t of ordered) {
      out += value.slice(idx, t.start);
      idx = t.end;
    }
    out += value.slice(idx);
    return out.trim();
  }, [value, tokens]);

  const markdown = useCallback((): string => {
    return serializeMarkdown(value, tokens);
  }, [value, tokens]);

  // ---------- highlights for overlay ----------
  const highlights: HighlightRange[] = tokens.map((t) => ({
    start: t.start,
    end: t.end,
    label: t.label,
    type: t.type,
  }));

  return {
    bind: {
      ref: textareaRef,
      value,
      onChange: handleChange,
      onKeyDown: handleKeyDown,
      onSelect: handleSelect,
      onCompositionStart,
      onCompositionEnd,
    },
    tokens,
    highlights,
    menu,
    strip,
    markdown,
    insertMention,
    closeMenu,
  };
}
