/**
 * Get the DOM rect for the current caret position in a textarea
 * Uses the mirror div technique to compute accurate position
 */
export function getCaretRect(textarea: HTMLTextAreaElement): DOMRect {
  const { selectionStart, value } = textarea;

  // Create mirror div with exact same styling
  const mirror = document.createElement("div");
  const computed = window.getComputedStyle(textarea);

  // Copy all relevant styles
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";

  // Copy font and size properties
  const properties = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "textTransform",
    "wordSpacing",
    "textIndent",
    "padding",
    "border",
    "lineHeight",
    "width",
  ] as const;

  properties.forEach((prop) => {
    mirror.style[prop] = computed[prop];
  });

  // Set text up to caret
  const textBeforeCaret = value.substring(0, selectionStart);
  mirror.textContent = textBeforeCaret;

  // Create caret marker
  const caret = document.createElement("span");
  caret.textContent = "|";
  mirror.appendChild(caret);

  document.body.appendChild(mirror);

  // Get caret position within mirror
  const caretSpan = mirror.querySelector('span') || caret;
  const caretOffsetTop = caretSpan.offsetTop;
  const caretOffsetLeft = caretSpan.offsetLeft;

  document.body.removeChild(mirror);

  // Calculate absolute position relative to textarea
  const textareaRect = textarea.getBoundingClientRect();
  const adjustedTop = textareaRect.top + caretOffsetTop - textarea.scrollTop;
  const adjustedLeft = textareaRect.left + caretOffsetLeft - textarea.scrollLeft;

  return new DOMRect(
    adjustedLeft,
    adjustedTop,
    1,
    parseInt(computed.lineHeight) || 20
  );
}
