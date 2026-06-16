import { describe, expect, it } from "vitest";
import type { MentionToken } from "../types";
import { adjustTokenRanges } from "./diff";

const token = (overrides: Partial<MentionToken> = {}): MentionToken => ({
  id: "coder",
  label: "Coder",
  type: "agent",
  trigger: "@",
  start: 6,
  end: 12,
  ...overrides,
});

describe("adjustTokenRanges", () => {
  it("shifts tokens after inserted text", () => {
    const adjusted = adjustTokenRanges(
      [token()],
      "hello @Coder",
      "hello brave @Coder"
    );

    expect(adjusted).toEqual([token({ start: 12, end: 18 })]);
  });

  it("shifts tokens after deleted text", () => {
    const adjusted = adjustTokenRanges([token()], "hello @Coder", "hi @Coder");

    expect(adjusted).toEqual([token({ start: 3, end: 9 })]);
  });

  it("removes tokens edited internally", () => {
    const adjusted = adjustTokenRanges([token()], "hello @Coder", "hello @Cder");

    expect(adjusted).toEqual([]);
  });

  it("preserves unaffected tokens and removes touched tokens", () => {
    const first = token({ id: "alpha", label: "Alpha", start: 0, end: 6 });
    const second = token({ id: "beta", label: "Beta", start: 11, end: 16 });

    const adjusted = adjustTokenRanges(
      [first, second],
      "@Alpha and @Beta",
      "@Alpha plus @Beta"
    );

    expect(adjusted).toEqual([
      first,
      { ...second, start: 12, end: 17 },
    ]);
  });
});
