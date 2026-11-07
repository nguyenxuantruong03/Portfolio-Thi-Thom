"use client";

import { Toaster as SonnerToaster } from "sonner";
import type { ComponentProps } from "react";

export function Toaster(props: ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      duration={3500}
      toastOptions={{
        classNames: {
          toast: "font-sans",
          title: "font-semibold",
          description: "text-sm",
        },
      }}
      {...props}
    />
  );
}
