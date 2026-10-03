import type { ReactNode } from "react";

export const metadata = { title: "My classes" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
