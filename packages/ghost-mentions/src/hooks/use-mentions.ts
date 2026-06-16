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
  // Mirror tokens in a ref so every closure reads the latest value
  const tokensRef = useRef<MentionToken[]>(tokens);
  const updateTokens = (
    updater: MentionToken[] | ((prev: MentionToken[]) => MentionToken[])
  ) => {
    setTokens((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      tokensRef.current = next;
      return next;
    });
  };

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
  const fetchRequestIdRef = useRef(0);
  const previousValueRef = useRef<string>(value);
  const triggerStartRef = useRef<number>(0);
  const isComposingRef = useRef(false);

  // When the DOM changes the caret (e.g., setRangeText), record it here and restore
  // after the controlled value re-renders.
  const pendingCaretRef = useRef<number | null>(null);

  // ---------- utilities (always read from tokensRef) ----------
  const inToken = (pos: number) =>
    tokensRef.current.find((t) => pos > t.start && pos <= t.end);

  const tokenAtOrAdjacentForBackspace = (pos: number) =>
    tokensRef.current.find(
      (t) => pos === t.end || (pos > t.start && pos <= t.end)
    );

  const tokenRangeForBackspace = (pos: number, text: string) => {
    const token = tokenAtOrAdjacentForBackspace(pos);
    if (token) return { start: token.start, end: token.end };

    const tokenBeforeGap = tokensRef.current.find((t) => {
      if (pos <= t.end) return false;
      const gap = text.slice(t.end, pos);
      return gap.length > 0 && /^\s+$/.test(gap);
    });

    return tokenBeforeGap
      ? { start: tokenBeforeGap.start, end: pos }
      : null;
  };

  const tokenAtOrAdjacentForDelete = (pos: number) =>
    tokensRef.current.find(
      (t) => pos === t.start || (pos >= t.start && pos < t.end)
    );

  const deleteTokenRange = (start: number, end: number) => {
    const ta = textareaRef.current!;
    const removedLen = end - start;

    // Atomic DOM delete moves caret to "start"
    ta.setRangeText("", start, end, "start");
    const afterDeletePos = ta.selectionStart;
    pendingCaretRef.current = afterDeletePos;

    // Shift remaining tokens and drop intersected ones
    updateTokens((prev) =>
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
      const currentTokens = tokensRef.current;
      for (let i = caretPos - 1; i >= 0; i--) {
        // Skip positions inside existing tokens so we don't re-detect their trigger char
        const hitToken = currentTokens.find(
          (t) => i >= t.start && i < t.end
        );
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

            // If the menu is already open with the same trigger+query,
            // just update the caret position — don't re-fetch or reset loading.
            if (menu.open && menu.trigger === ch && menu.query === query) {
              setMenu((m) => ({ ...m, caretRect }));
              return;
            }

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
            const requestId = ++fetchRequestIdRef.current;
            const fetchItems = async () => {
              try {
                const items = query.length >= min ? await cfg.fetch(query) : [];
                setMenu((m) => {
                  if (
                    requestId !== fetchRequestIdRef.current ||
                    !m.open ||
                    m.trigger !== ch ||
                    m.query !== query
                  ) {
                    return m;
                  }
                  return { ...m, items, loading: false };
                });
              } catch (e) {
                console.error("mention fetch failed", e);
                setMenu((m) => {
                  if (
                    requestId !== fetchRequestIdRef.current ||
                    !m.open ||
                    m.trigger !== ch ||
                    m.query !== query
                  ) {
                    return m;
                  }
                  return { ...m, items: [], loading: false };
                });
              }
            };
            const delay = cfg.debounce ?? 0;
            if (delay > 0) {
              debounceTimerRef.current = setTimeout(fetchItems, delay);
            } else {
              fetchItems();
            }
            return;
          }
        }
        if (/\s/.test(ch)) break; // stop at whitespace
      }

      if (menu.open) {
        fetchRequestIdRef.current += 1;
        clearTimeout(debounceTimerRef.current);
        setMenu((m) => ({ ...m, open: false }));
      }
    },
    [triggers, menu.open, menu.trigger, menu.query]
  );

  useEffect(() => {
    return () => {
      fetchRequestIdRef.current += 1;
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ---------- external value sync ----------
  useEffect(() => {
    if (value === previousValueRef.current) return;
    const adjusted = adjustTokenRanges(
      tokensRef.current,
      previousValueRef.current,
      value
    );
    previousValueRef.current = value;
    updateTokens(adjusted);
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
      const prev = previousValueRef.current;
      if (next !== prev) {
        const adjusted = adjustTokenRanges(tokensRef.current, prev, next);
        updateTokens(adjusted);
      }
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
      // Pad with em-spaces so the pill has real character-width padding
      // that the cursor respects (CSS padding can't move a textarea caret)
      const PAD = "\u2003"; // em space
      const paddedToken = `${PAD}${tokenText}${PAD}`;
      const replacement = `${paddedToken}   `; // trailing spaces for cursor gap

      // 1) Replace in DOM; browser updates caret atomically
      ta.setRangeText(replacement, triggerStart, caretPos, "end");
      pendingCaretRef.current = ta.selectionStart; // capture true caret

      const newValue = ta.value;

      // 2) Shift existing tokens & add new token (token covers padded range)
      const removedLen = caretPos - triggerStart;
      const delta = replacement.length - removedLen;

      const newToken: MentionToken = {
        ...entity,
        trigger: menu.trigger,
        start: triggerStart,
        end: triggerStart + paddedToken.length,
      };

      updateTokens((prev) => {
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
          const currentTokens = tokensRef.current;
          const payload = {
            text: strip(),
            mentions: currentTokens,
            markdown: markdown(),
          };

          if (persistOnSend === "clear") {
            updateTokens([]);
            previousValueRef.current = "";
            onValueChange("");
          } else if (persistOnSend === "prefix") {
            // move mentions to front as raw text
            const ordered = [...currentTokens].sort(
              (a, b) => a.start - b.start
            );
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
            updateTokens(remapped);
            previousValueRef.current = next;
            onValueChange(next);
          }
          onSend(payload);
        }
        return;
      }

      // Atomistic deletion with selection spanning tokens
      const currentTokens = tokensRef.current;
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        posStart !== posEnd
      ) {
        const touched = currentTokens.filter(
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
        const range = tokenRangeForBackspace(posStart, ta.value);
        if (range) {
          e.preventDefault();
          deleteTokenRange(range.start, range.end);
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
      value,
    ]
  );

  // ---------- strip & markdown ----------
  const strip = useCallback((): string => {
    const currentTokens = tokensRef.current;
    if (!currentTokens.length) return value.trim();
    const ordered = [...currentTokens].sort((a, b) => a.start - b.start);
    let out = "";
    let idx = 0;
    for (const t of ordered) {
      out += value.slice(idx, t.start);
      idx = t.end;
    }
    out += value.slice(idx);
    return out.trim();
  }, [value]);

  const markdown = useCallback((): string => {
    return serializeMarkdown(value, tokensRef.current);
  }, [value]);

  // ---------- highlights for overlay ----------
  // Extend highlight to include trailing space so the cursor sits at the pill edge, not inside it
  const highlights: HighlightRange[] = tokens.map((t) => {
    const cfg = triggers[t.trigger];
    return {
      start: t.start,
      end: t.end < value.length && value[t.end] === " " ? t.end + 1 : t.end,
      label: t.label,
      type: t.type,
      ...(cfg?.highlightStyle ? { style: cfg.highlightStyle } : {}),
    };
  });

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
