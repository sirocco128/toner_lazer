"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="system"
      position="top-center"
      richColors
      closeButton
      offset="5rem"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border border-forest/10 bg-paper/90 text-ink shadow-lg backdrop-blur-md",
          description: "text-ink/70",
          actionButton: "bg-forest text-paper",
          cancelButton: "bg-forest-mist text-forest",
        },
      }}
    />
  );
}
