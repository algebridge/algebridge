import { DollhouseScene } from "@/components/house/DollhouseScene";

interface HouseThumbProps {
  styleId: string;
  className?: string;
}

/**
 * A house on a shop card.
 *
 * This is the same drawing as the House itself, not a picture of it. The shop
 * used to show a ray-marched render while the House showed something else, so
 * a student bought one building and moved into another. One source means the
 * card can never drift from the thing it is selling, and a new style needs no
 * card art at all.
 */
export function HouseThumb({ styleId, className = "" }: HouseThumbProps) {
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {/* Cropped in the viewBox rather than with a CSS scale. Scaling the
          whole scene up and clipping it cut the roof off the top and the
          garden off the bottom; moving the crop into the drawing frames the
          building itself, whatever shape the card is. */}
      <DollhouseScene styleId={styleId} open={false} frame="house" />
    </div>
  );
}
