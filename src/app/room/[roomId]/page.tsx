"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Notebook } from "@/components/Notebook";
import { Whiteboard, type WhiteboardHandle, type WbSegment } from "@/components/Whiteboard";
import {
  getPublicProfile,
  finishCallSession,
  loadNotebook,
  markCallBridgeysAwarded,
  sendMessage,
  startCallSession,
  type PublicProfile,
} from "@/lib/social";
import { getProgress, saveProgress } from "@/lib/progress";
import { awardBridgeys } from "@/lib/bridgeys";
import { showToast, fireConfetti } from "@/lib/notify";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const CALL_BRIDGEYS = 10;

type Status = "init" | "waiting" | "connecting" | "live" | "ended" | "error";
type Tab = "whiteboard" | "notebook";

// Minimal shape of the Web Speech API we use (not in the TS DOM lib).
/* eslint-disable @typescript-eslint/no-explicit-any */
function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function CallRoomPage() {
  const params = useParams();
  const search = useSearchParams();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : (params.roomId as string);
  const otherId = search.get("with") ?? "";

  const { user, profile, loading } = useAuth();
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<Status>("init");
  const [tab, setTab] = useState<Tab>("whiteboard");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [transcriptView, setTranscriptView] = useState<{ name: string; text: string }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const wbRef = useRef<WhiteboardHandle>(null);
  const transcriptRef = useRef<{ name: string; text: string }[]>([]);
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const callSessionIdRef = useRef<string | null>(null);
  const finalizedRef = useRef(false);
  const wasLiveRef = useRef(false);

  const myName = profile?.displayName || user?.email?.split("@")[0] || "Me";

  // Role math: exactly one tutor in the pair makes it a "tutor call".
  const myRole = profile?.role ?? "student";
  const otherRole = other?.role ?? "student";
  const isTutorCall = (myRole === "tutor") !== (otherRole === "tutor");
  const iAmStudent = isTutorCall && myRole !== "tutor";
  // The student finalizes tutor calls (they get the summary + Bridgeys);
  // otherwise the peer with the lower id does the bookkeeping.
  const iAmFinalizer = isTutorCall ? iAmStudent : (!!user && user.id < otherId);

  const addTranscript = useCallback((name: string, text: string) => {
    transcriptRef.current.push({ name, text });
    setTranscriptView((prev) => [...prev.slice(-40), { name, text }]);
  }, []);

  // ----- finalize: summarize, deliver, award -----
  const finalize = useCallback(async () => {
    if (finalizedRef.current || !wasLiveRef.current) return;
    finalizedRef.current = true;
    if (!iAmFinalizer) return;

    setSummarizing(true);
    const lines = transcriptRef.current.map((t) => `${t.name}: ${t.text}`).join("\n");
    let notes = "";
    try {
      notes = await loadNotebook();
    } catch {
      /* ignore */
    }

    let summaryText = "";
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: lines,
          notes,
          studentName: iAmStudent ? myName : other?.displayName,
          tutorName: iAmStudent ? other?.displayName : myName,
        }),
      });
      const data = await res.json();
      summaryText = data.summary ?? "";
    } catch {
      summaryText = "Your call has ended. Nice work today!";
    }
    setSummary(summaryText);
    setSummarizing(false);

    // Send the recap to the other participant as a message.
    if (otherId && summaryText) {
      sendMessage(otherId, `📝 Call recap:\n\n${summaryText}`);
    }

    if (isTutorCall && callSessionIdRef.current) {
      await finishCallSession(callSessionIdRef.current, summaryText);
      // Award Bridgeys to the student, exactly once per call (DB-gated).
      if (iAmStudent) {
        const firstTime = await markCallBridgeysAwarded(callSessionIdRef.current);
        if (firstTime) {
          const p = getProgress();
          awardBridgeys(p, CALL_BRIDGEYS);
          saveProgress(p);
          fireConfetti("small");
          showToast({
            emoji: "🪙",
            title: `+${CALL_BRIDGEYS} Bridgeys!`,
            description: "Thanks for meeting with your tutor.",
          });
        }
      }
    }
  }, [iAmFinalizer, iAmStudent, isTutorCall, myName, other, otherId]);

  // ----- teardown -----
  const cleanup = useCallback((broadcastBye: boolean) => {
    if (broadcastBye && channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "bye", payload: {} });
    }
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      const sb = createClient();
      sb?.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  async function endCall() {
    setStatus("ended");
    await finalize();
    cleanup(true);
  }

  // Load the other participant's profile.
  useEffect(() => {
    if (!otherId) return;
    getPublicProfile(otherId).then(setOther);
  }, [otherId]);

  // ---- main setup (once we know who we are) ----
  useEffect(() => {
    if (loading || !user || !otherId || !other) return;
    const supabase = createClient();
    if (!supabase) {
      setStatus("error");
      setMediaError("Video calls need cloud accounts to be configured.");
      return;
    }

    let cancelled = false;
    const initiator = user.id < otherId; // deterministic caller

    (async () => {
      setStatus("connecting");

      // 1) Local media (camera + mic). Degrade gracefully if denied.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setMediaError("Camera/mic unavailable — you can still use the whiteboard, notebook, and chat.");
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (stream) {
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      // 2) Peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream?.getTracks().forEach((t) => pc.addTrack(t, stream!));

      const remoteStream = new MediaStream();
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: { kind: "ice", candidate: e.candidate.toJSON() },
          });
        }
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "connected") {
          setStatus("live");
          wasLiveRef.current = true;
        } else if (st === "failed" || st === "disconnected") {
          setStatus((s) => (s === "ended" ? s : "waiting"));
        }
      };

      // 3) Signaling + data over one Realtime channel. The topic must stay
      //    shared with the peer, so first drop any stale channel with this
      //    topic on our own client (supabase-js reuses same-topic channels,
      //    and calling .on() on an already-subscribed one throws).
      supabase
        .getChannels()
        .filter((c) => c.topic === `realtime:room-${roomId}`)
        .forEach((c) => supabase.removeChannel(c));
      const channel = supabase.channel(`room-${roomId}`, {
        config: { broadcast: { self: false }, presence: { key: user.id } },
      });
      channelRef.current = channel;

      async function makeOffer() {
        const pc2 = pcRef.current;
        if (!pc2 || pc2.signalingState !== "stable") return;
        const offer = await pc2.createOffer();
        await pc2.setLocalDescription(offer);
        channel.send({ type: "broadcast", event: "signal", payload: { kind: "offer", sdp: offer } });
      }

      channel
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
          const pc2 = pcRef.current;
          if (!pc2) return;
          try {
            if (payload.kind === "offer" && !initiator) {
              await pc2.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const answer = await pc2.createAnswer();
              await pc2.setLocalDescription(answer);
              channel.send({
                type: "broadcast",
                event: "signal",
                payload: { kind: "answer", sdp: answer },
              });
            } else if (payload.kind === "answer" && initiator) {
              await pc2.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } else if (payload.kind === "ice") {
              await pc2.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
          } catch {
            /* ignore malformed signaling */
          }
        })
        .on("broadcast", { event: "draw" }, ({ payload }) => {
          wbRef.current?.applySegment(payload as WbSegment);
        })
        .on("broadcast", { event: "clear" }, () => wbRef.current?.applyClear())
        .on("broadcast", { event: "transcript" }, ({ payload }) => {
          addTranscript(payload.name, payload.text);
        })
        .on("broadcast", { event: "bye" }, () => {
          setStatus("ended");
          finalize();
          cleanup(false);
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const others = Object.keys(state).filter((k) => k !== user.id);
          if (others.length > 0) {
            if (initiator) makeOffer();
          } else {
            setStatus((s) => (s === "live" || s === "ended" ? s : "waiting"));
          }
        })
        .subscribe((st) => {
          if (st === "SUBSCRIBED") channel.track({ userId: user.id, name: myName });
        });

      // 4) Create the call record (student side, tutor calls only).
      if (iAmFinalizer && isTutorCall) {
        const studentId = iAmStudent ? user.id : otherId;
        const tutorId = iAmStudent ? otherId : user.id;
        callSessionIdRef.current = await startCallSession(roomId, studentId, tutorId);
      }
    })();

    return () => {
      cancelled = true;
      cleanup(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, otherId, other]);

  // ---- live captions / transcript via Web Speech API ----
  useEffect(() => {
    if (!captions) {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (text) {
            addTranscript(myName, text);
            channelRef.current?.send({
              type: "broadcast",
              event: "transcript",
              payload: { name: myName, text },
            });
          }
        }
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      // Auto-restart while captions stay on (recognition times out periodically).
      if (recognitionRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      /* ignore */
    }
    return () => {
      rec.onend = null;
      rec.stop?.();
    };
  }, [captions, myName, addTranscript]);

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }
  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  // ---------- render ----------
  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl text-slate-900">Video Call</h1>
        <p className="text-slate-600">Sign in to join the call.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  const statusLabel: Record<Status, string> = {
    init: "Starting…",
    connecting: "Connecting…",
    waiting: `Waiting for ${other?.displayName ?? "the other person"} to join…`,
    live: "Connected",
    ended: "Call ended",
    error: "Can't start call",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={other?.displayName} url={other?.avatarUrl} size={44} />
          <div>
            <h1 className="font-semibold text-slate-900">
              Call with {other?.displayName ?? "…"}
            </h1>
            <p className="text-xs text-slate-500">
              <span
                className={`mr-1 inline-block h-2 w-2 rounded-full ${
                  status === "live" ? "bg-emerald-500" : status === "ended" ? "bg-slate-400" : "bg-amber-500"
                }`}
              />
              {statusLabel[status]}
              {isTutorCall && iAmStudent && status !== "ended" && (
                <span className="ml-2 text-amber-600">· earn {CALL_BRIDGEYS} 🪙 for this call</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/messages/${otherId}`} className="btn-secondary text-sm">💬 Chat</Link>
          {status !== "ended" ? (
            <button type="button" onClick={endCall} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              End call
            </button>
          ) : (
            <Link href="/" className="btn-primary text-sm">Done</Link>
          )}
        </div>
      </div>

      {mediaError && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{mediaError}</div>
      )}

      {status === "ended" ? (
        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-slate-900">📝 Call summary</h2>
          {summarizing ? (
            <p className="text-slate-500">Generating your recap…</p>
          ) : summary ? (
            <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              {summary}
            </div>
          ) : (
            <p className="text-slate-600">
              This call has ended.{" "}
              {isTutorCall && !iAmStudent
                ? "Your student will receive an AI recap, and it's saved to your messages."
                : "A recap will appear in your messages."}
            </p>
          )}
          <div className="flex gap-2">
            <Link href={`/messages/${otherId}`} className="btn-secondary text-sm">Go to messages</Link>
            <Link href="/" className="btn-primary text-sm">Back to course</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Video column */}
          <div className="space-y-3 lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl bg-slate-900" style={{ aspectRatio: "3 / 4" }}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
              {status !== "live" && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                  {statusLabel[status]}
                </div>
              )}
              {/* Local PiP */}
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-3 right-3 h-28 w-20 rounded-lg border-2 border-white/70 object-cover shadow-lg"
              />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${micOn ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700"}`}
              >
                {micOn ? "🎤 Mic on" : "🔇 Mic off"}
              </button>
              <button
                type="button"
                onClick={toggleCam}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${camOn ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700"}`}
              >
                {camOn ? "📹 Cam on" : "🚫 Cam off"}
              </button>
              <button
                type="button"
                onClick={() => setCaptions((c) => !c)}
                title="Live captions power the AI summary at the end of the call"
                className={`rounded-xl px-4 py-2 text-sm font-medium ${captions ? "bg-bridge-100 text-bridge-700" : "bg-slate-100 text-slate-700"}`}
              >
                {captions ? "💬 Captions on" : "💬 Captions off"}
              </button>
            </div>
            {captions && (
              <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                {transcriptView.length === 0 ? (
                  <p className="text-slate-400">Listening… speak and your words appear here.</p>
                ) : (
                  transcriptView.map((t, i) => (
                    <p key={i}>
                      <span className="font-semibold text-slate-800">{t.name}:</span> {t.text}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Tools column: whiteboard / notebook (calculator is the floating button) */}
          <div className="lg:col-span-3">
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setTab("whiteboard")}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === "whiteboard" ? "bg-bridge-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                ✏️ Whiteboard
              </button>
              <button
                type="button"
                onClick={() => setTab("notebook")}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === "notebook" ? "bg-bridge-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                📓 Notebook
              </button>
              <span className="ml-auto self-center text-xs text-slate-400">
                Use the 🧮 button (bottom-right) for the calculator
              </span>
            </div>
            <div className="card h-[70vh]">
              {/* Keep both mounted so switching tabs doesn't wipe the canvas. */}
              <div className={tab === "whiteboard" ? "h-full" : "hidden"}>
                <Whiteboard
                  ref={wbRef}
                  onSegment={(seg) =>
                    channelRef.current?.send({ type: "broadcast", event: "draw", payload: seg })
                  }
                  onClear={() =>
                    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} })
                  }
                />
              </div>
              <div className={tab === "notebook" ? "h-full" : "hidden"}>
                <Notebook compact />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
