/**
 * A call room's id is its members' user ids, sorted and joined by "--", so
 * everyone computes the same id from the same people, whoever starts the
 * call. Two ids is a call; three to eight is a group call. The database lets
 * only the people named in the id into the room (realtime.messages policy).
 */

export const MAX_CALL_MEMBERS = 8;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The room for these people (duplicates dropped). */
export function roomIdFor(...ids: string[]): string {
  return [...new Set(ids)].sort().join("--");
}

/** Everyone in a room, or null for an id that is not one. */
export function participantsFromRoom(roomId: string): string[] | null {
  const parts = roomId.split("--");
  if (parts.length < 2 || parts.length > MAX_CALL_MEMBERS) return null;
  if (new Set(parts).size !== parts.length) return null;
  if (!parts.every((p) => UUID.test(p))) return null;
  return parts;
}

/**
 * In a group call everyone connects to everyone. Each pair makes one
 * connection, and the lower id sends the first offer, so two people never
 * both offer at once.
 */
export function offersTo(myId: string, otherId: string): boolean {
  return myId < otherId;
}
