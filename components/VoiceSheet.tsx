"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface VoiceSheetProps {
  open: boolean;
  cardTitle: string;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}

export default function VoiceSheet({
  open,
  cardTitle,
  onClose,
  onSubmit,
}: VoiceSheetProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSpeechSupported(!!getSpeechRecognition());
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopListening();
      setTranscript("");
      setError(null);
      setRewriting(false);
    }
  }, [open, stopListening]);

  const startListening = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser. Type instead.");
      return;
    }
    setError(null);
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript((prev) => {
        // Prefer accumulating finals from this session
        const base = prev;
        const next = (finalText || interim).trim();
        return next || base;
      });
      if (finalText.trim()) setTranscript(finalText.trim());
      else if (interim.trim()) setTranscript(interim.trim());
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "Microphone permission denied" : event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleRewriteAndSubmit = async () => {
    const raw = transcript.trim();
    if (!raw) {
      setError("Say or type your feedback first");
      return;
    }
    stopListening();
    setRewriting(true);
    setError(null);
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: raw, cardTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rewrite failed");
      onSubmit(data.comment as string);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm">
      <div
        className="w-full max-w-[420px] rounded-t-2xl bg-page border border-border shadow-xl p-5 pb-8 animate-slide-up"
        role="dialog"
        aria-label="Voice comment"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink">Hold feedback</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink/50 hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="text-sm text-ink/60 mb-4 line-clamp-2">{cardTitle}</p>

        {speechSupported && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            className={`w-full mb-3 h-12 rounded-xl font-medium transition-colors ${
              listening
                ? "bg-hold text-white"
                : "bg-accent text-white"
            }`}
          >
            {listening ? "Stop listening" : "Hold to speak"}
          </button>
        )}

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Or type your objection…"
          rows={4}
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
        />

        {error && (
          <p className="mt-2 text-sm text-hold">{error}</p>
        )}

        <button
          type="button"
          disabled={rewriting || !transcript.trim()}
          onClick={() => void handleRewriteAndSubmit()}
          className="mt-4 w-full h-12 rounded-xl bg-ink text-page font-medium disabled:opacity-40"
        >
          {rewriting ? "Polishing…" : "Attach comment"}
        </button>
      </div>
    </div>
  );
}
