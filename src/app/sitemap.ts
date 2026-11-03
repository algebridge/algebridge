import type { MetadataRoute } from "next";
import { units } from "@/data/curriculum";

const BASE = "https://learn.algebridge.org";
const PAGES = ["", "/try", "/schools", "/safety", "/privacy", "/terms", "/guidelines", "/accessibility"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...PAGES.map((path) => ({ url: `${BASE}${path}` })),
    ...units.flatMap((unit) => unit.skills.map((skill) => ({ url: `${BASE}/learn/${unit.id}/${skill.id}` }))),
  ];
}
