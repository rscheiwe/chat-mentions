"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { MenuState } from "../types";

export interface MentionDialogProps {
  menu: MenuState;
  onSelect?: (item: any) => void;
  onClose?: () => void;
}

export function MentionDialog({ menu, onSelect, onClose }: MentionDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = searchQuery
    ? menu.items.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : menu.items;

  return (
    <Dialog.Root open={menu.open} onOpenChange={(open) => !open && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
          <Dialog.Title className="text-lg font-semibold">
            Select {menu.trigger} mention
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">
            Choose from the list below
          </Dialog.Description>

          <div className="mt-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
          </div>

          <div className="mt-4 max-h-[300px] overflow-y-auto">
            {menu.loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect?.(item);
                      onClose?.();
                    }}
                    className="flex items-center justify-between rounded-md border border-input bg-background p-3 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <span className="sr-only">Close</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
