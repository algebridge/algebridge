"use client";

import { useEffect, useRef, useState } from "react";
import { GameProblemDialog, type GameVerdict } from "@/components/games/GameProblemDialog";
import { awardRinkBridgeys } from "@/lib/bridgeys";
import { DAILY_GOAL } from "@/lib/gamification";
import { answerIsRight } from "@/lib/grading";
import { fireConfetti, showToast } from "@/lib/notify";
import { today } from "@/lib/path";
import { getProgress } from "@/lib/progress";
import type { RinkProblem } from "@/lib/rink";
import { pickCartsProblem, practiceTopics, topicOfSkill } from "@/lib/algecarts/problems";
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
import { CartsNet, type LobbyInfo } from "@/lib/algecarts/net";
import { addBotResults, syncMyCartsRow } from "@/lib/algecarts/leaderboard";
import "@/lib/algecarts/carts.css";

const ARENA_KEY = "algebridge:carts:arena";
const PRACTICE_KEY = "algebridge:carts:practice";

/** The line under the garage: which lobby, and who else is in it. */
function lobbyLine(info: LobbyInfo): string {
  if (info.role === "solo") return "";
  const others = info.others;
  if (!others.length) return `Lobby ${info.id} · you and the bots so far`;
  const names = others.length === 1 ? others[0] : `${others.slice(0, -1).join(", ")} and ${others[others.length - 1]}`;
  return `Lobby ${info.id} · with ${names}`;
}

const ICON_EXPAND = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>`;
const ICON_COMPRESS = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>`;

interface Pending {
  resolve: (w: WeaponId | null) => void;
  suggested: WeaponId;
}

/** Older Safari spells the Fullscreen API with a prefix. */
interface FullscreenDoc extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface FullscreenEl extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/**
 * The kart arena on AlgeBridge: the engine and its garage, HUD and results
 * (plain DOM, from lib/algecarts) in a stage that sits in the page like the
 * other games, with the problem a `?` box stops for drawn by
 * GameProblemDialog over it. A right answer loads the booster and pays like
 * every other game, up to the shared daily cap; a wrong one leaves the box
 * empty. The match runs on behind the card: the engine parks and shields the
 * student's kart until the answer is in.
 *
 * Full screen (the button at the top right of the stage, or F) sends the
 * stage itself full screen, so the question card, which lives inside it,
 * stays visible; Esc gives the page back. Where the Fullscreen API is
 * missing (iPhones) the stage pins itself over the page instead.
 */
export function AlgeCarts({ userId, name, displayName, onExit, onMatchEnd }: { userId: string; name: string; displayName: string; onExit: () => void; onMatchEnd?: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const hudRef = useRef<Hud | null>(null);
  const garageRef = useRef<Garage | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const storeRef = useRef<BridgeysProfileStore | null>(null);
  const pending = useRef<Pending | null>(null);
  const seen = useRef(new Set<string>());
  const sessionPaid = useRef(0);
  const practiceRef = useRef("mix");
  const [open, setOpen] = useState<RinkProblem | null>(null);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<GameVerdict | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const matchEndRef = useRef(onMatchEnd);
  matchEndRef.current = onMatchEnd;

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
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
      // Nobody types a name: the racer is always the account's own, as "First L.".
      profile.name = name;
      try {
        practiceRef.current = localStorage.getItem(PRACTICE_KEY) ?? "mix";
      } catch {
        /* fine */
      }
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
      let net: CartsNet | null = null;
      const pid = `${userId}-${Math.random().toString(36).slice(2, 8)}`;
      const savedArena = (localStorage.getItem(ARENA_KEY) as ArenaId | "random" | null) ?? "random";
      const startArena: ArenaId = savedArena !== "random" && ARENA_ORDER.includes(savedArena) ? savedArena : ARENA_ORDER[Math.floor(Math.random() * ARENA_ORDER.length)];

      const game = createGame(canvas, {
        arena: startArena,
        seats: 8,
        pid,
        quality: lowPower ? "low" : "high",
        sound: profile.settings.sound,
        hooks: {
          onHud: (s: HudState) => {
            hud.update(s);
            scoreboard.update(s);
          },
          // The math gate: a bare problem, numbers and symbols only, from the unit the student is on.
          requestBooster: (req) =>
            new Promise<WeaponId | null>((resolve) => {
              const item = pickCartsProblem(getProgress(), seen.current, practiceRef.current);
              if (!item) {
                resolve(req.suggested);
                return;
              }
              seen.current.add(item.problem.prompt);
              if (seen.current.size > 40) seen.current = new Set([...seen.current].slice(-20));
              if (process.env.NODE_ENV === "development") (window as unknown as { __cartsItem?: RinkProblem }).__cartsItem = item;
              pending.current = { resolve, suggested: req.suggested };
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
          // The lobby wire: a guest's inputs and answers go to the host; a host's seat changes go out as a roster.
          onInput: (input, seq) => net?.sendInput(input, seq),
          onBoosterResolved: (w) => net?.sendBooster(w),
          onJoinRequest: (p) => net?.join(p),
          onLeaveRequest: () => net?.leave(),
          onSeatChange: () => net?.seatChanged(),
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
            // The board: this student's totals, and (from the host) the bots' results.
            const botsHere = new Set(game.roster().filter((e) => e.bot).map((e) => e.name));
            const board = [
              syncMyCartsRow(userId, displayName, profile.stats, profile.xp),
              game.role() !== "guest"
                ? addBotResults(r.standings.filter((s) => botsHere.has(s.name)).map((s) => ({ name: s.name, kills: s.kills, won: s.id === r.standings[0]?.id, streak: s.streak })))
                : Promise.resolve(),
            ];
            void Promise.all(board).then(() => matchEndRef.current?.());
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
        { arena: savedArena, gate: true, practice: practiceRef.current },
        (p, choice) => {
          practiceRef.current = choice.practice;
          try {
            localStorage.setItem(PRACTICE_KEY, choice.practice);
            localStorage.setItem(ARENA_KEY, choice.arena);
          } catch {
            /* fine */
          }
          void store.save(p);
          game.unlockAudio();
          if (choice.arena !== "random" && choice.arena !== game.hud().arenaId) game.startMatch(choice.arena);
          game.join({ name, loadout: { ...p.loadout } });
          joined = true;
          sessionPaid.current = 0;
          hud.setCoins(0);
          garage.hide();
          hud.show();
          touch?.show();
          root.classList.add("playing");
          canvas.focus();
          // On a phone the stage is a few hundred pixels wide: too small for
          // touch pads, so Play takes it full screen (the Play tap is the gesture).
          if (coarse && stage.clientWidth < 640 && !isFull()) void enterFull();
        },
        {
          footNote: "Demo for the testers. The Bridgeys are your AlgeBridge Bridgeys: a right answer on the track pays like the other games, and the shop spends them.",
          onBack: () => exitRef.current(),
          topics: practiceTopics(getProgress()).map((t) => ({ id: t.id, label: t.label })),
        },
      );
      garageRef.current = garage;
      net = new CartsNet(game, { pid, name, onLobby: (info) => garage.setLobby(lobbyLine(info)) });
      void net.start();
      if (process.env.NODE_ENV === "development") (window as unknown as { __cartsNet?: CartsNet }).__cartsNet = net;
      // The question gate is always on here; the garage's switch is not shown.
      garage.root.querySelector(".toggle")?.classList.add("hidden");
      garage.show();

      // Full screen: the stage goes full screen as a whole. Where the browser
      // has no Fullscreen API for a div (iPhones), or refuses, the stage pins
      // itself over the page with the .full class instead.
      const doc = document as FullscreenDoc;
      const el = stage as FullscreenEl;
      const nativeFull = () => (doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null) === stage;
      const isFull = () => nativeFull() || stage.classList.contains("full");
      const fullBtn = document.createElement("button");
      fullBtn.className = "full-btn";
      const paintFull = () => {
        const on = isFull();
        fullBtn.innerHTML = on ? ICON_COMPRESS : ICON_EXPAND;
        fullBtn.setAttribute("aria-label", on ? "Leave full screen" : "Full screen");
        fullBtn.title = on ? "Leave full screen (F)" : "Full screen (F)";
        game.resize();
      };
      const pinFull = () => {
        stage.classList.add("full");
        paintFull();
      };
      const enterFull = async () => {
        if (el.requestFullscreen) {
          try {
            // A request the browser's host never answers (an embedded web
            // view) stays pending for good: give it a moment, then pin.
            await Promise.race([el.requestFullscreen(), new Promise<void>((_, reject) => setTimeout(() => reject(new Error("slow")), 800))]);
            return;
          } catch {
            /* Refused (an iframe without allowfullscreen, say) or silent: pin the stage. */
          }
          if (nativeFull()) return;
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
          return;
        }
        pinFull();
      };
      const exitFull = () => {
        if (nativeFull()) {
          const out = doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.();
          void Promise.resolve(out).catch(() => undefined);
        }
        stage.classList.remove("full");
        paintFull();
      };
      const toggleFull = () => {
        if (isFull()) exitFull();
        else void enterFull();
        canvas.focus();
      };
      fullBtn.addEventListener("click", toggleFull);
      document.addEventListener("fullscreenchange", paintFull);
      document.addEventListener("webkitfullscreenchange", paintFull);
      paintFull();
      root.appendChild(fullBtn);

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
        canvas.focus();
      });
      root.appendChild(soundBtn);

      const onKey = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
        if (e.code === "Escape" || e.key === "Escape") {
          // In the browser's own full screen Esc is the browser's: it gives
          // the page back and does nothing else. Pinned, Esc unpins first.
          if (nativeFull()) return;
          if (stage.classList.contains("full")) {
            exitFull();
            return;
          }
          if (joined && !pending.current) toGarage();
          return;
        }
        if (typing || pending.current) return;
        if (e.code === "KeyM" || e.key === "m" || e.key === "M") {
          game.unlockAudio();
          toggleMute();
        }
        if (e.code === "KeyF" || e.key === "f" || e.key === "F") toggleFull();
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
        document.removeEventListener("fullscreenchange", paintFull);
        document.removeEventListener("webkitfullscreenchange", paintFull);
        if (isFull()) exitFull();
        if (saveTimer) clearTimeout(saveTimer);
        pending.current?.resolve(null);
        pending.current = null;
        net?.close();
        game.dispose();
        hud.dispose();
        garage.dispose();
        touch?.dispose();
        scoreboard.root.remove();
        soundBtn.remove();
        fullBtn.remove();
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
    p?.resolve(right ? p.suggested : null);
    const profile = profileRef.current;
    const store = storeRef.current;
    if (profile && store) profile.coins = store.balance();
  }

  // The question card is inside the stage so it stays on screen in full screen,
  // where only the full screen element shows.
  return (
    <div ref={stageRef} className="algecarts-stage shadow-raised ring-1 ring-slate-900/5">
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
          label={`Booster question${open ? ` · ${topicOfSkill(open.skillId)?.label ?? ""}` : ""}`}
        />
      )}
    </div>
  );
}
