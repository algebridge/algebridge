import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, with later classes winning conflicts.
 * The shadcn/21st.dev convention, components pasted from there expect it at
 * this exact path, so keep it here even though most of this app uses the
 * component classes in globals.css instead.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
