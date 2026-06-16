import { MentionToken } from "../types";

/**
 * Serialize text with mentions into markdown format
 * Format: @[Label](type:id)
 */
export function serializeMarkdown(text: string, tokens: MentionToken[]): string {
  if (tokens.length === 0) return text;

  // Sort tokens by start position (descending) to replace from end to start
  const sortedTokens = [...tokens].sort((a, b) => b.start - a.start);

  let result = text;

  for (const token of sortedTokens) {
    const before = result.substring(0, token.start);
    const after = result.substring(token.end);
    const markdown = `${token.trigger}[${token.label}](${token.type}:${token.id})`;
    result = before + markdown + after;
  }

  return result;
}

/**
 * Parse markdown mentions back into tokens
 * Format: @[Label](type:id)
 * Returns tokens with positions in the parsed text
 */
export function parseMarkdown(markdown: string): {
  text: string;
  tokens: MentionToken[];
} {
  const mentionRegex = /([#@/])\[([^\]]+)\]\(([^:]+):([^)]+)\)/g;
  const tokens: MentionToken[] = [];
  let text = markdown;
  let offset = 0;

  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(markdown)) !== null) {
    const [fullMatch, trigger, label, type, id] = match;
    const markdownStart = match.index;
    const textStart = markdownStart - offset;

    // Replace markdown with just the trigger + label in text
    const replacement = `${trigger}${label}`;
    text = text.substring(0, textStart) + replacement + text.substring(textStart + fullMatch.length);

    tokens.push({
      id,
      label,
      type,
      trigger,
      start: textStart,
      end: textStart + replacement.length,
    });

    // Adjust offset for next iteration
    offset += fullMatch.length - replacement.length;
  }

  return { text, tokens };
}
