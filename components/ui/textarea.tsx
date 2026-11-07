import * as React from "react";
import { cn } from "@/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => <textarea ref={ref} className={cn("min-h-32 w-full resize-y rounded-xl border border-[#1d2c68]/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3548e6] focus:ring-4 focus:ring-[#3548e6]/10", className)} {...props} />);
Textarea.displayName = "Textarea";
