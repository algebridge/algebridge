/**
 * Where approved story templates live, so each one is written by the AI once
 * and then reused for every student. Server only.
 *
 * The library written ahead of time (src/data/story-library.ts) ships with
 * the app and is always read first. Templates written live go to three
 * layers, each optional:
 *   1. Memory, for this server instance.
 *   2. A JSON file under .cache/ in development, so templates survive a
 *      restart of the dev server (git ignores it).
 *   3. The `story_templates` table in Supabase when SUPABASE_SERVICE_ROLE_KEY
 *      is set (see supabase/schema-story-templates.sql). Only the server
 *      reads and writes it: templates reach students as stories, and a table
 *      students could write to would let anyone put words in front of a class.
 *
 * Without the table, production still gets the memory layer, which a warm
 * serverless instance keeps across many requests.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { STORY_LIBRARY } from "@/data/story-library";

export interface StoredTemplate {
  template: string;
  topic: string;
}

/** How many different templates to keep per shape and interest, for variety. */
const MAX_VARIANTS = 3;

const memory = new Map<string, StoredTemplate[]>();

const FILE = path.join(process.cwd(), ".cache", "story-templates.json");
const useFile = process.env.NODE_ENV !== "production";
let fileLoaded: Promise<void> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function loadFile(): Promise<void> {
  if (!useFile) return Promise.resolve();
  fileLoaded ??= fs
    .readFile(FILE, "utf8")
    .then((raw) => {
      const data = JSON.parse(raw) as Record<string, StoredTemplate[]>;
      for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) memory.set(k, v.slice(0, MAX_VARIANTS));
    })
    .catch(() => {
      /* no file yet */
    });
  return fileLoaded;
}

function scheduleFileWrite() {
  if (!useFile) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void fs
      .mkdir(path.dirname(FILE), { recursive: true })
      .then(() => fs.writeFile(FILE, JSON.stringify(Object.fromEntries(memory), null, 1)))
      .catch(() => {
        /* a read-only disk just means memory only */
      });
  }, 400);
}

// --- Supabase, when the server holds the service key ----------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useTable = Boolean(SUPABASE_URL && SERVICE_KEY);

/** Table rows are keyed by a hash: shapes contain braces, commas and spaces. */
function rowKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

function tableHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function readTable(keys: string[]): Promise<Map<string, StoredTemplate[]>> {
  const out = new Map<string, StoredTemplate[]>();
  if (!useTable || !keys.length) return out;
  const byHash = new Map(keys.map((k) => [rowKey(k), k]));
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/story_templates?select=key,template,topic&key=in.(${[...byHash.keys()].join(",")})`,
      { headers: tableHeaders(), signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return out;
    for (const row of (await res.json()) as { key: string; template: string; topic: string }[]) {
      const key = byHash.get(row.key);
      if (!key) continue;
      const list = out.get(key) ?? [];
      if (list.length < MAX_VARIANTS) list.push({ template: row.template, topic: row.topic });
      out.set(key, list);
    }
  } catch {
    /* the memory layer still answers */
  }
  return out;
}

async function writeTable(key: string, signature: string, value: StoredTemplate): Promise<void> {
  if (!useTable) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/story_templates`, {
      method: "POST",
      headers: { ...tableHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ key: rowKey(key), signature, topic: value.topic, template: value.template }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* kept in memory regardless */
  }
}

// --- The store --------------------------------------------------------------

/** Every stored template for these keys: the shipped library, then live ones. */
export async function getTemplates(keys: string[]): Promise<Map<string, StoredTemplate[]>> {
  await loadFile();
  const out = new Map<string, StoredTemplate[]>();
  const missing: string[] = [];
  for (const k of keys) {
    const hit = memory.get(k);
    if (hit?.length) out.set(k, hit);
    else missing.push(k);
  }
  if (missing.length) {
    for (const [k, v] of await readTable(missing)) {
      memory.set(k, v);
      out.set(k, v);
    }
  }
  for (const k of keys) {
    const shipped = STORY_LIBRARY[k];
    if (!shipped?.length) continue;
    const live = (out.get(k) ?? []).filter((t) => !shipped.some((s) => s.template === t.template));
    out.set(k, [...shipped, ...live]);
  }
  return out;
}

/** Keeps an approved template, up to a few different ones per key. */
export async function saveTemplate(key: string, signature: string, value: StoredTemplate): Promise<void> {
  await loadFile();
  const list = memory.get(key) ?? [];
  if (list.some((t) => t.template === value.template)) return;
  if (list.length >= MAX_VARIANTS) return;
  memory.set(key, [...list, value]);
  scheduleFileWrite();
  await writeTable(key, signature, value);
}

/** How many templates are held right now, for the status check. */
export function storeSize(): { shipped: number; live: number; table: boolean } {
  let live = 0;
  for (const v of memory.values()) live += v.length;
  const shipped = Object.values(STORY_LIBRARY).reduce((n, v) => n + v.length, 0);
  return { shipped, live, table: useTable };
}
