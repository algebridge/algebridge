import { POST as helperPOST } from "@/app/api/helper/route";

/**
 * The old tutor chat endpoint, kept so nothing that still calls it breaks.
 *
 * It used to call claude-opus-4-8 straight from the client's context with no
 * answer filter, no crisis check and no limit, which made it both a way
 * around the no-answer rule and a free model proxy. It now hands the request
 * to /api/helper, which reads the same { context, messages } body (the extra
 * TutorContext fields are ignored) and answers it in tutor mode: same crisis
 * reply, same gates, same filter, same provider policy, same budget per IP.
 * The response keeps the { message, source } shape fetchTutorChat expects.
 *
 * Nothing in the app calls this today; StudyHelper talks to /api/helper.
 */
export async function POST(request: Request) {
  return helperPOST(request);
}
