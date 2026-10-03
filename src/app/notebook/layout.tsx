import type { ReactNode } from "react";

export const metadata = { title: "My notebook" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
