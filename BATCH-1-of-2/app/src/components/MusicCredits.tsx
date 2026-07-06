import { MUSIC_TRACKS } from "@/data/musicTracks";

/** Required attribution for the CC BY–licensed background music tracks. */
export function MusicCredits() {
  return (
    <details className="mx-auto mt-3 max-w-md text-xs text-slate-400">
      <summary className="cursor-pointer select-none hover:text-slate-600">🎵 Background music credits</summary>
      <ul className="mt-2 space-y-1 text-left">
        {MUSIC_TRACKS.map((track) => (
          <li key={track.id}>{track.credit}</li>
        ))}
      </ul>
    </details>
  );
}
