/**
 * Deterministic room id for a pair of users, independent of who initiates.
 * Both participants compute the same id from their two user ids, so a call
 * link always lands them in the same room.
 */
export function roomIdFor(a: string, b: string): string {
  return [a, b].sort().join("--");
}

/** Recover both user ids from a room id built by roomIdFor. */
export function participantsFromRoom(roomId: string): [string, string] | null {
  const parts = roomId.split("--");
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}
