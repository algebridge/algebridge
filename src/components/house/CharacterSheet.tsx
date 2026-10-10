"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { AvatarStage } from "@/components/house/AvatarStage";
import { BOTTOMS, BUILDS, CLOTHES_COLORS, COLOR_NAMES, EXTRAS, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, HEIGHTS, randomAvatar, SKIN_TONES, TOPS, type Choice } from "@/lib/avatar";
import type { AvatarSpec } from "@/types";

/**
 * Making your character: a figure on a turntable and the choices beside it,
 * each one shown the moment it is picked. Saved when you say so; closed
 * without saving otherwise.
 */
export function CharacterSheet({ initial, name, onSave, onClose }: { initial: AvatarSpec; name: string | null; onSave: (spec: AvatarSpec) => void; onClose: () => void }) {
  const [spec, setSpec] = useState<AvatarSpec>(initial);
  const set = (patch: Partial<AvatarSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const toggleExtra = (id: string) => setSpec((s) => ({ ...s, extras: s.extras.includes(id) ? s.extras.filter((e) => e !== id) : [...s.extras, id] }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="character-title" className="animate-modal-in flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="eyebrow">Your character</p>
            <h2 id="character-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              {name ?? "Make it you"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">{name ? "Stands on your porch and walks the street. Your neighbors see them by your house." : "Stands on your porch and walks the street. Sign in, and your neighbors see them by your house."}</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[240px_1fr]">
          <div className="h-56 shrink-0 bg-gradient-to-b from-[#eef1f5] to-[#dfe4ea] sm:h-auto">
            <AvatarStage spec={spec} className="h-full w-full" />
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            <Group label="Skin">
              <Swatches colors={SKIN_TONES} value={spec.skin} onPick={(skin) => set({ skin })} />
            </Group>
            <Group label="Hair">
              <Chips choices={HAIR_STYLES} value={spec.hair} onPick={(hair) => set({ hair })} />
              <Swatches colors={HAIR_COLORS} value={spec.hairColor} onPick={(hairColor) => set({ hairColor })} />
            </Group>
            <Group label="Eyes">
              <Swatches colors={EYE_COLORS} value={spec.eyes} onPick={(eyes) => set({ eyes })} />
            </Group>
            <Group label="Top">
              <Chips choices={TOPS} value={spec.top} onPick={(top) => set({ top })} />
              <Swatches colors={CLOTHES_COLORS} value={spec.topColor} onPick={(topColor) => set({ topColor })} />
            </Group>
            <Group label="Bottom">
              <Chips choices={BOTTOMS} value={spec.bottom} onPick={(bottom) => set({ bottom })} />
              <Swatches colors={CLOTHES_COLORS} value={spec.bottomColor} onPick={(bottomColor) => set({ bottomColor })} />
            </Group>
            <Group label="Shoes">
              <Swatches colors={CLOTHES_COLORS} value={spec.shoes} onPick={(shoes) => set({ shoes })} />
            </Group>
            <Group label="Extras">
              <div className="flex flex-wrap gap-1.5">
                {EXTRAS.map((e) => (
                  <button key={e.id} type="button" onClick={() => toggleExtra(e.id)} aria-pressed={spec.extras.includes(e.id)} className={`btn-sm ${spec.extras.includes(e.id) ? "btn-primary" : "btn-secondary"}`}>
                    {e.label}
                  </button>
                ))}
              </div>
            </Group>
            <div className="grid grid-cols-2 gap-4">
              <Group label="Build">
                <Chips choices={BUILDS} value={spec.build} onPick={(build) => set({ build: build as AvatarSpec["build"] })} />
              </Group>
              <Group label="Height">
                <Chips choices={HEIGHTS} value={spec.height} onPick={(height) => set({ height: height as AvatarSpec["height"] })} />
              </Group>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={() => setSpec(randomAvatar())} className="btn-ghost btn-sm">
            <Icon name="spark" size={15} />
            Surprise me
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancel
            </button>
            <button type="button" onClick={() => onSave(spec)} className="btn-primary btn-sm">
              <Icon name="check" size={15} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mb-4">
      <p className="mb-1.5 text-xs font-semibold text-slate-700">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Chips({ choices, value, onPick }: { choices: Choice[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c.id)} aria-pressed={value === c.id} className={`btn-sm ${value === c.id ? "btn-primary" : "btn-secondary"}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (hex: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onPick(hex)}
          aria-label={COLOR_NAMES[hex] ?? hex}
          aria-pressed={value === hex}
          className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${value === hex ? "ring-bridge-600" : "ring-transparent hover:ring-slate-300"}`}
          style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
        />
      ))}
    </div>
  );
}
