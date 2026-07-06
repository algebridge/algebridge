"use client";

import { useCallback, useEffect, useState } from "react";

const SYMBOL_WORDS: Record<string, string> = {
  "×": " times ",
  "÷": " divided by ",
  "≤": " less than or equal to ",
  "≥": " greater than or equal to ",
  "≠": " not equal to ",
  "√": " square root of ",
  "π": " pi ",
  "±": " plus or minus ",
  "∞": " infinity ",
  "°": " degrees ",
};

/** Makes math notation sound natural when read aloud by the browser's TTS voice. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/[×÷≤≥≠√π±∞°]/g, (ch) => SYMBOL_WORDS[ch] ?? ch)
    .replace(/x²/g, "x squared")
    .replace(/x³/g, "x cubed")
    .replace(/\^(-?\d+(?:\/\d+)?)/g, " to the power of $1 ")
    .replace(/−/g, " minus ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Client-side hook wrapping the browser's built-in text-to-speech (Web Speech API). */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking, supported };
}
