import { HelperAvatar } from "./HelperAvatar";

/** Three dots in a bubble while a reply is on its way, with Archie looking up, thinking. */
export function TypingDots() {
  return (
    <div className="helper-in flex items-end gap-2">
      <HelperAvatar size={26} mood="thinking" />
      <div
        role="status"
        aria-label="Archie is writing a reply"
        className="flex h-9 items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 text-bridge-400 shadow-sm"
      >
        <span className="helper-dot" />
        <span className="helper-dot" />
        <span className="helper-dot" />
      </div>
    </div>
  );
}
