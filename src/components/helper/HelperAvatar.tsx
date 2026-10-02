import { ArchieFace, type FaceMood } from "@/components/archie/Archie";

/** Archie's face, which is who the helper speaks as: beside replies and the typing dots. */
export function HelperAvatar({ size = 26, mood = "idle", className = "" }: { size?: number; mood?: FaceMood; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full ring-2 ring-white ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <ArchieFace size={size} mood={mood} />
    </span>
  );
}
