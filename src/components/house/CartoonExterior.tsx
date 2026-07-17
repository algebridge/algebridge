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

          {/* soft depth: brighten the sky, gently darken the edges */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(ellipse_at_center,transparent_58%,rgba(0,0,0,0.22))]" />

          {/* House cutout — transparent PNG overlaid on the yard */}
          <div className="absolute inset-x-0 bottom-[7%] flex flex-col items-center">
            {house.exteriorImage && (
              <div className="flex flex-col items-center">
                <div className="animate-gentle-bounce relative h-44 w-full max-w-sm sm:h-56">
                  <Image
                    src={house.exteriorImage}
                    alt={`${house.name} exterior`}
                    fill
                    className="object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.3)]"
                    priority
                    sizes="(max-width: 640px) 80vw, 400px"
                  />
                </div>
                {/* static ground shadow so the floating house feels grounded */}
                <div className="-mt-1 h-3 w-36 rounded-[100%] bg-black/30 blur-md sm:w-44" />
              </div>
            )}

            <div className="mt-3 max-w-sm rounded-2xl bg-white/75 px-5 py-2.5 text-center shadow-lg ring-1 ring-black/5 backdrop-blur-sm">
              <h2 className="font-display text-2xl tracking-wide text-slate-900 sm:text-3xl">
                {house.emoji} {house.name}
              </h2>
              <p className="mt-0.5 text-sm font-medium text-slate-600">
                {house.description}
              </p>
            </div>

            <button
              type="button"
              onClick={onEnter}
              className="game-btn-primary mt-4 rounded-2xl px-10 py-3.5 text-lg font-bold shadow-lg transition hover:scale-105 active:scale-95"
            >
              🚪 Enter House
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
