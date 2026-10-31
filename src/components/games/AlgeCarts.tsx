"use client";

import { useEffect, useRef, useState } from "react";
import { GameProblemDialog, type GameVerdict } from "@/components/games/GameProblemDialog";
import { awardRinkBridgeys } from "@/lib/bridgeys";
import { DAILY_GOAL } from "@/lib/gamification";
import { answerIsRight } from "@/lib/grading";
import { fireConfetti, showToast } from "@/lib/notify";
import { today } from "@/lib/path";
import { getProgress } from "@/lib/progress";
import { pickRinkProblem, type RinkProblem } from "@/lib/rink";
import { createGame } from "@/lib/algecarts/engine/Game";
import { applyRewards, levelOf, matchRewards, type Profile } from "@/lib/algecarts/engine/profile";
import type { ArenaId, GameHandle, HudState, WeaponId } from "@/lib/algecarts/engine/types";
import { ARENA_ORDER } from "@/lib/algecarts/engine/world/arenas";
import { BridgeysProfileStore } from "@/lib/algecarts/bridgeysStore";
import { Garage } from "@/lib/algecarts/ui/garage";
import { Hud } from "@/lib/algecarts/ui/hud";
import { ICON_SOUND_OFF, ICON_SOUND_ON } from "@/lib/algecarts/ui/icons";
import { Scoreboard } from "@/lib/algecarts/ui/scoreboard";
import { TouchInput } from "@/lib/algecarts/ui/touch";
import "@/lib/algecarts/carts.css";

const ARENA_KEY = "algebridge:carts:arena";

interface Pending {
  resolve: (w: WeaponId | null) => void;
  suggested: WeaponId;
}

/**
 * The kart arena on AlgeBridge: the engine and its garage, HUD and results
 * (plain DOM, from lib/algecarts) inside one fixed box, with the problem a
 * `?` box stops for drawn by GameProblemDialog over it. A right answer loads
 * the booster and pays like every other game, up to the shared daily cap; a
 * wrong one leaves the box empty. The game pauses while the card is up.
 */
export function AlgeCarts({ userId, name, onExit }: { userId: string; name: string; onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const hudRef = useRef<Hud | null>(null);
  const garageRef = useRef<Garage | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const storeRef = useRef<BridgeysProfileStore | null>(null);
  const pending = useRef<Pending | null>(null);
  const seen = useRef(new Set<string>());
  const sessionPaid = useRef(0);
  const [open, setOpen] = useState<RinkProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<GameVerdict | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    const store = new BridgeysProfileStore(userId, name);
    storeRef.current = store;
    const canvas = document.createElement("canvas");
    canvas.className = "game";
    canvas.tabIndex = -1;
    root.appendChild(canvas);
    let cleanup: (() => void) | null = null;

    void (async () => {
      const profile = (await store.load())!;
      if (disposed) return;
      profileRef.current = profile;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const lowPower = coarse || (navigator.hardwareConcurrency ?? 8) <= 4;
      const hud = new Hud(root);
      hudRef.current = hud;
      const touch = coarse ? new TouchInput(root) : null;
      let joined = false;
      let saveTimer: ReturnType<typeof setTimeout> | null = null;
      const saveSoon = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => void store.save(profile), 250);
      };
      const savedArena = (localStorage.getItem(ARENA_KEY) as ArenaId | "random" | null) ?? "random";
      const startArena: ArenaId = savedArena !== "random" && ARENA_ORDER.includes(savedArena) ? savedArena : ARENA_ORDER[Math.floor(Math.random() * ARENA_ORDER.length)];

      const game = createGame(canvas, {
        arena: startArena,
        bots: 7,
        quality: lowPower ? "low" : "high",
        sound: profile.settings.sound,
        hooks: {
          onHud: (s: HudState) => {
            hud.update(s);
            scoreboard.update(s);
          },
          // The math gate: a head-math problem from the unit the student is on.
          requestBooster: (req) =>
            new Promise<WeaponId | null>((resolve) => {
              const item = pickRinkProblem(getProgress(), seen.current);
              if (!item) {
                resolve(req.suggested);
                return;
              }
              seen.current.add(item.problem.prompt);
              if (seen.current.size > 40) seen.current = new Set([...seen.current].slice(-20));
              if (process.env.NODE_ENV === "development") (window as unknown as { __cartsItem?: RinkProblem }).__cartsItem = item;
              pending.current = { resolve, suggested: req.suggested };
              game.setPaused(true);
              setAnswer("");
              setVerdict(null);
              setOpen(item);
            }),
          onKill: (e) => {
            if (!e.killerIsPlayer) return;
            profile.stats.kills++;
            profile.stats.bestStreak = Math.max(profile.stats.bestStreak, e.streak);
            saveSoon();
          },
          onPlayerDeath: () => {
            profile.stats.deaths++;
            saveSoon();
          },
          onMatchEnd: (r) => {
            if (!joined) return;
            const before = levelOf(profile.xp);
            // XP and stats here; Bridgeys come from right answers only.
            const rw = matchRewards(r);
            rw.coins = 0;
            rw.lines = rw.lines.map((l) => ({ ...l, coins: 0 }));
            applyRewards(profile, rw);
            profile.stats.matches++;
            if (r.playerRank === 1) profile.stats.wins++;
            const after = levelOf(profile.xp);
            scoreboard.showRewards(rw, before.level, after.level, after.title, store.balance());
            void store.save(profile);
            garage.setProfile(profile);
          },
        },
      });
      gameRef.current = game;
      if (touch) game.addInput(touch);
      if (process.env.NODE_ENV === "development") (window as unknown as { __algeCarts?: GameHandle }).__algeCarts = game;

      const toGarage = () => {
        if (!joined) return;
        joined = false;
        game.leave();
        hud.hide();
        touch?.hide();
        root.classList.remove("playing");
        profile.coins = store.balance();
        garage.setProfile(profile);
        garage.show();
      };

      const scoreboard = new Scoreboard(root, toGarage);
      const garage = new Garage(
        root,
        profile,
        store,
        { arena: savedArena, gate: true },
        (p, choice) => {
          try {
            localStorage.setItem(ARENA_KEY, choice.arena);
          } catch {
            /* fine */
          }
          void store.save(p);
          game.unlockAudio();
          if (choice.arena !== "random" && choice.arena !== game.hud().arenaId) game.startMatch(choice.arena);
          game.join({ name: p.name.trim() || name, loadout: { ...p.loadout } });
          joined = true;
          sessionPaid.current = 0;
          hud.setCoins(0);
          garage.hide();
          hud.show();
          touch?.show();
          root.classList.add("playing");
          canvas.focus();
        },
        {
          footNote: "Demo for the testers. The Bridgeys are your AlgeBridge Bridgeys: a right answer on the track pays like the other games, and the shop spends them.",
          onBack: () => exitRef.current(),
        },
      );
      garageRef.current = garage;
      // The question gate is always on here; the garage's switch is not shown.
      garage.root.querySelector(".toggle")?.classList.add("hidden");
      garage.show();

      const soundBtn = document.createElement("button");
      soundBtn.className = "sound";
      soundBtn.setAttribute("aria-label", "Toggle sound");
      const paintSound = () => {
        soundBtn.innerHTML = game.isMuted() ? ICON_SOUND_OFF : ICON_SOUND_ON;
        soundBtn.classList.toggle("off", game.isMuted());
      };
      paintSound();
      const toggleMute = () => {
        const m = !game.isMuted();
        game.setMuted(m);
        profile.settings.sound = !m;
        saveSoon();
        paintSound();
      };
      soundBtn.addEventListener("click", () => {
        game.unlockAudio();
        toggleMute();
      });
      root.appendChild(soundBtn);

      const onKey = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
        if ((e.code === "Escape" || e.key === "Escape") && joined && !pending.current) toGarage();
        if ((e.code === "KeyM" || e.key === "m" || e.key === "M") && !typing && !pending.current) {
          game.unlockAudio();
          toggleMute();
        }
      };
      window.addEventListener("keydown", onKey);
      const unlockOnce = () => {
        game.unlockAudio();
        window.removeEventListener("pointerdown", unlockOnce);
        window.removeEventListener("keydown", unlockOnce);
      };
      window.addEventListener("pointerdown", unlockOnce);
      window.addEventListener("keydown", unlockOnce);

      cleanup = () => {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("pointerdown", unlockOnce);
        window.removeEventListener("keydown", unlockOnce);
        if (saveTimer) clearTimeout(saveTimer);
        pending.current?.resolve(null);
        pending.current = null;
        game.dispose();
        hud.dispose();
        garage.dispose();
        touch?.dispose();
        scoreboard.root.remove();
        soundBtn.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
      canvas.remove();
      gameRef.current = null;
      hudRef.current = null;
      garageRef.current = null;
    };
  }, [userId, name]);

  function check(given: string) {
    if (!open || verdict || !given.trim()) return;
    if (answerIsRight(open.problem, given)) {
      const { paid, dailyBonus } = awardRinkBridgeys(open.skillId, today());
      sessionPaid.current += paid;
      hudRef.current?.setCoins(sessionPaid.current);
      if (dailyBonus > 0) {
        fireConfetti("small");
        showToast({ icon: "coin", tone: "reward", title: `Daily goal · +${dailyBonus} Bridgeys`, description: `${DAILY_GOAL} right today, the games included.` });
      }
      setVerdict({ right: true, paid });
    } else {
      setVerdict({ right: false, paid: 0, given });
    }
  }

  function carryOn() {
    const right = !!verdict?.right;
    setOpen(null);
    setVerdict(null);
    const p = pending.current;
    pending.current = null;
    gameRef.current?.setPaused(false);
    p?.resolve(right ? p.suggested : null);
    const profile = profileRef.current;
    const store = storeRef.current;
    if (profile && store) profile.coins = store.balance();
  }

  return (
    <>
      <div ref={rootRef} className="algecarts" />
      {open && (
        <GameProblemDialog
          open={open}
          verdict={verdict}
          answer={answer}
          setAnswer={setAnswer}
          onCheck={check}
          onContinue={carryOn}
          continueLabel="Back to the race"
          note="Get it right and the booster is yours."
          label="Booster question"
        />
      )}
    </>
  );
}
