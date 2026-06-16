import { DiffOperation, MentionToken } from "../types";

/**
 * Compute diff between old and new text
 * Returns list of operations describing the change
 */
export function computeDiff(oldText: string, newText: string): DiffOperation[] {
  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldMiddle = oldText.substring(prefixLen, oldText.length - suffixLen);
  const newMiddle = newText.substring(prefixLen, newText.length - suffixLen);

  const operations: DiffOperation[] = [];

  // Equal prefix
  if (prefixLen > 0) {
    operations.push({
      type: "equal",
      text: oldText.substring(0, prefixLen),
      position: 0,
    });
  }

  // Deletions
  if (oldMiddle.length > 0) {
    operations.push({
      type: "delete",
      text: oldMiddle,
      position: prefixLen,
    });
  }

  // Insertions
  if (newMiddle.length > 0) {
    operations.push({
      type: "insert",
      text: newMiddle,
      position: prefixLen,
    });
  }

  // Equal suffix
  if (suffixLen > 0) {
    operations.push({
      type: "equal",
      text: oldText.substring(oldText.length - suffixLen),
      position: oldText.length - suffixLen,
    });
  }

  return operations;
}

/**
 * Adjust token ranges based on text changes
 * Returns updated tokens (removed if within edit range)
 */
export function adjustTokenRanges(
  tokens: MentionToken[],
  oldText: string,
  newText: string
): MentionToken[] {
  const diff = computeDiff(oldText, newText);

  // Find the edit range
  let editStart = 0;
  let editEnd = oldText.length;
  let deltaLength = newText.length - oldText.length;

  for (const op of diff) {
    if (op.type === "delete" || op.type === "insert") {
      editStart = op.position;
      if (op.type === "delete") {
        editEnd = op.position + op.text.length;
      } else {
        editEnd = op.position;
      }
      break;
    }
  }

  return tokens
    .map((token) => {
      // Token is entirely before edit - no change
      if (token.end <= editStart) {
        return token;
      }

      // Token is entirely after edit - shift by delta
      if (token.start >= editEnd) {
        return {
          ...token,
          start: token.start + deltaLength,
          end: token.end + deltaLength,
        };
      }

      // Token overlaps with edit - remove it
      return null;
    })
    .filter((t): t is MentionToken => t !== null);
}
