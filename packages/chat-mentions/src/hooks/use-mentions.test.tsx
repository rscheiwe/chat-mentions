/**
 * @vitest-environment jsdom
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MentionHighlights } from "../components/mention-highlights";
import type { MentionEntity, Triggers, UseMentionsResult } from "../types";
import { useMentions } from "./use-mentions";

if (!globalThis.DOMRect) {
  globalThis.DOMRect = class TestDOMRect {
    bottom: number;
    left: number;
    right: number;
    top: number;

    constructor(
      public x = 0,
      public y = 0,
      public width = 1,
      public height = 20
    ) {
      this.left = x;
      this.top = y;
      this.right = x + width;
      this.bottom = y + height;
    }

    toJSON() {
      return {
        bottom: this.bottom,
        height: this.height,
        left: this.left,
        right: this.right,
        top: this.top,
        width: this.width,
        x: this.x,
        y: this.y,
      };
    }
  } as typeof DOMRect;
}

const coder: MentionEntity = {
  id: "coder",
  label: "Coder",
  type: "agent",
};

afterEach(() => {
  cleanup();
});

function changeTextarea(
  textarea: HTMLTextAreaElement,
  value: string,
  selectionStart = value.length
) {
  fireEvent.change(textarea, {
    target: {
      value,
      selectionStart,
      selectionEnd: selectionStart,
    },
  });
}

function MentionHarness({
  fetchItems,
  onSnapshot,
}: {
  fetchItems: Triggers["@"]["fetch"];
  onSnapshot: (mention: UseMentionsResult) => void;
}) {
  const [value, setValue] = useState("");
  const mention = useMentions({
    value,
    onValueChange: setValue,
    triggers: {
      "@": {
        type: "agent",
        fetch: fetchItems,
      },
    },
  });

  useEffect(() => {
    onSnapshot(mention);
  }, [mention, onSnapshot]);

  return <textarea aria-label="mention input" {...mention.bind} />;
}

describe("useMentions", () => {
  it("keeps tokens aligned when text is inserted before a mention", async () => {
    let latest: UseMentionsResult | null = null;
    const fetchItems = vi.fn(async () => [coder]);

    render(
      <MentionHarness
        fetchItems={fetchItems}
        onSnapshot={(mention) => {
          latest = mention;
        }}
      />
    );

    const textarea = screen.getByLabelText("mention input") as HTMLTextAreaElement;
    changeTextarea(textarea, "@Co");

    await waitFor(() => {
      expect(latest?.menu.items).toEqual([coder]);
    });

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(latest?.tokens).toHaveLength(1);
    });

    const insertedValue = textarea.value;
    changeTextarea(textarea, `hi ${insertedValue}`, 3);

    await waitFor(() => {
      expect(latest?.tokens[0]?.start).toBe(3);
    });
    expect(latest?.strip()).toBe("hi");
    expect(latest?.markdown().trim()).toBe("hi @[Coder](agent:coder)");
  });

  it("removes an inserted mention with one backspace from the trailing gap", async () => {
    let latest: UseMentionsResult | null = null;
    const fetchItems = vi.fn(async () => [coder]);

    render(
      <MentionHarness
        fetchItems={fetchItems}
        onSnapshot={(mention) => {
          latest = mention;
        }}
      />
    );

    const textarea = screen.getByLabelText("mention input") as HTMLTextAreaElement;
    changeTextarea(textarea, "@Co");

    await waitFor(() => {
      expect(latest?.menu.items).toEqual([coder]);
    });

    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => {
      expect(latest?.tokens).toHaveLength(1);
    });

    fireEvent.keyDown(textarea, { key: "Backspace" });

    await waitFor(() => {
      expect(latest?.tokens).toEqual([]);
    });
    expect(textarea.value).toBe("");
    expect(latest?.strip()).toBe("");
  });

  it("ignores stale mention fetch results", async () => {
    let latest: UseMentionsResult | null = null;
    let resolveA: (items: MentionEntity[]) => void = () => {};
    let resolveAl: (items: MentionEntity[]) => void = () => {};
    const alpha = { id: "alpha", label: "Alpha", type: "agent" };
    const analyst = { id: "analyst", label: "Analyst", type: "agent" };
    const fetchItems = vi.fn((query: string) => {
      return new Promise<MentionEntity[]>((resolve) => {
        if (query === "a") resolveA = resolve;
        if (query === "al") resolveAl = resolve;
      });
    });

    render(
      <MentionHarness
        fetchItems={fetchItems}
        onSnapshot={(mention) => {
          latest = mention;
        }}
      />
    );

    const textarea = screen.getByLabelText("mention input") as HTMLTextAreaElement;
    changeTextarea(textarea, "@a");
    changeTextarea(textarea, "@al");

    await waitFor(() => {
      expect(fetchItems).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveAl([analyst]);
    });

    await waitFor(() => {
      expect(latest?.menu.items).toEqual([analyst]);
    });

    await act(async () => {
      resolveA([alpha]);
    });

    await waitFor(() => {
      expect(latest?.menu.items).toEqual([analyst]);
    });
  });
});

describe("MentionHighlights", () => {
  it("renders untrusted highlight text and attributes without HTML injection", async () => {
    const text = '<img src=x onerror="alert(1)">';
    const maliciousType = 'agent" onclick="alert(1)';

    function HighlightHarness() {
      const textareaRef = useRef<HTMLTextAreaElement>(null);

      return (
        <>
          <textarea ref={textareaRef} defaultValue={text} />
          <MentionHighlights
            textareaRef={textareaRef}
            overlay={[
              {
                start: 0,
                end: text.length,
                label: text,
                type: maliciousType,
              },
            ]}
          />
        </>
      );
    }

    const { container } = render(<HighlightHarness />);

    await waitFor(() => {
      expect(container.querySelector(".mention-highlight")?.textContent).toBe(
        text
      );
    });

    const highlight = container.querySelector(".mention-highlight");
    expect(highlight?.getAttribute("data-mention-type")).toBe(maliciousType);
    expect(container.querySelector("img")).toBeNull();
  });
});
