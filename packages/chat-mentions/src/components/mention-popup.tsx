"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { MenuState } from "../types";

export interface MentionPopupProps {
  menu: MenuState;
  onSelect?: (item: any, index: number) => void;
}

export function MentionPopup({ menu, onSelect }: MentionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupHeight, setPopupHeight] = useState(0);

  // Measure actual popup height after render
  useEffect(() => {
    if (popupRef.current && menu.open) {
      setPopupHeight(popupRef.current.offsetHeight);
    }
  }, [menu.open, menu.items, menu.loading]);

  // Don't render until items are ready (avoids loading flash + position jump)
  if (!menu.open || !menu.caretRect || menu.loading) return null;

  const GAP = 6;
  const spaceBelow = window.innerHeight - (menu.caretRect.top + menu.caretRect.height);
  const measuredOrEstimate = popupHeight || 160;
  const openAbove = spaceBelow < measuredOrEstimate + GAP;

  const top = openAbove
    ? menu.caretRect.top - measuredOrEstimate - GAP
    : menu.caretRect.top + menu.caretRect.height + GAP;

  const popup = (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        left: menu.caretRect.left,
        top: Math.max(8, top),
        zIndex: 50,
      }}
      className="min-w-[16rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
    >
      {menu.items.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          No results found
        </div>
      ) : (
        menu.items.map((item, index) => (
          <div
            key={item.id}
            className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${
              index === menu.selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent hover:text-accent-foreground"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect?.(item, index);
            }}
          >
            <span className="flex-1">{item.label}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {item.type}
            </span>
          </div>
        ))
      )}
    </div>
  );

  return createPortal(popup, document.body);
}
