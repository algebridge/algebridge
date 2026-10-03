import { MUSIC_TRACKS } from "@/data/musicTracks";
import { Icon } from "@/components/Icon";

/** Required attribution for the CC BY-licensed background music tracks. */
export function MusicCredits() {
  return (
    <details className="mx-auto mt-2 max-w-md text-xs text-slate-400">
      {/* py-1: a 24 px tall target on a phone. */}
      <summary className="cursor-pointer select-none py-1 hover:text-slate-600">
        <Icon name="music" size={13} className="mr-1 inline-block align-[-2px]" />
        Background music credits
      </summary>
      <ul className="mt-2 space-y-1 text-left">
        {MUSIC_TRACKS.map((track) => (
          <li key={track.id}>{track.credit}</li>
        ))}
      </ul>
    </details>
  );
}
