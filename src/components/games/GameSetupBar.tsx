"use client";

import { allUnits, units } from "@/data/curriculum";
import { Icon } from "@/components/Icon";
import { topicSkills, type GameSetup, type GameTopic } from "@/lib/game-session";
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
}: {
  setup: GameSetup;
  /** A change to the setup, merged into the latest one. */
  onChange: (patch: Partial<GameSetup>) => void;
  progress: UserProgress | null;
  disabled: boolean;
}) {
  const here = progress ? rinkSkillIds(progress) : null;
  const unitTitle = here ? allUnits().find((u) => u.id === here.unitId)?.title : null;
  const byUnit = units
    .map((u) => ({ unit: u, skills: topicSkills().filter((t) => t.unitId === u.id) }))
    .filter((g) => g.skills.length);
  const seg = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
      active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <fieldset disabled={disabled} className="card space-y-3 disabled:opacity-60">
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
            {([1, 2] as const).map((nPlayers) => (
              <button
                key={nPlayers}
                type="button"
                role="radio"
                aria-checked={setup.players === nPlayers}
                onClick={() => onChange({ players: nPlayers })}
                className={seg(setup.players === nPlayers)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {nPlayers === 2 && <Icon name="versus" size={15} />}
                  {nPlayers === 1 ? "1 player" : "2 players"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {setup.players === 2 && (
        <p className="text-sm text-slate-600">
          Two players on this computer. Press Play, type your names and pick who you play as. Player 1 moves with W A S D, Player 2 with the arrow
          keys, or each drags on their own half of a touch screen. Whoever reaches the question first answers, and a miss lets the other player
          steal it. Matches are played for the win; Bridgeys come from 1-player games.
        </p>
      )}
    </fieldset>
  );
}
