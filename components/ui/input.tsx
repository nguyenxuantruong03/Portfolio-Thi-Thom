import * as React from "react";
import { cn } from "@/lib/utils";
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => <input ref={ref} className={cn("h-11 w-full rounded-xl border border-[#1d2c68]/15 bg-white px-4 text-sm outline-none transition focus:border-[#3548e6] focus:ring-4 focus:ring-[#3548e6]/10", className)} {...props} />);
Input.displayName = "Input";
