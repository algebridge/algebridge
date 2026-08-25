"use client";

import Image from "next/image";
import { GameHud } from "@/components/house/GameHud";
import { YardBackdrop, YardForeground } from "@/components/house/YardScene";
import { getHouseStyle } from "@/data/house-catalog";
import { PAD_SCREEN_Y } from "@/components/house/YardScene";
import { SCENE_GROUND_Y, SCENE_H, getYardScene } from "@/data/yard-scenes";

interface CartoonExteriorProps {
  houseStyleId: string;
  onEnter: () => void;
}

/*
 * The house standing in its own yard.
 *
 * Each house style has its own scene — meadow, forest, rooftops, shore,
 * mountains — drawn as vector art in the same flat, outlined language as the
 * house sprites. That is what makes the two read as one picture: the previous
 * single background was a soft painting, and flat clipart cannot sit inside a
 * painting no matter how it is composited.
 *
 * The stack is backdrop, then the building, then foreground. Because the
 * nearest bank of grass is painted after the house, real terrain passes in
 * front of the sprite's flat bottom edge instead of the edge being visible as
 * a straight cut across the ground.
 */

/** House width as a % of the scene, so it scales with the art, not the viewport. */
const HOUSE_WIDTH = 37;
/** Where the building's base sits inside its own padded sprite. */
const SPRITE_BASE = 93;

/**
 * Put the sprite's base on the ground it is meant to stand on. For a rendered
 * yard that is the levelled pad, whose screen position comes from the
 * renderer's camera; for a drawn one it is the scene's shared ground line.
 */
const PAD_BOTTOM_PCT = 100 - PAD_SCREEN_Y * 100;
const DRAWN_BOTTOM_PCT = 100 - (SCENE_GROUND_Y / SCENE_H) * 100;

export function CartoonExterior({ houseStyleId, onEnter }: CartoonExteriorProps) {
  const house = getHouseStyle(houseStyleId) ?? getHouseStyle("cottage")!;
  const scene = getYardScene(house.id);

  const placement = {
    left: "50%",
    bottom: `${scene.image ? PAD_BOTTOM_PCT : DRAWN_BOTTOM_PCT}%`,
    width: `${HOUSE_WIDTH}%`,
    transform: "translateX(-50%)",
  } as const;

  return (
    <div className="panel">
      <GameHud houseStyleId={houseStyleId} mode="outside" hint={house.description} />

      <div className="relative aspect-[3/2] w-full overflow-hidden">
        <YardBackdrop scene={scene} />

        {/* The building's shadow, on the ground it stands on. It is the sprite
            itself flipped about its base, squashed and sheared away from the
            light — a plain ellipse reads as a disc a sprite hovers over. */}
        {house.exteriorImage && (
          <div aria-hidden className="absolute" style={placement}>
            <div className="relative aspect-[3/2] w-full">
              <div
                className="absolute inset-0"
                style={{
                  transformOrigin: `50% ${SPRITE_BASE}%`,
                  transform: "scaleY(-0.24) skewX(-21deg)",
                  filter: "brightness(0) blur(3.5px)",
                  opacity: 0.26,
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
              <div
                className="absolute left-1/2 w-[62%] -translate-x-1/2"
                style={{
                  top: `${SPRITE_BASE - 1.5}%`,
                  height: "5%",
                  background: `radial-gradient(ellipse at 50% 35%, ${scene.shadow}66 0%, ${scene.shadow}33 50%, ${scene.shadow}00 78%)`,
                }}
              />
            </div>
          </div>
        )}

        {house.exteriorImage && (
          <div className="absolute" style={placement}>
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

        <YardForeground scene={scene} />

        {/* One light over the whole scene, house included. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_32%,rgba(255,248,222,0.16),transparent_60%),radial-gradient(ellipse_at_center,transparent_58%,rgba(20,30,12,0.20))]" />

        <div className="absolute inset-x-0 bottom-[7%] flex justify-center">
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
