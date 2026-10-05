"use client";

import { units } from "@/data/curriculum";
import { Icon } from "@/components/Icon";
import { MATCH_LENGTHS, SIDE_COLORS, topicSkills, type GameSetup, type GameTopic } from "@/lib/game-session";
import { rinkSkillIds } from "@/lib/rink";
import type { UserProgress } from "@/types";

const topicValue = (t: GameTopic) => (t.kind === "skill" ? `skill:${t.skillId}` : t.kind);

function topicFrom(value: string): GameTopic {
  if (value === "jumbo") return { kind: "jumbo" };
  if (value.startsWith("skill:")) return { kind: "skill", skillId: value.slice(6) };
  return { kind: "unit" };
}

/**
 * Under the court, before play: what the questions are about, and how many
 * are playing. Any topic in the course with head-math problems can be
 * picked on its own, or all of them at once (Jumbo). Two players share the
 * keyboard: WASD and the arrows, or each half of a touch screen.
 */
export function GameSetupBar({
  setup,
  onChange,
  progress,
  disabled,
  host,
  partner,
}: {
  setup: GameSetup;
  /** A change to the setup, merged into the latest one. */
  onChange: (patch: Partial<GameSetup>) => void;
  progress: UserProgress | null;
  disabled: boolean;
  /** Who each side plays as: the game's own player and the teammate who joins them. */
  host: string;
  partner: string;
}) {
  const here = progress ? rinkSkillIds(progress) : null;
  const unitTitle = here ? units.find((u) => u.id === here.unitId)?.title : null;
  const byUnit = units
    .map((u) => ({ unit: u, skills: topicSkills().filter((t) => t.unitId === u.id) }))
    .filter((g) => g.skills.length);
  const seg = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
      active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <fieldset disabled={disabled} className="card space-y-4 disabled:opacity-60">
      <legend className="sr-only">Set up the game</legend>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="min-w-[16rem] flex-1">
          <span className="text-sm font-semibold text-slate-900">Questions about</span>
          <select
            value={topicValue(setup.topic)}
            onChange={(e) => onChange({ topic: topicFrom(e.target.value) })}
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-[15px] focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          >
            <option value="unit">{here ? `The unit you are on: Unit ${here.unitNumber}${unitTitle ? `, ${unitTitle}` : ""}` : "The unit you are on"}</option>
            <option value="jumbo">Jumbo: every topic in the course, mixed</option>
            {byUnit.map(({ unit, skills }) => (
              <optgroup key={unit.id} label={`Unit ${unit.number}: ${unit.title}`}>
                {skills.map((t) => (
                  <option key={t.skillId} value={`skill:${t.skillId}`}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div>
          <span className="block text-sm font-semibold text-slate-900">Players</span>
          <div role="radiogroup" aria-label="Players" className="mt-1 inline-flex rounded-xl bg-slate-100 p-1">
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={setup.players === n}
                onClick={() => onChange({ players: n })}
                className={seg(setup.players === n)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {n === 2 && <Icon name="versus" size={15} />}
                  {n === 1 ? "1 player" : "2 players"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {setup.players === 2 && (
          <div>
            <span className="block text-sm font-semibold text-slate-900">First to</span>
            <div role="radiogroup" aria-label="Points to win" className="mt-1 inline-flex rounded-xl bg-slate-100 p-1">
              {MATCH_LENGTHS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={setup.toWin === n} onClick={() => onChange({ toWin: n })} className={seg(setup.toWin === n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {setup.players === 2 && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {([0, 1] as const).map((side) => (
              <label key={side} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: SIDE_COLORS[side] }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-500">
                    Player {side + 1} plays {side === 0 ? host : partner} · {side === 0 ? "W A S D" : "arrow keys"}
                  </span>
                  <input
                    value={setup.names[side]}
                    onChange={(e) => {
                      const names: [string, string] = [...setup.names];
                      names[side] = e.target.value.slice(0, 14);
                      onChange({ names });
                    }}
                    placeholder={`Player ${side + 1}`}
                    aria-label={`Player ${side + 1}'s name`}
                    maxLength={14}
                    autoComplete="off"
                    className="mt-0.5 w-full bg-transparent text-[15px] font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                  />
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            Race to each question on this keyboard. On a touch screen, each player drags on their own half. Whoever gets there first answers, and a miss
            lets the other player steal it. Matches are played for the win; Bridgeys come from 1-player games.
          </p>
        </div>
      )}
    </fieldset>
  );
}
