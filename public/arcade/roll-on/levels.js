// Roll On: the 24 levels. Three worlds of eight; each level brings in one idea and the last of each world is a boss.
// See Builder in sim.js: terrain calls lay ground left to right, item calls place things on the piece just laid.
import { Builder } from "./sim.js";

export const WORLDS = ["Green Hills", "Clank Works", "Moonlit Woods"];
const B = (y) => new Builder(y);

const DEFS = [
  // ---------- World 1: Green Hills ----------
  () => B(8).flat(9).sign(4.5, "Arrow keys to roll").stars(5, 4)
    .hill(8, 1.5).stars(1, 7).flat(3).ramp(7, -3).stars(0, 7).flat(6).stars(1, 5)
    .hill(10, 2.5).stars(1, 9).flat(9).sign(5, "Space to jump").stars(1, 3)
    .up(1).flat(5).stars(1, 4).up(1).flat(4).up(1.5).flat(7).cp(3).stars(4, 3)
    .ramp(9, -4).stars(0, 9).flat(5).arc(3.5, 5, 5.5, 1.8).down(1.5).flat(2.5).up(1.5)
    .flat(7).stars(2, 4).hill(8, -1.5).stars(1, 7)
    .flat(4).up(1).flat(3).up(1).flat(3).stars(0.5, 3).down(2).flat(11).stars(1, 4).goal(8)
    .finish("First Roll", 0),

  () => B(8).flat(9).stars(3, 4).hop(2.5).flat(7).stars(2, 4).up(1.5).flat(5).hop(3.5)
    .flat(6).cp(2).ramp(6, -2).stars(0, 6).flat(3)
    .gap(7).bridge(0, 0, 7).stars(1, 6, 1, 1.2)
    .flat(5).up(2).flat(3).hop(3).flat(3).hop(3).flat(5).cp(2).ramp(6, -2).stars(0, 6)
    .flat(15).sign(3, "Land on grumpy blocks").enemy(10, 3).stars(13, 2)
    .up(1).flat(9).enemy(5, 2.5).hop(3).flat(7).enemy(4, 2)
    .hill(8, 2).stars(1, 7).flat(10).stars(1, 4).goal(7)
    .finish("Hop Along", 0),

  () => B(8).flat(8).stars(3, 4).hill(8, 2).stars(1, 7).flat(8).enemy(5, 2).up(1).flat(5).hop(3).flat(5).cp(2)
    .flat(19).sign(2.2, "Roll onto the right number").math(16, 3)
    .flat(5).stars(1, 4).ramp(8, -3).stars(0, 8).flat(9).enemy(5, 3)
    .hop(3).flat(6).up(1.5).flat(7).enemy(4, 2).gap(5).bridge(0, 0, 5).stars(0.5, 5, 1, 1.2)
    .flat(4).hill(8, 2).stars(1, 7).flat(10).stars(1, 4).goal(7)
    .finish("Number Gate", 0),

  () => B(7).flat(13).stars(2, 4).crate(8, 12.3).up(3.6).flat(8).stars(1, 5).enemy(5, 2).ramp(6, -2).stars(0, 6).flat(3)
    .flat(7).crate(3, true).notch("a").flat(7).gate(4, "a").cp(6)
    .flat(18).math(15, 3)
    .flat(4).up(1.5).flat(6).crate(3, 16.3).ramp(5, -1.5).stars(0, 5).flat(6).up(3.6).flat(7).stars(1, 5)
    .hop(3).flat(5).cp(2).ramp(7, -3).stars(0, 7).flat(10).enemy(6, 3).flat(7).stars(0, 3).goal(4)
    .finish("Crate Mate", 0),

  () => B(7).flat(10).stars(3, 3).spring(8).col(8, 4, 2.5, 1.3).up(5).flat(9).stars(1, 3).enemy(5, 2.5)
    .ramp(6, -3).stars(0, 6).flat(6).spring(5).arc(5, 7, 6, 4.5).gap(5).flat(6).cp(2).stars(3, 3)
    .flat(5).spring(3).col(3, 3, 2.5, 1.3).up(4.5).flat(5).spring(3).col(3, 3, 2.5, 1.3).up(4.5)
    .flat(18).math(15, 3)
    .flat(4).ramp(8, -5).stars(0, 8).flat(8).enemy(3, 1.5).spring(6.5).gap(6).block(1.5, 3, 3, 0.6).stars(2, 3, 1, 4.6)
    .flat(6).cp(2).hill(8, 2).stars(1, 7).flat(9).stars(1, 4).goal(6)
    .finish("Bounce Up", 0),

  () => B(8).flat(9).stars(3, 4).flat(8).spikes(4, 1.5).arc(2.5, 5, 4.5, 1.6).flat(8).spikes(3, 2).arc(1.5, 5, 5, 1.6)
    .up(1).flat(4).sign(2, "Jump over spiky blocks", 3).flat(9).spiky(5, 2).arc(3, 5, 4, 2).flat(4).cp(2)
    .hop(3).flat(8).enemy(4, 2.5).flat(10).spiky(5, 3).block(3.5, 2.2, 3, 0.6).stars(4, 3, 1, 3.8)
    .flat(18).math(15, 3)
    .ramp(7, -3).stars(0, 7).flat(8).spikes(4, 2).arc(2.5, 5, 5, 1.6).hop(3).flat(4).hop(3).flat(5).cp(2)
    .flat(13).spiky(4, 2).enemy(9.5, 2).gap(6).bridge(0, 0, 6).spikes(2.5, 1).arc(1, 5, 4, 1.6)
    .flat(10).stars(1, 4).goal(7)
    .finish("Spike Patrol", 0),

  () => B(8).flat(10).stars(3, 4).gap(8).lift(0.4, 0, 3, 4.2, 0, 4).stars(2, 5, 1, 1.5)
    .flat(7).stars(1, 4).enemy(4, 2).gap(4, 5).lift(0.5, 0, 3, 0, 5, 4.5).col(2, 4, 1.5, 1.2)
    .flat(8).cp(2).stars(3, 4).gap(11).lift(0.4, 0, 3, 2, 0, 3.6).lift(7.6, 0, 3, -1.6, 0, 3.6).stars(2, 8, 1, 1.5)
    .flat(18).math(15, 3)
    .flat(4).gap(5, -4).lift(1, 0, 3, 0, -4, 4).flat(8).enemy(4, 2.5).stars(1, 6)
    .gap(9, 2.5).lift(0.4, 0, 3, 5.2, 2.5, 4.5).flat(6).cp(2).ramp(7, -2.5).stars(0, 7).flat(9).stars(1, 4).goal(6)
    .finish("Lift Off", 0),

  () => B(8).flat(8).stars(3, 4).hill(8, 2).stars(1, 7).flat(5).hop(3).flat(6).enemy(3, 2).up(1.5).flat(4).ramp(7, -2.5).stars(0, 7)
    .flat(34).cp(2).boss(5, 24, 1).goal(30)
    .finish("Big Block", 0),

  // ---------- World 2: Clank Works ----------
  () => B(7).flat(9).stars(3, 4)
    .flat(15).block(3, 1.2, 2.5, 0.6, "metal").block(6.5, 2.4, 3, 0.6, "metal").button(8, "a", "latch", 3).gate(12, "a").stars(3.5, 2, 1, 2.8)
    .flat(6).enemy(3, 2).flat(8).crate(3, true).notch("b").flat(7).gate(4, "b").cp(6)
    .flat(15).spring(3).block(5, 4.5, 3, 0.6, "metal").button(6.5, "c", "latch", 5.1).gate(12, "c").col(3, 3, 2.5, 1.3)
    .flat(18).math(15, 3)
    .hop(3).flat(5).up(1.5).flat(6).enemy(3, 1.5).down(1.5).flat(4).cp(2)
    .flat(8).crate(3, true).notch("d").flat(9).gate(3, "d").stars(4, 3).goal(7)
    .finish("Button Works", 1),

  () => B(11).flat(8).stars(3, 4).flat(5).boulder(3).slope(10, -4).stars(0, 10)
    .flat(14).spiky(3, 0.5).spiky(6.5, 0.5).spiky(10, 0.5).hop(4).flat(6).cp(2)
    .up(1.5).flat(5).boulder(3).slope(8, -3).flat(13).spiky(3, 1).button(7, "a").spiky(9.5, 1).gate(12, "a")
    .hop(4).flat(18).math(15, 3)
    .flat(4).cp(2).up(1.5).flat(4).boulder(2).slope(12, -5).stars(0, 12).flat(12).spiky(3, 1).spiky(6, 1, { ph: 0.5 }).spiky(9, 1)
    .hop(4).flat(10).enemy(5, 3).stars(1, 4).flat(8).goal(5)
    .finish("Rock and Roll", 1),

  () => B(8).flat(10).stars(3, 4).gap(6).seesaw(3, 1, 7).stars(1, 5, 1, 2.2)
    .flat(7).enemy(4, 2).gap(6).seesaw(3, 1, 7).flat(5).cp(2)
    .flat(9).seesaw(4.5, 1, 7).spikes(2.5, 4)
    .flat(18).math(15, 3)
    .gap(6).seesaw(3, 1, 7).flat(1.5).gap(6).seesaw(3, 1, 7).flat(5).cp(2)
    .up(1.5).flat(6).enemy(3, 2).ramp(6, -2.5).stars(0, 6)
    .flat(9).seesaw(4.5, 1, 7).spikes(2, 5).flat(6).spiky(3, 1.5).gap(6).seesaw(3, 1, 7)
    .flat(10).stars(1, 4).goal(7)
    .finish("See-Saw Yard", 1),

  () => B(8).flat(10).stars(3, 4).gap(8).swing(4, 5, 5).stars(2, 5, 1, 2)
    .flat(7).enemy(4, 2).cp(6).gap(16.5).swing(4, 5, 5, 3, 0.6, 3.6, 0).swing(12.6, 5, 5, 3, 0.6, 3.6, 0.5).stars(3, 11, 1, 2)
    .flat(18).math(15, 3)
    .flat(4).cp(2).gap(8, 2).swing(4, 6, 5).flat(6).enemy(3, 2)
    .gap(8).swing(4, 5, 5, 3, 0.6, 3).flat(3).gap(8).swing(4, 5, 5, 3, 0.6, 3, 0.5)
    .flat(5).cp(2).ramp(6, -2).stars(0, 6).flat(9).stars(1, 4).goal(6)
    .finish("Swing Shift", 1),

  () => B(6).flat(9).stars(3, 4).spring(7.5).col(7.5, 3, 2.5, 1.3).up(5).flat(5).enemy(2.5, 1.5)
    .gap(4, 4).lift(0.5, 0, 3, 0, 4, 4).flat(6).cp(2).spring(4.5).col(4.5, 3, 2.5, 1.3).up(5)
    .flat(18).math(15, 3)
    .flat(5).spiky(2.5, 1.5).block(1, 2.2, 3, 0.6, "metal")
    .gap(9).lift(0.4, 0, 3, 5.2, 0, 4).flat(5).cp(2)
    .ramp(8, -5).stars(0, 8).flat(6).spring(5).arc(5, 7, 6, 4.5).gap(5).flat(4).spring(3).arc(3, 7, 6, 4.5).gap(5)
    .flat(6).cp(2).gap(4, -4).lift(0.5, 0, 3, 0, -4, 4).flat(8).enemy(4, 2.5).gap(4, -4).lift(0.5, 0, 3, 0, -4, 4, 0.5)
    .flat(10).stars(1, 4).goal(7)
    .finish("Stack Hopper", 1),

  () => B(7).flat(9).stars(3, 4).flat(18).math(15, 3)
    .flat(5).enemy(2.5, 1.5).hop(3.5).flat(8).crate(4, 7.3).up(3.6).flat(6).cp(2).stars(3, 3)
    .gap(8).lift(0.4, 0, 3, 4.2, 0, 3.6).flat(6).spiky(3, 2).block(1.5, 2.2, 3, 0.6, "metal")
    .flat(18).math(15, 3)
    .flat(4).cp(2).ramp(6, -3).stars(0, 6).flat(8).spikes(4, 2).arc(2.5, 5, 5, 1.6).flat(8).crate(3, true).notch("a").flat(8).gate(3, "a")
    .hop(3).flat(9).stars(1, 4).goal(6)
    .finish("Double Lock", 1),

  () => B(9).flat(9).stars(3, 4).flat(5).boulder(3).slope(8, -3).flat(10).spiky(3, 1).spiky(7, 1).hop(4)
    .flat(5).cp(2).gap(6).seesaw(3, 1, 7).flat(5).spring(3.5).col(3.5, 3, 2.5, 1.3).up(5)
    .flat(6).enemy(3, 2).gap(8).swing(4, 5, 5).flat(5).cp(2)
    .flat(18).math(15, 3)
    .gap(9).lift(0.4, 0, 3, 5.2, 0, 4).flat(9).spiky(4.5, 3).block(3, 2.2, 3, 0.6, "metal").stars(3.5, 3, 1, 3.8)
    .flat(8).crate(3, true).notch("a").flat(7).gate(4, "a").cp(6)
    .ramp(8, -4).stars(0, 8).flat(8).spikes(4, 2).arc(2.5, 5, 5, 1.6).hop(3.5).flat(9).stars(1, 4).goal(6)
    .finish("Gear Gauntlet", 1),

  () => B(7).flat(8).stars(3, 4).gap(6).seesaw(3, 1, 7).flat(6).spiky(3, 1.5).hop(3).flat(5).up(1.5).flat(4).ramp(6, -1.5).stars(0, 6)
    .flat(36).cp(2).boss(5, 26, 2).goal(32)
    .finish("Chief Clank", 1),

  // ---------- World 3: Moonlit Woods ----------
  () => B(16).flat(9).stars(3, 4).ramp(12, -6).stars(0, 12).flat(3).slope(2, 0.6).arc(1, 7, 9, 2).gap(7, -2)
    .flat(8).cp(2).hill(8, 2).stars(1, 7).ramp(10, -5).stars(0, 10).flat(3).slope(2, 0.6).arc(1, 7, 10, 2).gap(8, -2)
    .flat(18).math(15, 3)
    .flat(4).cp(2).ramp(8, -3).stars(0, 8).hill(8, 2).stars(1, 7).hill(8, 2.5).stars(1, 7).flat(7).enemy(4, 2)
    .up(1.5).flat(5).hop(4).flat(5).hop(4).flat(10).stars(1, 4).goal(7)
    .finish("Moon Slide", 2),

  () => B(9).flat(9).stars(3, 4).gap(8).swing(4, 5, 5, 3, 0.6, 3.2).stars(2, 5, 1, 2)
    .flat(4).gap(16.5).swing(4, 5, 5, 3, 0.6, 3.2, 0).swing(12.6, 5, 5, 3, 0.6, 3.2, 0.5).stars(3, 11, 1, 2)
    .flat(5).cp(2).flat(6).spiky(3, 2).block(1.5, 2.2, 3, 0.6)
    .flat(18).math(15, 3)
    .gap(8, 2).swing(4, 6, 5, 3, 0.6, 3.2).flat(4).gap(8, 2).swing(4, 6, 5, 3, 0.6, 3.2, 0.5).flat(5).cp(2)
    .ramp(8, -4).stars(0, 8).flat(6).enemy(3, 2).gap(9).lift(0.4, 0, 3, 5.2, 0, 3.6)
    .flat(3).gap(8).swing(4, 5, 5, 2.4, 0.6, 3).flat(10).stars(1, 4).goal(7)
    .finish("Firefly Swings", 2),

  () => B(8).flat(9).stars(3, 4).flat(10).enemy(3, 1).enemy(6, 1, { ph: 0.5 }).enemy(9, 1)
    .flat(12).spiky(3, 2).enemy(8, 2).spiky(11, 1).hop(3).flat(5).cp(2)
    .flat(12).spikes(2.5, 7).enemy(4, 0).enemy(6.3, 0).enemy(8.6, 0).block(1.5, 3.4, 8.5, 0.5).stars(2, 8, 1, 4.6)
    .flat(18).math(15, 3)
    .up(1.5).flat(8).spiky(4, 3, { sp: 80 }).down(1.5).flat(4).cp(2)
    .hill(10, 2.5).enemy(5, 2).stars(1, 9).flat(10).spiky(5, 4, { sp: 90 }).block(3.5, 2.2, 3, 0.6).stars(4, 3, 1, 3.8)
    .hop(3).flat(6).enemy(3, 2).hop(3).flat(10).stars(1, 4).goal(7)
    .finish("Night Patrol", 2),

  () => B(9).flat(9).stars(3, 4).gap(6).seesaw(3, 1, 7).flat(1.5).gap(6).seesaw(3, 1, 7).flat(1.5).gap(6).seesaw(3, 1, 7)
    .flat(5).cp(2).up(1.5).flat(5).boulder(3).slope(8, -3).flat(11).spiky(3, 1).button(6, "a").spiky(8.5, 1).gate(10.5, "a")
    .hop(4).flat(18).math(15, 3)
    .flat(4).cp(2).flat(9).seesaw(4.5, 1, 7).spikes(2, 5).flat(5).spiky(2.5, 1.5)
    .gap(9).lift(0.4, 0, 3, 5.2, 0, 3.6).flat(3).gap(6).seesaw(3, 1, 7).flat(5).cp(2)
    .ramp(7, -3).stars(0, 7).flat(8).enemy(4, 2.5).flat(8).stars(1, 4).goal(5)
    .finish("Tippy Bridges", 2),

  () => B(5).flat(9).stars(3, 4).spring(7.5).col(7.5, 3, 2.5, 1.3).up(5).flat(6).enemy(3, 2)
    .gap(4, 5).lift(0.5, 0, 3, 0, 5, 4).flat(5).cp(2).spring(3.5).col(3.5, 3, 2.5, 1.3).up(5)
    .flat(5).spiky(2.5, 1.5).block(1, 2.2, 3, 0.6).gap(8, 2).swing(4, 6, 5, 3, 0.6, 3.2)
    .flat(18).math(15, 3)
    .flat(4).cp(2).gap(4, 5).lift(0.5, 0, 3, 0, 5, 3.6).flat(5).spring(3.5).col(3.5, 3, 2.5, 1.3).up(5)
    .flat(8).enemy(4, 2.5).stars(1, 6).flat(8).stars(1, 4).goal(5)
    .finish("Old Tree Climb", 2),

  () => B(12).flat(9).stars(3, 4).flat(5).boulder(3).slope(10, -4).stars(0, 10).flat(12).spiky(3, 1).spiky(6, 1, { ph: 0.5 }).spiky(9, 1).hop(4)
    .flat(5).cp(2).flat(18).math(15, 3)
    .flat(8).crate(4, 7.3).up(3.6).flat(5).boulder(3).slope(9, -3.6).flat(12).spiky(3, 1).button(6.5, "a").spiky(9, 1).gate(11, "a")
    .hop(4).flat(5).cp(2).flat(8).crate(3, true).notch("b").flat(7).gate(4, "b")
    .gap(8).swing(4, 5, 5, 3, 0.6, 3.2).flat(9).stars(1, 4).goal(6)
    .finish("Boulder Vault", 2),

  () => B(12).flat(9).stars(3, 4).ramp(10, -5).stars(0, 10).flat(3).slope(2, 0.6).arc(1, 7, 9, 2).gap(7, -2)
    .flat(6).cp(2).spikes(4, 1.5).gap(6).seesaw(3, 1, 7).flat(6).spiky(3, 2).block(1.5, 2.2, 3, 0.6)
    .gap(8).swing(4, 5, 5, 3, 0.6, 3).flat(5).cp(2).spring(3.5).col(3.5, 3, 2.5, 1.3).up(5)
    .flat(18).math(15, 3)
    .gap(9).lift(0.4, 0, 3, 5.2, 0, 3.4).flat(8).enemy(2.5, 1).enemy(5.5, 1, { ph: 0.5 }).flat(4).cp(2)
    .flat(8).crate(3, true).notch("a").flat(7).gate(4, "a").spikes(5.5, 1.5)
    .hop(3.5).flat(4).hop(3.5).flat(9).stars(1, 4).goal(6)
    .finish("The Long Dark", 2),

  () => B(8).flat(8).stars(3, 4).gap(8).swing(4, 5, 5, 3, 0.6, 3.2).flat(6).spiky(3, 1.5).hop(3).flat(4).ramp(7, -2).stars(0, 7)
    .flat(38).cp(2).boss(5, 28, 3).goal(34)
    .finish("King Block", 2),
];

export const COUNT = DEFS.length;
export const buildLevel = (i) => DEFS[i]();
