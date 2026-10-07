"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { Notebook } from "@/components/Notebook";
import { Whiteboard, type WhiteboardHandle, type WbSegment } from "@/components/Whiteboard";
import { offersTo, participantsFromRoom } from "@/lib/call-utils";
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
import { Icon } from "@/components/Icon";
import { isBlocked } from "@/lib/safety";
import { BlockButton, ReportButton, useBlockedList } from "@/components/ReportButton";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const CALL_BRIDGEYS = 10;

type Status = "init" | "waiting" | "connecting" | "live" | "ended" | "error";
type Tab = "whiteboard" | "notebook";

/** One connection to one other person in the room. */
interface Peer {
  pc: RTCPeerConnection;
  stream: MediaStream;
  /** ICE candidates that came before the other side's description. */
  pending: RTCIceCandidateInit[];
}

// Minimal shape of the Web Speech API we use (not in the TS DOM lib).
/* eslint-disable @typescript-eslint/no-explicit-any */
function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const isStaffRole = (p: PublicProfile | null | undefined) => p?.role === "tutor" || p?.role === "teacher";

/**
 * A video call: two people, or a group of up to eight (tutors and students).
 *
 * The room id is the members' ids (lib/call-utils.ts), and only those people
 * may use its channel (the database's realtime policy). Everyone connects to
 * everyone; for each pair the lower id makes the offer. Signals carry who
 * they are from and for, so one channel serves the whole group.
 *
 * In a call with a tutor, each student keeps their own record of it: their
 * recap goes to the tutor as a message and they earn Bridgeys once. A student
 * never stays in a call with no tutor left in it.
 */
export default function CallRoomPage() {
  const params = useParams();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : (params.roomId as string);
  const { user, profile, loading } = useAuth();

  const members = useMemo(() => participantsFromRoom(roomId), [roomId]);
  const iAmMember = !!user && !!members && members.includes(user.id);
  const otherIds = useMemo(() => (user && members ? members.filter((m) => m !== user.id) : []), [user, members]);
  const group = otherIds.length > 1;

  const blockedList = useBlockedList();
  const [people, setPeople] = useState<Map<string, PublicProfile>>(new Map());
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [status, setStatus] = useState<Status>("init");
  const [tab, setTab] = useState<Tab>("whiteboard");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [transcriptView, setTranscriptView] = useState<{ name: string; text: string }[]>([]);
  /** Who is connected right now, and their video. */
  const [remotes, setRemotes] = useState<{ id: string; stream: MediaStream; live: boolean }[]>([]);
  const [present, setPresent] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef(new Map<string, Peer>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const wbRef = useRef<WhiteboardHandle>(null);
  const transcriptRef = useRef<{ name: string; text: string }[]>([]);
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const callSessionIdRef = useRef<string | null>(null);
  const finalizedRef = useRef(false);
  const wasLiveRef = useRef(false);

  const myName = profile?.displayName || user?.email?.split("@")[0] || "Me";

  // Who is who: the tutors in the room, and whether this is a tutoring call for me.
  const myRole = profile?.role ?? "student";
  const iAmStaff = myRole === "tutor" || myRole === "teacher" || !!profile?.isAdmin;
  const tutorIds = otherIds.filter((id) => isStaffRole(people.get(id)));
  const leadTutor = tutorIds[0] ?? null;
  const iAmStudent = !iAmStaff && !!leadTutor;
  // Students finalize their own tutoring call; with no tutor, the lowest id keeps the record of a two-person call.
  const iAmFinalizer = iAmStudent || (!leadTutor && !group && !!user && otherIds.every((id) => user.id < id));
  const nameOf = useCallback((id: string) => people.get(id)?.displayName?.trim() || "Someone", [people]);
  const blockedHere = otherIds.filter((id) => isBlocked(blockedList, id));

  const addTranscript = useCallback((name: string, text: string) => {
    transcriptRef.current.push({ name, text });
    setTranscriptView((prev) => [...prev.slice(-40), { name, text }]);
  }, []);

  const refreshRemotes = useCallback(() => {
    setRemotes(
      [...peersRef.current.entries()].map(([id, p]) => ({ id, stream: p.stream, live: p.pc.connectionState === "connected" }))
    );
  }, []);

  // ----- finalize: summarize, deliver, award -----
  const finalize = useCallback(async () => {
    if (finalizedRef.current || !wasLiveRef.current) return;
    finalizedRef.current = true;
    if (!iAmFinalizer) return;
    const recapTo = leadTutor ?? otherIds[0] ?? null;

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
          studentName: iAmStudent ? myName : recapTo ? nameOf(recapTo) : undefined,
          tutorName: iAmStudent && recapTo ? nameOf(recapTo) : myName,
        }),
      });
      const data = await res.json();
      summaryText = data.summary ?? "";
    } catch {
      summaryText = "Your call has ended. Nice work today!";
    }
    setSummary(summaryText);
    setSummarizing(false);

    // The recap goes to the tutor (or, in a call without one, the other person) as a message.
    if (recapTo && summaryText) {
      sendMessage(recapTo, `Call recap:\n\n${summaryText}`);
    }

    if (iAmStudent && callSessionIdRef.current) {
      await finishCallSession(callSessionIdRef.current, summaryText);
      // Bridgeys for the student, exactly once per call (DB-gated).
      const firstTime = await markCallBridgeysAwarded(callSessionIdRef.current);
      if (firstTime) {
        const p = getProgress();
        awardBridgeys(p, CALL_BRIDGEYS);
        saveProgress(p);
        fireConfetti("small");
        showToast({ icon: "coin", tone: "reward", title: `+${CALL_BRIDGEYS} Bridgeys`, description: "Thanks for meeting with your tutor." });
      }
    }
  }, [iAmFinalizer, iAmStudent, leadTutor, otherIds, myName, nameOf]);

  // ----- teardown -----
  const dropPeer = useCallback(
    (id: string) => {
      const p = peersRef.current.get(id);
      if (!p) return;
      p.pc.close();
      peersRef.current.delete(id);
      refreshRemotes();
    },
    [refreshRemotes]
  );

  const cleanup = useCallback(
    (broadcastBye: boolean) => {
      if (broadcastBye && channelRef.current && user) {
        channelRef.current.send({ type: "broadcast", event: "bye", payload: { from: user.id } });
      }
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      for (const p of peersRef.current.values()) p.pc.close();
      peersRef.current.clear();
      if (channelRef.current) {
        const sb = createClient();
        sb?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    },
    [user]
  );

  async function endCall() {
    setStatus("ended");
    await finalize();
    cleanup(true);
  }

  // Everyone else's profile.
  useEffect(() => {
    if (!otherIds.length) return;
    let live = true;
    Promise.all(otherIds.map((id) => getPublicProfile(id))).then((list) => {
      if (!live) return;
      const m = new Map<string, PublicProfile>();
      list.forEach((p, i) => p && m.set(otherIds[i], p));
      setPeople(m);
      setPeopleLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [otherIds]);

  // Refuse a call link that isn't for this account.
  useEffect(() => {
    if (!loading && user && !iAmMember) {
      setStatus("error");
      setMediaError("This call link isn't for your account.");
    }
  }, [loading, user, iAmMember]);

  const allBlocked = otherIds.length > 0 && blockedHere.length === otherIds.length;
  useEffect(() => {
    if (allBlocked) {
      setStatus("error");
      setMediaError("You blocked the people in this call on this device, so it will not connect.");
    }
  }, [allBlocked]);


  // ---- main setup (once we know who we are) ----
  useEffect(() => {
    if (loading || !user || !iAmMember || !peopleLoaded || allBlocked) return;
    const supabase = createClient();
    if (!supabase) {
      setStatus("error");
      setMediaError("Video calls need cloud accounts to be configured.");
      return;
    }
    const me = user.id;
    let cancelled = false;
    const skip = (id: string) => isBlocked(blockedList, id);

    (async () => {
      setStatus("connecting");
      // Private Realtime channels are authorized per topic, so the token goes first.
      await supabase.realtime.setAuth();

      // 1) Camera and mic. Without them, the whiteboard, notebook and chat still work.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setMediaError("Camera/mic unavailable. You can still use the whiteboard, notebook, and chat.");
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (stream) {
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }

      for (const c of supabase.getChannels().filter((c) => c.topic === `realtime:room-${roomId}`)) {
        await supabase.removeChannel(c);
      }
      const channel = supabase.channel(`room-${roomId}`, {
        config: { broadcast: { self: false }, presence: { key: me }, private: true },
      });
      channelRef.current = channel;
      const signal = (to: string, body: Record<string, unknown>) =>
        channel.send({ type: "broadcast", event: "signal", payload: { ...body, from: me, to } });

      // 2) One connection per person.
      function peerFor(id: string, fresh = false): Peer {
        const had = peersRef.current.get(id);
        if (had && !fresh) return had;
        if (had) had.pc.close();
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const peer: Peer = { pc, stream: new MediaStream(), pending: [] };
        localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
        pc.ontrack = (e) => {
          e.streams[0]?.getTracks().forEach((t) => peer.stream.addTrack(t));
          refreshRemotes();
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) signal(id, { kind: "ice", candidate: e.candidate.toJSON() });
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setStatus("live");
            wasLiveRef.current = true;
          }
          refreshRemotes();
        };
        peersRef.current.set(id, peer);
        refreshRemotes();
        return peer;
      }

      async function offer(id: string) {
        const peer = peerFor(id);
        if (peer.pc.signalingState !== "stable") return;
        const o = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(o);
        signal(id, { kind: "offer", sdp: o });
      }

      async function flush(peer: Peer) {
        for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => undefined);
      }

      channel
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
          const from = payload?.from as string | undefined;
          if (!from || payload.to !== me || !otherIds.includes(from) || skip(from)) return;
          try {
            if (payload.kind === "offer" && offersTo(from, me)) {
              // A new offer is a new connection (they may have rejoined).
              const peer = peerFor(from, !!peersRef.current.get(from)?.pc.remoteDescription);
              await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              await flush(peer);
              const answer = await peer.pc.createAnswer();
              await peer.pc.setLocalDescription(answer);
              signal(from, { kind: "answer", sdp: answer });
            } else if (payload.kind === "answer" && offersTo(me, from)) {
              const peer = peersRef.current.get(from);
              if (!peer || peer.pc.signalingState !== "have-local-offer") return;
              await peer.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              await flush(peer);
            } else if (payload.kind === "ice") {
              const peer = peerFor(from);
              if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              else peer.pending.push(payload.candidate);
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
        .on("broadcast", { event: "bye" }, ({ payload }) => {
          const from = payload?.from as string | undefined;
          if (from) dropPeer(from);
        })
        .on("presence", { event: "sync" }, () => {
          const here = Object.keys(channel.presenceState()).filter((k) => k !== me && otherIds.includes(k) && !skip(k));
          setPresent(here);
          for (const id of here) if (!peersRef.current.has(id) && offersTo(me, id)) void offer(id);
          for (const id of [...peersRef.current.keys()]) if (!here.includes(id)) dropPeer(id);
          if (!here.length) setStatus((s) => (s === "ended" ? s : "waiting"));
        })
        .subscribe((st) => {
          if (st === "SUBSCRIBED") channel.track({ userId: me, name: myName });
        });

      // 3) A student's own record of a tutoring call.
      if (iAmStudent && leadTutor) {
        callSessionIdRef.current = await startCallSession(roomId, me, leadTutor);
      }
    })();

    return () => {
      cancelled = true;
      // Leaving without pressing End call still sends the recap and tells the others.
      if (wasLiveRef.current && !finalizedRef.current) finalize();
      cleanup(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, iAmMember, peopleLoaded, allBlocked]);

  // Everyone has gone, or (for a student) every tutor has: the call is over.
  const connectedIds = remotes.filter((r) => r.live).map((r) => r.id);
  useEffect(() => {
    if (status !== "live" && status !== "waiting") return;
    if (!wasLiveRef.current) return;
    const tutorsLeft = present.some((id) => isStaffRole(people.get(id)));
    if (present.length === 0 || (iAmStudent && !tutorsLeft)) {
      setStatus("ended");
      void finalize();
      cleanup(true);
    }
  }, [present, status, iAmStudent, people, finalize, cleanup]);

  // Best-effort finalize on a hard tab close (React cleanup may not run).
  useEffect(() => {
    function onHide() {
      if (wasLiveRef.current && !finalizedRef.current) finalize();
    }
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [finalize]);

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
            channelRef.current?.send({ type: "broadcast", event: "transcript", payload: { name: myName, text } });
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
        <h1 className="page-title">Video Call</h1>
        <p className="text-slate-600">Sign in to join the call.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  const names = otherIds.map(nameOf);
  const title = group ? `Group call with ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` and ${names.length - 2} more` : ""}` : `Call with ${names[0] ?? "…"}`;
  const statusLabel: Record<Status, string> = {
    init: "Starting…",
    connecting: "Connecting…",
    waiting: group ? "Waiting for people to join…" : `Waiting for ${names[0] ?? "the other person"} to join…`,
    live: group ? `${connectedIds.length + 1} of ${otherIds.length + 1} here` : "Connected",
    ended: "Call ended",
    error: "Can't start call",
  };
  const chatWith = leadTutor ?? (group ? null : otherIds[0]);
  const solo = !group;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {otherIds.slice(0, 4).map((id) => (
              <span key={id} className="rounded-full ring-2 ring-white">
                <Avatar name={people.get(id)?.displayName} url={people.get(id)?.avatarUrl} size={solo ? 44 : 36} />
              </span>
            ))}
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-500">
              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${status === "live" ? "bg-emerald-500" : status === "ended" ? "bg-slate-400" : "bg-amber-500"}`} />
              {statusLabel[status]}
              {iAmStudent && status !== "ended" && <span className="ml-2 text-amber-700">· earn {CALL_BRIDGEYS} Bridgeys for this call</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {solo && otherIds[0] && iAmMember && (
            <>
              <ReportButton target={{ userId: otherIds[0], name: people.get(otherIds[0])?.displayName ?? null, place: "call", placeId: roomId }} />
              <BlockButton otherId={otherIds[0]} otherName={people.get(otherIds[0])?.displayName ?? null} />
            </>
          )}
          <Link href={chatWith ? `/messages/${chatWith}` : "/messages"} className="btn-secondary text-sm">
            <Icon name="messages" size={16} />
            Chat
          </Link>
          {status !== "ended" ? (
            <button type="button" onClick={endCall} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              {group ? "Leave call" : "End call"}
            </button>
          ) : (
            <Link href="/" className="btn-primary text-sm">Done</Link>
          )}
        </div>
      </div>

      {mediaError && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{mediaError}</div>}

      {status === "ended" ? (
        <div className="card space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Icon name="notebook" size={19} className="text-bridge-600" />
            Call summary
          </h2>
          {summarizing ? (
            <p className="text-slate-500">Generating your recap…</p>
          ) : summary ? (
            <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{summary}</div>
          ) : (
            <p className="text-slate-600">
              This call has ended.{" "}
              {iAmStaff ? "Each student gets an AI recap, and it's sent to your messages." : "A recap will appear in your messages."}
            </p>
          )}
          <div className="flex gap-2">
            <Link href={chatWith ? `/messages/${chatWith}` : "/messages"} className="btn-secondary text-sm">Go to messages</Link>
            <Link href="/" className="btn-primary text-sm">Back to the course</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Video column */}
          <div className="space-y-3 lg:col-span-2">
            {solo ? (
              <div className="relative overflow-hidden rounded-2xl bg-slate-900" style={{ aspectRatio: "3 / 4" }}>
                {remotes[0] && <VideoTile stream={remotes[0].stream} className="h-full w-full object-cover" />}
                {status !== "live" && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">{statusLabel[status]}</div>}
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-3 right-3 h-28 w-20 rounded-lg border-2 border-white/70 object-cover shadow-lg" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative overflow-hidden rounded-xl bg-slate-900" style={{ aspectRatio: "3 / 4" }}>
                  <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">You</span>
                </div>
                {otherIds.map((id) => {
                  const r = remotes.find((x) => x.id === id);
                  const here = present.includes(id);
                  return (
                    <div key={id} className="relative overflow-hidden rounded-xl bg-slate-900" style={{ aspectRatio: "3 / 4" }}>
                      {r && <VideoTile stream={r.stream} className="h-full w-full object-cover" />}
                      {!r?.live && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-300">
                          <Avatar name={people.get(id)?.displayName} url={people.get(id)?.avatarUrl} size={40} />
                          {blockedHere.includes(id) ? "Blocked" : here ? "Connecting…" : "Not here yet"}
                        </div>
                      )}
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">{nameOf(id)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={toggleMic} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${micOn ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700"}`}>
                <Icon name={micOn ? "mic" : "mic-off"} size={16} />
                {micOn ? "Mic on" : "Mic off"}
              </button>
              <button type="button" onClick={toggleCam} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${camOn ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700"}`}>
                <Icon name={camOn ? "video" : "video-off"} size={16} />
                {camOn ? "Camera on" : "Camera off"}
              </button>
              <button
                type="button"
                onClick={() => setCaptions((c) => !c)}
                title="Live captions power the AI summary at the end of the call"
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${captions ? "bg-bridge-100 text-bridge-700" : "bg-slate-100 text-slate-700"}`}
              >
                <Icon name="messages" size={16} />
                {captions ? "Captions on" : "Captions off"}
              </button>
            </div>
            {group && (
              <details className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">People in this call</summary>
                <ul className="mt-2 space-y-2">
                  {otherIds.map((id) => (
                    <li key={id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-slate-800">
                        {nameOf(id)}
                        <span className="ml-1 text-xs text-slate-500">{isStaffRole(people.get(id)) ? "Tutor" : "Student"}</span>
                      </span>
                      <ReportButton target={{ userId: id, name: people.get(id)?.displayName ?? null, place: "call", placeId: roomId }} />
                      <BlockButton otherId={id} otherName={people.get(id)?.displayName ?? null} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {captions && (
              <div data-lenis-prevent className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                {transcriptView.length === 0 ? (
                  <p className="text-slate-500">Listening… speak and your words appear here.</p>
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
              <button type="button" onClick={() => setTab("whiteboard")} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${tab === "whiteboard" ? "bg-bridge-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                <Icon name="pen" size={16} />
                Whiteboard
              </button>
              <button type="button" onClick={() => setTab("notebook")} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ${tab === "notebook" ? "bg-bridge-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                <Icon name="notebook" size={16} />
                Notebook
              </button>
              <span className="ml-auto self-center text-xs text-slate-500">The calculator is the round button at the bottom right</span>
            </div>
            <div className="card h-[70vh]">
              {/* Keep both mounted so switching tabs doesn't wipe the canvas. */}
              <div className={tab === "whiteboard" ? "h-full" : "hidden"}>
                <Whiteboard
                  ref={wbRef}
                  onSegment={(seg) => channelRef.current?.send({ type: "broadcast", event: "draw", payload: seg })}
                  onClear={() => channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} })}
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

/** Someone's video. */
function VideoTile({ stream, className }: { stream: MediaStream; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className={className} />;
}
