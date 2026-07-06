"use client";

import Image from "next/image";
import { GameHud } from "@/components/house/GameHud";
import { YARD_CARTOON_BG, getHouseStyle } from "@/data/house-catalog";

interface CartoonExteriorProps {
  houseStyleId: string;
  bridgeys: number;
  onEnter: () => void;
}

export function CartoonExterior({ houseStyleId, bridgeys, onEnter }: CartoonExteriorProps) {
  const house = getHouseStyle(houseStyleId) ?? getHouseStyle("cottage")!;

  return (
    <div className="space-y-3">
      <GameHud
        houseStyleId={houseStyleId}
        bridgeys={bridgeys}
        mode="outside"
        hint="Press Enter House to walk inside and decorate!"
      />

      <div className="relative overflow-hidden rounded-2xl border-4 border-slate-900 shadow-2xl">
        {/* AI cartoon yard — full scene background */}
        <div className="relative aspect-[2/1] min-h-[320px] w-full sm:min-h-[400px]">
          <Image
            src={YARD_CARTOON_BG}
            alt="Cartoon yard"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 800px) 100vw, 800px"
          />

          {/* House cutout — transparent PNG overlaid on the yard */}
          <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center">
            {house.exteriorImage && (
              <div className="relative h-44 w-full max-w-sm sm:h-56">
                <Image
                  src={house.exteriorImage}
                  alt={`${house.name} exterior`}
                  fill
                  className="object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
                  priority
                  sizes="(max-width: 640px) 80vw, 400px"
                />
              </div>
            )}

            <div className="mt-2 text-center">
              <h2 className="font-display text-2xl tracking-wide text-slate-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)] sm:text-3xl">
                {house.emoji} {house.name}
              </h2>
              <p className="mt-1 max-w-sm text-sm font-medium text-slate-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                {house.description}
              </p>
            </div>

            <button
              type="button"
              onClick={onEnter}
              className="game-btn-primary mt-5 rounded-2xl px-10 py-3.5 text-lg font-bold shadow-lg transition hover:scale-105 active:scale-95"
            >
              🚪 Enter House
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
