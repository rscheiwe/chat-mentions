import { CSSProperties, RefObject } from "react";

/**
 * Basic entity returned by fetch functions
 */
export interface MentionEntity {
  id: string;
  label: string;
  type: string;
}

/**
 * Token with position info in text
 */
export interface MentionToken extends MentionEntity {
  start: number;
  end: number;
  trigger: string;
}

/**
 * Configuration for a single trigger (e.g., '@')
 */
export interface TriggerConfig {
  type: string;
  fetch: (query: string) => Promise<MentionEntity[]>;
  minChars?: number;
  debounce?: number;
  display?: (entity: MentionEntity) => string;
  highlightStyle?: CSSProperties;
}

/**
 * Map of trigger characters to their configs
 */
export type Triggers = Record<string, TriggerConfig>;

/**
 * How mentions persist after send
 */
export type PersistMode = "keep" | "prefix" | "clear";

/**
 * Which UI mode for picker
 */
export type PickerMode = "popup" | "dialog";

/**
 * Menu state for picker UI
 */
export interface MenuState {
  open: boolean;
  trigger: string;
  query: string;
  items: MentionEntity[];
  selectedIndex: number;
  loading: boolean;
  caretRect: DOMRect | null;
}

/**
 * Highlight range for overlay
 */
export interface HighlightRange {
  start: number;
  end: number;
  label: string;
  type: string;
  style?: CSSProperties;
}

/**
 * Config for useMentions hook
 */
export interface UseMentionsConfig {
  value: string;
  onValueChange: (value: string) => void;
  triggers: Triggers;
  onSend?: (payload: SendPayload) => void;
  persistOnSend?: PersistMode;
  picker?: { mode: PickerMode };
}

/**
 * Payload passed to onSend callback
 */
export interface SendPayload {
  text: string;
  mentions: MentionToken[];
  markdown: string;
}

/**
 * Textarea bindings returned by hook
 */
export interface TextareaBindings {
  ref: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCompositionStart?: React.CompositionEventHandler<HTMLTextAreaElement>;
  onCompositionEnd?: React.CompositionEventHandler<HTMLTextAreaElement>;
  onSelect: () => void;
}

/**
 * Result from useMentions hook
 */
export interface UseMentionsResult {
  bind: TextareaBindings;
  tokens: MentionToken[];
  highlights: HighlightRange[];
  menu: MenuState;
  strip: () => string;
  markdown: () => string;
  insertMention: (entity: MentionEntity) => void;
  closeMenu: () => void;
}

/**
 * Diff operation for text changes
 */
export interface DiffOperation {
  type: "insert" | "delete" | "equal";
  text: string;
  position: number;
}
