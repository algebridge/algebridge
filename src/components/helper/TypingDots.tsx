import { HelperAvatar } from "./HelperAvatar";
import { BubbleTail } from "./MessageBubble";

/**
 * Three dots in Archie's own bubble while a reply is on its way, with him
 * looking up, thinking. They only move while they are on screen, which is
 * only while a reply is coming.
 */
export function TypingDots() {
  return (
    <div className="archie-pop flex items-start gap-2.5">
      <HelperAvatar size={28} mood="thinking" className="mt-0.5" />
      <div role="status" aria-label="Archie is writing a reply" className="archie-bubble archie-typing">
        <BubbleTail />
        <span className="archie-tdots" aria-hidden="true">
          <span className="helper-dot" />
          <span className="helper-dot" />
          <span className="helper-dot" />
        </span>
      </div>
    </div>
  );
}
