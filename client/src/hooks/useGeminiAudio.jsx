import { useCallback, useEffect, useRef, useState } from "react";

const SYSTEM_INSTRUCTION =
  "You are an expert AI Premium Tutor: diagnose the learner\u2019s level, adapt explanations to their background, teach patiently and clearly, provide worked examples, give frequent checks for understanding, and end each session with a concise summary, a 3-step practice plan, and at least one follow-up exercise.";
const CAPTURE_SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 24000;

const createFallbackRealtimeClient = ({ profile, diagnostic, tutorTone }) => {
  const emitter = new EventTarget();
  let closed = false;
  const emit = (type, detail) => {
    emitter.dispatchEvent(new CustomEvent(type, { detail }));
  };

  const synthesizePlan = () => ({
    goal: diagnostic?.learningGoal || profile?.goal || "General mastery",
    steps: [
      "Warm-up diagnostic question",
      "Explain concept with voice + example",
      "Mini quiz & recap",
    ],
    followUp: "Review notes and complete spaced repetition cards.",
  });

  const synthesizeProficiency = () => ({
    strengths: ["Pattern recognition", "Concept retention"],
    gaps: ["Timed responses", "Multi-step reasoning"],
    suggestedTone: tutorTone,
  });

  const synthesizeResources = () => [
    { title: "Deep dive article", type: "text" },
    { title: "Worked example set", type: "practice" },
    { title: "Flashcard pack", type: "spaced-repetition" },
  ];

  const synthesizeAudioSilence = () => {
    const buffer = new ArrayBuffer(PLAYBACK_SAMPLE_RATE * 2);
    return base64Encode(new Int16Array(buffer));
  };

  return {
    connect: async () => {
      if (closed) throw new Error("Session closed.");
      emit("session-open", { connected: true });
    },
    close: () => {
      closed = true;
      emit("session-closed", {});
    },
    on: (event, handler) => emitter.addEventListener(event, handler),
    off: (event, handler) => emitter.removeEventListener(event, handler),
    sendRealtimeInput: (payload) => {
      if (closed) return;
      if (payload?.transcript) {
        emit("transcription", { role: "user", text: payload.transcript });
      }
      if (payload?.command) {
        emit("transcription", { role: "user", text: payload.command });
        setTimeout(() => {
          emit("model-response", {
            text: `Command acknowledged: ${payload.command}`,
            audio: synthesizeAudioSilence(),
          });
          emit("turn-completed", {
            user: payload.command,
            model: `Simulated execution for ${payload.command}`,
            lessonPlan: synthesizePlan(),
            proficiencyProfile: synthesizeProficiency(),
            recommendedResources: synthesizeResources(),
          });
        }, 350);
        return;
      }
      if (payload?.audio) {
        emit("transcription", {
          role: "user",
          text: payload.caption || "Voice input streaming...",
        });
        setTimeout(() => {
          emit("model-response", {
            text: "Here is a quick coaching response based on your audio.",
            audio: synthesizeAudioSilence(),
          });
          emit("turn-completed", {
            user: payload.caption || "Voice input",
            model: "Replay of AI Premium Tutor explanation.",
            sessionTranscriptChunk: "Tutor responded to the latest audio question.",
          });
        }, 400);
      }
    },
  };
};

const float32ToInt16ArrayBuffer = (float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i += 1) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(i * 2, s, true);
  }
  return buffer;
};

const base64Encode = (arrayBuffer) => {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
};

const base64ToInt16Array = (base64) => {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(buffer);
};

export default function useGeminiAudio({
  profile,
  diagnostic,
  tutorTone = "encouraging",
} = {}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [currentTurn, setCurrentTurn] = useState({ user: "", model: "" });
  const [history, setHistory] = useState([]);
  const [sessionTranscript, setSessionTranscript] = useState("");
  const [lessonPlan, setLessonPlan] = useState(null);
  const [proficiencyProfile, setProficiencyProfile] = useState(null);
  const [recommendedResources, setRecommendedResources] = useState([]);

  const micStreamRef = useRef(null);
  const captureContextRef = useRef(null);
  const captureSourceRef = useRef(null);
  const captureProcessorRef = useRef(null);
  const playbackContextRef = useRef(null);
  const playbackNodesRef = useRef([]);
  const clientRef = useRef(null);
  const clientListenersRef = useRef([]);
  const nextStartTimeRef = useRef(0);

  const cleanupAudioGraph = useCallback(() => {
    captureProcessorRef.current?.disconnect();
    captureProcessorRef.current = null;
    captureSourceRef.current?.disconnect();
    captureSourceRef.current = null;
    if (captureContextRef.current) {
      captureContextRef.current.close();
      captureContextRef.current = null;
    }
    playbackNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch (err) {
        // ignore
      }
      node.disconnect?.();
    });
    playbackNodesRef.current = [];
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  }, []);

  const detachClientListeners = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    clientListenersRef.current.forEach(([event, handler]) => {
      client.off?.(event, handler);
    });
    clientListenersRef.current = [];
  }, []);

  const stopSession = useCallback(() => {
    detachClientListeners();
    clientRef.current?.close?.();
    clientRef.current = null;
    cleanupAudioGraph();
    setStatus("idle");
  }, [cleanupAudioGraph, detachClientListeners]);

  const ensurePlaybackContext = () => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: PLAYBACK_SAMPLE_RATE,
      });
    }
    return playbackContextRef.current;
  };

  const queuePlayback = useCallback((base64Audio) => {
    if (!base64Audio) return;
    const int16Array = base64ToInt16Array(base64Audio);
    const ctx = ensurePlaybackContext();
    const buffer = ctx.createBuffer(1, int16Array.length, PLAYBACK_SAMPLE_RATE);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < int16Array.length; i += 1) {
      channelData[i] = int16Array[i] / 0x8000;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current || ctx.currentTime);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
    playbackNodesRef.current.push(source);
  }, []);

  const registerClient = useCallback(
    (clientInstance) => {
      const handleTranscription = (event) => {
        if (!event?.detail) return;
        const { role, text } = event.detail;
        setCurrentTurn((prev) => ({
          ...prev,
          [role === "user" ? "user" : "model"]: text || "",
        }));
      };

      const handleModelResponse = (event) => {
        if (!event?.detail) return;
        const { text, audio } = event.detail;
        if (text) {
          setCurrentTurn((prev) => ({ ...prev, model: text }));
        }
        if (audio) {
          queuePlayback(audio);
        }
      };

      const handleTurnCompleted = (event) => {
        if (!event?.detail) return;
        const { user, model, sessionTranscriptChunk, lessonPlan: lp, proficiencyProfile: pp, recommendedResources: rr } =
          event.detail;
        setHistory((prev) => [...prev, { user: user || "", model: model || "" }]);
        setSessionTranscript((prev) => {
          const addition = `\nUser: ${user || ""}\nTutor: ${model || ""}`;
          return `${prev}${addition}`.trim();
        });
        if (sessionTranscriptChunk) {
          setSessionTranscript((prev) => `${prev}\n${sessionTranscriptChunk}`.trim());
        }
        if (lp) setLessonPlan(lp);
        if (pp) setProficiencyProfile(pp);
        if (rr) setRecommendedResources(rr);
        setCurrentTurn({ user: "", model: "" });
      };

      clientInstance.on?.("transcription", handleTranscription);
      clientInstance.on?.("model-response", handleModelResponse);
      clientInstance.on?.("turn-completed", handleTurnCompleted);
      clientListenersRef.current = [
        ["transcription", handleTranscription],
        ["model-response", handleModelResponse],
        ["turn-completed", handleTurnCompleted],
      ];
    },
    [queuePlayback]
  );

  const pumpAudioToClient = useCallback((clientInstance) => {
    if (!captureProcessorRef.current || !captureSourceRef.current) return;
    captureProcessorRef.current.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcmBuffer = float32ToInt16ArrayBuffer(input);
      const base64 = base64Encode(pcmBuffer);
      clientInstance.sendRealtimeInput({
        audio: base64,
        caption: `Voice sample (${input.length} frames)`,
      });
    };
  }, []);

  const startSession = useCallback(async () => {
    if (status === "connecting" || status === "connected") {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not supported in this environment.");
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("connecting");

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: CAPTURE_SAMPLE_RATE },
      });
      micStreamRef.current = micStream;

      const CaptureContext = window.AudioContext || window.webkitAudioContext;
      captureContextRef.current = new CaptureContext({ sampleRate: CAPTURE_SAMPLE_RATE });
      captureSourceRef.current = captureContextRef.current.createMediaStreamSource(micStream);
      captureProcessorRef.current = captureContextRef.current.createScriptProcessor(4096, 1, 1);
      captureSourceRef.current.connect(captureProcessorRef.current);
      captureProcessorRef.current.connect(captureContextRef.current.destination);

      const clientInstance = createFallbackRealtimeClient({ profile, diagnostic, tutorTone });
      clientRef.current = clientInstance;
      registerClient(clientInstance);
      await clientInstance.connect?.();
      pumpAudioToClient(clientInstance);
      setStatus("connected");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Unable to start Gemini audio session.");
      setStatus("error");
      stopSession();
    }
  }, [diagnostic, profile, pumpAudioToClient, registerClient, status, stopSession, tutorTone]);

  const sendTutorCommand = useCallback((command, payload = {}) => {
    if (!clientRef.current) {
      setError("No active session.");
      return;
    }
    clientRef.current.sendRealtimeInput({
      command,
      payload,
    });
  }, []);

  useEffect(() => stopSession, [stopSession]);

  return {
    startSession,
    stopSession,
    sendTutorCommand,
    status,
    error,
    currentTurn,
    history,
    sessionTranscript,
    lessonPlan,
    proficiencyProfile,
    recommendedResources,
  };
}
