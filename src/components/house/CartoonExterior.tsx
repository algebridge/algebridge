"use client";

import Image from "next/image";
import { GameHud } from "@/components/house/GameHud";
import { YARD_CARTOON_BG, getHouseStyle } from "@/data/house-catalog";

interface CartoonExteriorProps {
  houseStyleId: string;
  onEnter: () => void;
}

/**
 * The yard. Framed as an ordinary panel — header strip, then the art edge to
 * edge in the body — rather than the old free-floating box with a 4px black
 * border. The scene is the only saturated thing on the page, which is the
 * point: it is the thing the student earned.
 */
export function CartoonExterior({ houseStyleId, onEnter }: CartoonExteriorProps) {
  const house = getHouseStyle(houseStyleId) ?? getHouseStyle("cottage")!;

  return (
    <div className="panel">
      <GameHud
        houseStyleId={houseStyleId}
        mode="outside"
        hint={house.description}
      />

      <div className="relative aspect-[2/1] min-h-[320px] w-full sm:min-h-[420px]">
        <Image
          src={YARD_CARTOON_BG}
          alt=""
          fill
          className="object-cover"
          priority
          sizes="(max-width: 900px) 100vw, 900px"
        />

        {/* Soft depth: lift the sky, settle the edges. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(ellipse_at_center,transparent_58%,rgba(0,0,0,0.20))]" />

        {/* The house, and one call to action. The name and description live in
            the header strip above, so the old translucent card that repeated
            them over the art is gone. */}
        {/* Everything in the scene is sized as a percentage of the scene, not
            in fixed pixels. The house used to be a fixed 384px wide, which was
            right inside the old 800px box and left it stranded once the art
            went full width. */}
        <div className="absolute inset-x-0 bottom-[9%] flex flex-col items-center">
          {house.exteriorImage && (
            <div className="flex w-[34%] min-w-[180px] max-w-[440px] flex-col items-center">
              <div className="animate-gentle-bounce relative aspect-square w-full">
                <Image
                  src={house.exteriorImage}
                  alt={`${house.name} exterior`}
                  fill
                  className="object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.32)]"
                  priority
                  sizes="(max-width: 640px) 60vw, 440px"
                />
              </div>
              <div className="-mt-[6%] h-[3%] min-h-[10px] w-[55%] rounded-[100%] bg-black/30 blur-md" />
            </div>
          )}

          <button
            type="button"
            onClick={onEnter}
            className="btn-primary mt-6 px-9 py-3 text-base shadow-raised"
          >
            Step inside
          </button>
        </div>
      </div>
    </div>
  );
}
