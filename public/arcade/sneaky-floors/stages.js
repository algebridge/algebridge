// Sneaky Floors: 13 rooms, 5 stages each. Every stage reuses its room and adds one trick on top
// of the last one. Map letters: # wall, S start, D door, ^ spikes, ! ceiling spikes, a-z objects.
// See sim.js for the trap script format. Nothing here is random. quip: what the chalk face says on the first fall in that stage.
const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const R = (text, test) => ({ text, test });
const mult = (k) => R(`Multiples of ${k} hold`, (n) => n % k === 0);
const EVEN = R("Even numbers hold", (n) => n % 2 === 0), ODD = R("Odd numbers hold", (n) => n % 2 === 1);
const PRIME = R("Primes hold", isPrime), SQUARE = R("Square numbers hold", (n) => Number.isInteger(Math.sqrt(n)));
const eq = (text, x) => R("x:  " + text, (n) => n === x);
const M = (w, ...rows) => { const out = rows.map((r) => r.padEnd(w, ".")); while (out.length < 13) out.unshift(".".repeat(w)); return { map: out }; };
const F = "#".repeat(24);
const door = (n, extra) => ({ k: "d", n, ...extra });
const slam = (id, dy, back = 1.1) => [{ move: id, by: [0, dy], time: 0.1, ease: "in" }, { at: back, move: id, by: [0, -dy], time: 0.5 }];

export const ROOMS = [
  /* 0 Hallway */ M(24, "..S..................D..", F),
  /* 1 Pit */ M(24, "..S..................D..", "######............######"),
  /* 2 Stairs */ M(24, ".....................D..", "............###.########", "", "........###.............", "", "....###.................", "..S.###.^^^^^^^^^^^^....", F),
  /* 3 Ice rink */ M(24, "..S..................D..", "########..#####..#######"),
  /* 4 Low ceiling */ M(24, "......############......", "......############......", "", "", "..S..................D..", F),
  /* 5 Three doors */ M(24, "..S.....................", F),
  /* 6 Upside down */ M(24, F, "", "", "", "", "", "", "", "", "..S..................D..", "#########.......########"),
  /* 7 Long hall */ M(48, "..S..................D......................E...", "#".repeat(28) + "..#####.." + "#".repeat(11)),
  /* 8 Vault */ M(24, ".....................D..", "......##################", "....................####", "...##...............####", "....................####", "##..................####", "##....S.............####", F),
  /* 9 Final hall */ M(48, "..S.........................................E...", "#".repeat(20) + ".." + "#".repeat(26)),
  /* 10 Funhouse */ M(24, "..S..................D..", "########.....###########"),
  /* 11 Tilt */ M(24, "..S..................D..", "###########..###########"),
  /* 12 Mirror */ M(24, "..S........DE...........", F),
];
export const ROOM_NAMES = ["The Hallway", "The Pit", "The Stairs", "The Rink", "Low Ceiling", "Three Doors", "Upside Down", "The Long Hall", "The Vault", "Final Exam", "The Funhouse", "The Tilt", "The Mirror"];

const PIT = [[6, 12, 12, 1]];                       // a wide pit for number bridges
const threeDoors = (a, b, c) => ({ edit: ["8,11:P", "14,11:Q", "20,11:R"], obj: { P: door(a), Q: door(b), R: door(c) } });
const upZone = { on: { zone: [7, 9, 1, 3] }, delay: 0, do: [{ grav: -1 }] };
const downZone = (x) => ({ on: { zone: [x, 3, 1, 3], g: -1 }, delay: 0, do: [{ grav: 1 }] });
const arrows = (x) => [{ k: "up", x: 7, y: 10 }, { k: "down", x, y: 4 }];

const trail = (x, y, n, dx = 1) => Array.from({ length: n }, (_, i) => [x + i * dx, y]);   // a line of chalk coins (only for show)
const GHOST = { id: "g", x: 8, y: 12, w: 5, h: 1, ghost: 1 };       // the Funhouse pit is a bridge nobody drew
const HIS = { k: "d", twin: 1 };                                    // the twin's door, next to yours
const duck = (id, x, y) => [{ move: id, by: [0, 2], time: 0.2 }, { at: 0.25, move: id, to: [x, y + 2], time: 0.05 }, { at: 0.35, move: id, to: [x, y], time: 0.25 }];

export const STAGES = [
  // ---------- Room 1: The Hallway. Learn to move, then learn the floor lies. ----------
  { room: 0, hint: "Go to the door", coins: trail(6, 11.3, 7, 2) },
  { room: 0, hint: "Up to jump", edit: ["9,11:#", "14,10:##", "14,11:##", "21,11:.", "18,11:D"],
    traps: [{ on: { xgt: 16.4 }, do: [{ move: "D", to: [22, 11], time: 0.3 }, { say: "Nope." }] }] },
  { room: 0, edit: ["11,12:aaa"], obj: { a: { crumble: 0.05 } }, coins: trail(8.5, 11.3, 6) },   // the coins walk you onto it
  // painted spikes, first time: the floor ones are paint, the ceiling ones are not. Walking is the answer.
  { room: 0, quip: "Wrong spikes.", edit: ["9,8:######", "9,9:!!!!!!"], objs: [{ id: "p", k: "s", x: 11, y: 11, w: 2, h: 1, fake: 1 }] },
  // the ducking door, first time: it drops through the floor and comes up behind you. Nothing here can hurt.
  { room: 0, traps: [{ on: { xgt: 19.2 }, do: [...duck("D", 12, 11), { say: "Behind you." }] }] },

  // ---------- Room 2: The Pit. Numbers arrive. The math does not lie. ----------
  { room: 1, quip: "It had plans.", edit: ["7,12:aa", "11,12:ww", "15,12:cc"], obj: { w: { legs: 1 } },   // the polite platform, first time: stop on it and it walks you back. It returns.
    traps: [{ on: { stand: "w" }, delay: 0.3, do: [{ say: "After you." }, { move: "w", by: [-2, 0], time: 0.9, ease: "lin" }, { at: 2.2, move: "w", by: [2, 0], time: 0.9, ease: "lin" }] }] },
  { room: 1, rule: EVEN, cut: PIT, nums: [[6, 12, 2, [2, 5, 4, 8, 7, 6]]] },
  { room: 1, quip: "The arrow meant it.", edit: ["7,12:aa", "11,12:bb", "15,12:cc", "15,11:ee"], obj: { c: { fake: 1 }, e: { hidden: 1, h: 0.5 } }, deco: [{ k: "doodle", x: 15.5, y: 9.2 }],
    traps: [{ on: { tryMin: 1, t: 0.25 }, do: [{ show: "e" }, { say: "Fine. A real one." }] }] },
  { room: 1, rule: ODD, cut: PIT, nums: [[6, 12, 2, [1, 3, 6, 5, 8, 9]]],
    traps: [{ on: { xgt: 19 }, delay: 0, do: [{ fx: "banner" }, { move: "D", to: [23, 11], time: 0.25 }, { at: 0.7, say: "Not yet." }] }] },   // "Stage clear!" tears, first time
  { room: 1, hint: "Trust me", cut: PIT, objs: [{ id: "g", x: 6, y: 12, w: 12, h: 1, ghost: 1 }], coins: trail(6.5, 11.3, 6, 2) },   // the invisible bridge, first time: the whole pit is floor

  // ---------- Room 3: The Stairs. ----------
  { room: 2, edit: ["8,8:bbb"], obj: { b: { crumble: 0.45 } }, objs: [{ id: "f", k: "f", x: 18, y: 5 }],
    traps: [{ on: { xgt: 13.4, ylt: 6 }, do: [{ move: "f", by: [8, 0], time: 1.1, ease: "in" }, { say: "Checkpoint left." }] }] },
  { room: 2, rule: eq("x + 2 = 5", 3), edit: ["21,5:.", "17,5:P", "19,5:Q", "21,5:R"], obj: { P: door(2), Q: door(3), R: door(4) } },
  { room: 2, edit: ["12,6:ccc", "15,6:#", "16,6:l"],
    traps: [{ on: { land: "c" }, delay: 0.35, do: [{ fall: "l" }] }] }, // Nov 20: the pop-up spike sat on the edge the player lands on, so it is gone. The dropping floor is the only trick here.
  { room: 2, rule: mult(5), cut: [[8, 8, 3, 1], [12, 6, 3, 1]], nums: [[7, 8, 2, [15, 12]], [11, 6, 2, [20, 18]]], edit: ["15,6:#"] }, // easier (Nov 20): the door ledge reaches one tile closer
  // springy jump, first time: plenty of sky on the low steps, a spiked ceiling near the top one. A tap is enough up there.
  { room: 2, jump: 1.41, quip: "Too much spring.", hint: "Tap to hop. Hold to fly.", hintY: 170, edit: ["7,1:#################", "7,2:!!!!!!!!!!!!!!!!!", "15,6:#", "8,11:............"] },   // no floor spikes here: a wild bounce only costs a climb

  // ---------- Room 4: The Rink. ----------
  { room: 3, traps: [{ on: { xgt: 10.2, ground: 1 }, delay: 0, do: [{ ice: true }, { say: "Ice." }] },
    { on: { xgt: 19.3 }, delay: 0, do: [{ move: "D", to: [22, 11], time: 0.3 }] }] },
  { room: 3, rule: mult(4), quip: "Lights help.", cut: PIT, nums: [[6, 12, 2, [8, 6, 12, 4, 10, 16]]],
    traps: [{ on: { xgt: 4.4 }, delay: 0.1, do: [{ dark: 2 }, { say: "Lights." }] }] },   // lights off, first time: two seconds, on safe ground. Waiting works.
  { room: 3, quip: "Standing still moves you.", edit: ["10,12:bbbbb"], obj: { b: { belt: -170 } } },   // the treadmill, first time: the middle island rolls you back if you rest on it
  { room: 3, rule: EVEN, cut: PIT, nums: [[6, 12, 2, [2, 4, 7, 6, 8, 10]]],
    traps: [{ on: { jump: 1, zone: [8, 10, 2, 2] }, delay: 0.12, do: [{ label: "n2", n: 12 }, { label: "n3", n: 9 }] }] },
  { room: 3, quip: "I leaned on it.", traps: [{ on: { xgt: 10.6, ground: 1 }, delay: 0.1, do: [{ tilt: 1 }, { say: "Whoops." }] }] },   // the board leans, first time: one lean, a wide island, a second to react

  // ---------- Room 5: Low Ceiling. ----------
  { room: 4, edit: ["10,7:kk", "10,8:kk"], obj: { k: { crush: 1 } }, traps: [{ on: { xgt: 8.6 }, delay: 0.3, do: slam("k", 3) }] },
  { room: 4, rule: mult(3), cut: PIT, nums: [[6, 12, 2, [3, 9, 4, 6, 10, 12]]],
    traps: [{ on: { xgt: 3.6 }, delay: 0.05, do: [{ label: "n0", n: 8, stroke: 1 }] }] },          // one chalk stroke: the 3 is an 8 now
  { room: 4, quip: "Going up.", edit: ["11,12:uu"], obj: { u: { launch: 1 } },   // the launch block, first time: the floor goes up to meet the low ceiling. Hop over it.
    traps: [{ on: { stand: "u" }, delay: 0.12, do: [{ move: "u", by: [0, -3], time: 0.16, ease: "in" }, { say: "Going up." }, { at: 1.2, move: "u", by: [0, 3], time: 0.5 }] }] },
  { room: 4, rule: EVEN, cut: PIT, nums: [[6, 12, 2, [4, 7, 8, 3, 5, 10]]], traps: [{ on: { stand: "n2" }, delay: 0.15, do: [{ rule: ODD }] }] },
  { room: 4, edit: ["13,12:..", "6,11:t"], obj: { t: { k: "s", hidden: 1 } },
    traps: [{ on: { xgt: 9 }, delay: 0, do: [{ mirror: 3 }, { at: 0.4, show: "t" }] }, { on: { xgt: 11.7 }, delay: 0, do: [{ mirror: 3 }] }] },

  // ---------- Room 6: Three Doors. ----------
  { room: 5, rule: eq("x + 3 = 7", 4), ...threeDoors(3, 4, 5),
    traps: [{ id: "a", on: { xgt: 12.9 }, delay: 0, do: [{ set: "Q", props: { shut: true } }, { say: "Hm." }] },
      { on: { fired: "a", xlt: 10.5 }, do: [{ set: "Q", props: { shut: false } }, { say: "Fine." }] }] },
  { room: 5, quip: "I lied. Once.", edit: ["20,11:D"], objs: [{ id: "t", k: "s", x: 12, y: 9, w: 2, h: 1, dn: 1, hidden: 1 }],   // the lying hint, first time: flat floor, one door, one bad idea
    lie: { x: 13, y: 10.1, text: "Jump here", truth: "Sorry. Just walk." },
    traps: [{ lie: 1, on: { jump: 1, zone: [11.5, 10, 3, 2] }, delay: 0, do: [{ show: "t" }] }] },
  { room: 5, rule: eq("2x = 10", 5), edit: ["8,11:P", "14,11:Q", "20,11:R", "13,12:eee"], obj: { P: door(4), Q: door(5), R: door(6), e: { crumble: 0.05 } } },
  { room: 5, rule: eq("x - 4 = 2", 6), ...threeDoors(8, 6, 2), traps: [{ on: { xgt: 11.6 }, delay: 0.1, do: [{ swap: ["P", "Q"] }] }] },
  { room: 5, rule: eq("3x + 1 = 10", 3), edit: ["8,11:P", "14,11:Q", "20,11:R", "6,11:t"], obj: { P: door(2), Q: door(3), R: door(4), t: { k: "s", hidden: 1 } },
    traps: [{ id: "a", on: { xgt: 11.8 }, do: [{ move: "Q", to: [22, 11], time: 0.4 }] },
      { id: "b", on: { fired: "a", xgt: 20.9, ground: 1 }, do: [{ move: "Q", to: [4, 11], time: 0.5 }, { say: "Other side." }] },
      { on: { fired: "b", xlt: 9 }, do: [{ show: "t" }] }] },

  // ---------- Room 7: Upside Down. ----------
  { room: 6, deco: arrows(17), traps: [upZone, downZone(17)] },
  { room: 6, rule: mult(6), deco: arrows(18), cut: [[8, 2, 10, 1]], nums: [[8, 2, 2, [6, 10, 12, 9, 18]]], traps: [upZone, downZone(18)] },
  { room: 6, deco: arrows(17), traps: [upZone, downZone(17), { on: { zone: [12, 3, 1, 1.3], g: -1 }, delay: 0, do: [{ grav: 1 }] }] },
  { room: 6, rule: eq("x / 2 = 4", 8), deco: arrows(17), edit: ["21,3:U"], obj: { D: door(6), U: door(8, { up: true }) },
    traps: [upZone, { on: { zone: [17, 3, 1, 1.3], g: -1 }, delay: 0, do: [{ grav: 1 }] }] },
  { room: 6, deco: arrows(16), edit: ["18,3:!!!!!"], traps: [upZone, downZone(16), { on: { zone: [19, 11, 1, 1], g: 1 }, delay: 0, do: [{ grav: -1 }] }] },

  // ---------- Room 8: The Long Hall. The room is bigger than the board. ----------
  { room: 7, obj: { D: { fake: 1 }, E: { k: "d" } }, traps: [{ on: { touch: "D" }, delay: 0, do: [{ say: "Painted." }, { scroll: 24, time: 1 }] }] },
  { room: 7, rule: mult(7), obj: { D: { fake: 1 }, E: { k: "d" } }, cut: [[28, 12, 14, 1]], nums: [[28, 12, 2, [7, 14, 16, 21, 27, 28, 35]]],
    traps: [{ on: { touch: "D" }, delay: 0, do: [{ scroll: 24, time: 1 }] }] },
  { room: 7, edit: ["21,11:.", "12,11:#", "18,10:##", "18,11:##"], obj: { E: { k: "d" } }, objs: [{ id: "w", x: 40, y: 0, w: 2, h: 12, fake: 1 }],
    traps: [{ on: { xgt: 6 }, delay: 0.3, do: [{ scroll: 24, time: 9.5 }, { say: "Keep up." }] }] },
  { room: 7, rule: PRIME, edit: ["21,11:."], obj: { E: { k: "d" } }, cut: [[12, 12, 18, 1]], nums: [[12, 12, 2, [2, 3, 4, 5, 9, 7, 11, 15, 13]]],
    traps: [{ on: { xgt: 14 }, delay: 0.2, do: [{ scroll: 24, time: 8 }] }] },
  { room: 7, edit: ["2,11:G", "6,11:S", "9,11:t", "13,12:aaa"], obj: { D: { fake: 1 }, E: { k: "d", fake: 1 }, G: { k: "d", hidden: 1 }, t: { k: "s", hidden: 1 }, a: { crumble: 0.05, crack: 1 } },
    traps: [{ on: { touch: "D" }, delay: 0, do: [{ say: "Painted." }, { scroll: 24, time: 1 }] },
      { id: "b", on: { touch: "E" }, delay: 0.1, do: [{ say: "Other end." }, { scroll: 0, time: 1.4 }, { show: "G" }] },
      { on: { fired: "b", xlt: 11.6, ground: 1 }, do: [{ show: "t" }] }] },

  // ---------- Room 9: The Vault. ----------
  { room: 8, edit: ["12,6:aa", "11,11:^^^^"], obj: { a: { crumble: 0.05 } }, coins: trail(7.5, 11.3, 4) },
  { room: 8, rule: SQUARE, cut: [[8, 6, 12, 1]], edit: ["8,11:^^^^^^^^^^^^"], nums: [[8, 6, 2, [1, 4, 6, 9, 12, 16]]] },
  { room: 8, cut: [[20, 7, 4, 5]], edit: ["22,11:G", "12,11:^^^"], obj: { D: { fake: 1 }, G: { k: "d", hidden: 1 } }, objs: [{ id: "W", x: 20, y: 7, w: 4, h: 5 }],
    traps: [{ on: { touch: "D" }, delay: 0.1, do: [{ say: "Try downstairs." }, { hide: "W" }, { show: "G" }] }] },
  { room: 8, rule: eq("2x + 1 = 9", 4), cut: [[20, 7, 4, 5]], edit: ["12,5:P", "22,11:G", "13,11:^^"], obj: { P: door(3), D: door(5), G: door(4) }, objs: [{ id: "W", x: 20, y: 7, w: 4, h: 5, fake: 1 }],
    traps: [{ on: { tryMin: 2, t: 0.4 }, do: [{ say: "Where is the 4?" }] }] },
  { room: 8, cut: [[20, 7, 4, 5]], edit: ["12,6:aa", "12,11:^^", "16,2:kk", "16,3:kk"], obj: { a: { crumble: 0.05, crack: 1 }, k: { crush: 1 } }, objs: [{ id: "W", x: 20, y: 7, w: 4, h: 5 }],
    traps: [{ on: { xgt: 14.4, ylt: 6 }, delay: 0.3, do: slam("k", 2, 1.2) },
      { on: { xgt: 18.6, ylt: 6 }, do: [{ move: "D", to: [22, 11], time: 0.4 }, { hide: "W" }, { say: "Downstairs." }] }] },

  // ---------- Room 10: Final Exam. Everything, again. ----------
  { room: 0, edit: ["11,12:aaa", "14,11:ss"], obj: { a: { crumble: 0.05, crack: 1 }, s: { k: "s", hidden: 1 } },
    traps: [{ on: { jump: 1, zone: [7, 10, 3, 2] }, delay: 0.15, do: [{ show: "s" }] }, { on: { xgt: 16.5, ground: 1 }, delay: 0, do: [{ ice: true }, { say: "Ice." }] },
      { on: { xgt: 19.4 }, do: [{ move: "D", to: [23, 11], time: 0.3 }] }] },
  { room: 1, rule: PRIME, cut: PIT, nums: [[6, 12, 2, [2, 3, 4, 5, 9, 6]]], traps: [{ on: { stand: "n3" }, delay: 0.15, do: [{ rule: mult(3) }] }] },
  { room: 6, deco: arrows(16), edit: ["13,2:..", "18,3:!!!!!"],
    traps: [upZone, downZone(16), { on: { g: -1, xgt: 10 }, delay: 0, do: [{ mirror: 3 }] }, { on: { zone: [19, 11, 1, 1], g: 1 }, delay: 0, do: [{ grav: -1 }] }] },
  { room: 5, rule: eq("3x - 2 = 10", 4), ...threeDoors(3, 4, 5),
    traps: [{ id: "a", on: { xgt: 11.6 }, delay: 0.1, do: [{ swap: ["Q", "R"] }] }, { id: "b", on: { fired: "a", xgt: 17.7 }, do: [{ move: "R", to: [22, 11], time: 0.3 }] },
      { on: { fired: "b", xgt: 20.6, ground: 1 }, do: [{ move: "R", to: [4, 11], time: 0.5 }, { say: "Last time." }] }] },
  { room: 9, rule: mult(4), edit: ["9,12:aa", "14,7:kk", "14,8:kk"], obj: { a: { crumble: 0.05, crack: 1 }, k: { crush: 1 }, E: { k: "d" } }, cut: [[26, 12, 12, 1]], nums: [[26, 12, 2, [4, 8, 6, 12, 9, 16]]],
    traps: [{ on: { xgt: 5 }, delay: 0.3, do: [{ scroll: 24, time: 12 }, { say: "Keep up." }] }, { on: { xgt: 12.5 }, delay: 0.3, do: slam("k", 3, 1) },
      { on: { xgt: 41.5 }, do: [{ move: "E", to: [46, 11], time: 0.3 }, { say: "One more." }] }] },

  // ---------- Room 11: The Funhouse. The pit is not a pit. The floor is not a floor. ----------
  { room: 10, hint: "Just walk. Mostly.", quip: "Mostly.", objs: [{ id: "g", x: 8, y: 12, w: 3, h: 1, ghost: 1 }], coins: trail(8.5, 11.3, 5) },   // room 2 taught the bridge. This one stops two tiles short and the coins keep going.
  { room: 10, objs: [GHOST], edit: ["15,12:ee"], obj: { e: { fake: 1 } }, deco: [{ k: "doodle", x: 15.5, y: 9.2 }], coins: trail(13.5, 11.3, 4) },
  { room: 10, edit: ["10,12:ww"], obj: { w: { legs: 1 } }, objs: [{ id: "t", k: "s", x: 16, y: 9, w: 2, h: 1, dn: 1, hidden: 1 }],
    lie: { x: 17, y: 10.1, text: "Jump here", truth: "Sorry. Just walk." },
    traps: [{ on: { stand: "w" }, delay: 0.3, do: [{ say: "After you." }, { move: "w", by: [-2, 0], time: 0.9, ease: "lin" }, { at: 2.2, move: "w", by: [2, 0], time: 0.9, ease: "lin" }] },
      { lie: 1, on: { jump: 1, zone: [15.5, 10, 3, 2] }, delay: 0, do: [{ show: "t" }] }] },
  { room: 10, rule: EVEN, cut: [[13, 12, 5, 1]], nums: [[8, 12, 2, [3, 6, 5, 8, 7]]],
    traps: [{ on: { xgt: 6.4 }, delay: 0.1, do: [{ rule: ODD }] }] },   // the sign flips one tile before the row. The rewrite is the warning.
  { room: 10, objs: [GHOST, { id: "p", k: "s", x: 17, y: 11, w: 2, h: 1, fake: 1 }], edit: ["14,5:#####", "14,6:!!!!!", "15,12:uu"], obj: { u: { launch: 1 } },
    traps: [{ on: { stand: "u" }, delay: 0.12, do: [{ move: "u", by: [0, -5], time: 0.16, ease: "in" }, { say: "Going up." }, { at: 1.2, move: "u", by: [0, 5], time: 0.5 }] }] },

  // ---------- Room 12: The Tilt. Somebody leaned on the board. ----------
  { room: 11, quip: "Downhill is fast.", edit: ["13,12:aa"], obj: { a: { crumble: 0.35, crack: 1 } },   // room 4 taught the lean. Now the landing crumbles and the second lean slides you back at the hole.
    traps: [{ on: { xgt: 5.5 }, delay: 0.1, do: [{ tilt: 1 }, { say: "Whoops." }] }, { on: { xgt: 16, ground: 1 }, delay: 0.1, do: [{ tilt: -1 }, { say: "Other way." }] }] },
  { room: 11, rule: ODD, cut: [[8, 12, 10, 1]], nums: [[8, 12, 2, [1, 3, 5, 6, 7]]],
    traps: [{ on: { xgt: 3.6 }, delay: 0.05, do: [{ tilt: 1 }] }, { on: { xgt: 6.4 }, delay: 0.05, do: [{ label: "n1", n: 8, stroke: 1 }, { say: "One little stroke." }] }] },
  { room: 11, edit: ["13,12:bbbbb", "18,7:kk", "18,8:kk"], obj: { b: { belt: -170 }, k: { crush: 1 } },
    traps: [{ on: { xgt: 15.6 }, delay: 0.3, do: slam("k", 3, 1.3) }] },
  { room: 11, jump: 1.41, hint: "Tap to hop. Hold to fly.", hintY: 170, rule: mult(3), cut: [[8, 12, 10, 1]], nums: [[8, 12, 2, [9, 4, 6, 12, 5]]], edit: ["6,6:##############", "6,7:!!!!!!!!!!!!!!"] },
  { room: 11, jump: 0.71, hint: "Heavy shoes",
    traps: [{ on: { xgt: 6 }, delay: 0.1, do: [{ dark: 2 }, { say: "Lights." }] },
      { id: "duck", on: { xgt: 19.2 }, do: [...duck("D", 15, 11), { say: "Behind you." }] },
      { on: { fired: "duck", xlt: 18.5 }, delay: 0.3, do: [{ tilt: -1 }] }] },

  // ---------- Room 13: The Mirror. A second Archie, drawn in chalk, copies you backwards. Mind HIS side. ----------
  { room: 12, twin: 1, hint: "He copies you", edit: ["17,11:^"], obj: { E: HIS } },
  { room: 12, twin: 1, cut: [[15, 12, 2, 1]], edit: ["4,11:^"], obj: { E: HIS }, coins: trail(5.5, 11.3, 5) },
  { room: 12, twin: 1, rule: PRIME, cut: [[3, 12, 8, 1], [13, 12, 8, 1]], nums: [[3, 12, 2, [9, 2, 5, 11]], [13, 12, 2, [7, 15, 3, 13]]], obj: { E: HIS } },
  { room: 12, twin: 1, edit: ["17,11:^"], obj: { E: HIS },
    traps: [{ id: "a", on: { xgt: 9.4 }, do: [{ fx: "banner" }, { set: ["D", "E"], props: { shut: true } }, { at: 0.7, say: "Not yet." }] },
      { on: { fired: "a", xlt: 4.5 }, do: [{ set: ["D", "E"], props: { shut: false } }, { say: "Fine." }] }] },
  { room: 12, twin: 1, rule: eq("2x + 1 = 9", 4), cut: [[4, 12, 5, 1]], obj: { D: door(5), E: door(4) },
    objs: [{ id: "Y", x: 6, y: 0, w: 2, h: 1, hidden: 1, tally: 1, crumble: 0.6 }],
    traps: [{ on: { xgt: 3.2, ground: 1 }, delay: 0.5, do: [{ show: "Y" }, { move: "Y", by: [0, 12], time: 0.45, ease: "in" }, { say: "Borrow my count." }] }] },
];
