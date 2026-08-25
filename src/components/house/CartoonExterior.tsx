"use client";

import Image from "next/image";
import { GameHud } from "@/components/house/GameHud";
import { YARD_CARTOON_BG, getHouseStyle } from "@/data/house-catalog";

interface CartoonExteriorProps {
  houseStyleId: string;
  onEnter: () => void;
}

/*
 * Compositing the house INTO the yard rather than onto it.
 *
 * The two assets are different media. The yard is a soft painted landscape
 * with depth and no outlines; the house sprites are flat clipart with hard
 * black outlines and a bottom edge cut off dead straight. Dropped on top, the
 * house read as a sticker, and it was bobbing up and down, which is what a
 * sticker does and what a building does not.
 *
 * Three things put it in the ground:
 *
 *   1. It stands at the back of the clearing where the dirt meets the grass,
 *      on the scene's actual ground plane, instead of floating mid-clearing.
 *
 *   2. Its shadow is the house's own silhouette, flipped down, squashed and
 *      sheared away from the light, then blurred. A generic dark ellipse reads
 *      as a disc a sprite is hovering over; a silhouette that has this roof and
 *      this chimney reads as this building's shadow.
 *
 *   3. A second copy of the yard is drawn OVER the house, masked so the terrain
 *      fades in across the last few percent of the sprite. That dissolves the
 *      straight cut at its base into the grass. The fade matters: a hard clip
 *      made the house look sunk in a trench, because this patch of terrain is
 *      smooth grass with no foliage to plausibly overlap it.
 *
 * The scene light is applied last, over the house as well as the terrain, so
 * both sit under one sun.
 */

/** House width as a % of the scene, so it scales with the art, not the viewport. */
const HOUSE_WIDTH = 33;
/** % from the bottom of the scene where the sprite's box sits. */
const HOUSE_BASE = 34;
/** Where the building's base sits inside its own sprite, which is padded. */
const SPRITE_BASE = 93;
/** The band over which terrain fades in front of the house, in scene %. */
const GROUND_FADE_START = 62;
const GROUND_FADE_END = 66.5;

const GROUND_MASK = `linear-gradient(to bottom, transparent ${GROUND_FADE_START}%, rgba(0,0,0,0.55) ${
  (GROUND_FADE_START + GROUND_FADE_END) / 2
}%, #000 ${GROUND_FADE_END}%)`;

export function CartoonExterior({ houseStyleId, onEnter }: CartoonExteriorProps) {
  const house = getHouseStyle(houseStyleId) ?? getHouseStyle("cottage")!;

  return (
    <div className="panel">
      <GameHud houseStyleId={houseStyleId} mode="outside" hint={house.description} />

      <div className="relative aspect-[3/2] w-full overflow-hidden">
        {/* 1 — the terrain */}
        <Image
          src={YARD_CARTOON_BG}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="(max-width: 900px) 100vw, 900px"
        />

        {/* 2 — the building, with its own cast shadow */}
        {house.exteriorImage && (
          <div
            className="absolute"
            style={{
              left: "50%",
              bottom: `${HOUSE_BASE}%`,
              width: `${HOUSE_WIDTH}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="relative aspect-[3/2] w-full">
              <Image
                src={house.exteriorImage}
                alt={`${house.name} exterior`}
                fill
                className="object-contain object-bottom"
                priority
                sizes="(max-width: 640px) 55vw, 400px"
              />
            </div>
          </div>
        )}

        {/* 3 — the terrain again, faded in over the sprite's base */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ WebkitMaskImage: GROUND_MASK, maskImage: GROUND_MASK }}
        >
          <Image
            src={YARD_CARTOON_BG}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="(max-width: 900px) 100vw, 900px"
          />
        </div>

        {/* 4 — the shadow lies ON the ground, so it is painted after it. The
            silhouette is the sprite itself, flipped about its base, squashed
            and sheared away from the light. */}
        {house.exteriorImage && (
          <div
            aria-hidden
            className="absolute"
            style={{
              left: "50%",
              bottom: `${HOUSE_BASE}%`,
              width: `${HOUSE_WIDTH}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="relative aspect-[3/2] w-full">
              <div
                className="absolute inset-0"
                style={{
                  transformOrigin: `50% ${SPRITE_BASE}%`,
                  transform: "scaleY(-0.24) skewX(-21deg)",
                  filter: "brightness(0) blur(3.5px)",
                  opacity: 0.3,
                }}
              >
                <Image
                  src={house.exteriorImage}
                  alt=""
                  fill
                  className="object-contain object-bottom"
                  sizes="(max-width: 640px) 55vw, 400px"
                />
              </div>

              {/* The tight dark seam where the walls meet the ground. */}
              <div
                className="absolute left-1/2 w-[62%] -translate-x-1/2"
                style={{
                  top: `${SPRITE_BASE - 1.5}%`,
                  height: "5%",
                  background:
                    "radial-gradient(ellipse at 50% 35%, rgba(28,38,12,0.45) 0%, rgba(28,38,12,0.20) 50%, rgba(28,38,12,0) 78%)",
                }}
              />
            </div>
          </div>
        )}

        {/* 5 — one sun over the whole scene, house included */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_34%,rgba(255,246,214,0.20),transparent_58%),radial-gradient(ellipse_at_center,transparent_56%,rgba(20,40,10,0.20))]" />

        {/* 6 — the one call to action, standing on the path */}
        <div className="absolute inset-x-0 bottom-[9%] flex justify-center">
          <button
            type="button"
            onClick={onEnter}
            className="btn-primary px-9 py-3 text-base shadow-raised"
          >
            Step inside
          </button>
        </div>
      </div>
    </div>
  );
}
