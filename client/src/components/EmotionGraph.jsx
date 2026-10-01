import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import io from "socket.io-client";


const MAX_POINTS = 20;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (apiBaseUrl ? apiBaseUrl.replace(/\/api\/?$/, "") : undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

export default function EmotionGraph({ isMonitoring = true }) {
  const [data, setData] = useState([]);
  const [breakdown, setBreakdown] = useState({});
  const isMonitoringRef = useRef(isMonitoring);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    const handleEmotion = (payload = {}) => {
      if (!isMonitoringRef.current) return;
      const confidence = typeof payload.confidence === "number" ? payload.confidence : 0;
      const time = new Date().toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" });
      setData((prev) => [...prev.slice(-MAX_POINTS + 1), { time, mood: Math.max(0, Math.min(100, confidence)) }]);
      if (payload.emotions && typeof payload.emotions === "object") {
        setBreakdown(payload.emotions);
      }
    };

    const handleWindowEvent = (event) => {
      handleEmotion(event?.detail || {});
    };

    if (typeof window !== "undefined") {
      window.addEventListener("emotion-live-update", handleWindowEvent);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("emotion-live-update", handleWindowEvent);
      }
    };
  }, []);

  useEffect(() => {
    const client = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    const handleSocketEmotion = (payload = {}) => {
      if (!isMonitoringRef.current) return;
      const confidence = typeof payload.confidence === "number" ? payload.confidence : 0;
      const time = new Date().toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" });
      setData((prev) => [...prev.slice(-MAX_POINTS + 1), { time, mood: Math.max(0, Math.min(100, confidence)) }]);
      if (payload.emotions && typeof payload.emotions === "object") {
        setBreakdown(payload.emotions);
      }
    };

    client.on("emotion-live", handleSocketEmotion);

    return () => {
      client.off("emotion-live", handleSocketEmotion);
      client.disconnect();
    };
  }, []);

  return (
    <div className="mt-8 bg-gray-800 p-4 rounded-lg shadow-lg">
      <h2 className="text-lg font-semibold mb-2">Real-Time Emotion Confidence</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid stroke="#555" strokeDasharray="5 5" />
          <XAxis dataKey="time" minTickGap={30} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(value) => [`${value?.toFixed?.(1) ?? value}%`, "Confidence"]} />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="#82ca9d"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
        {/* Simple per-emotion breakdown legend */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {Object.keys(breakdown || {}).length === 0 ? (
            <div className="text-gray-400">No breakdown available.</div>
          ) : (
            Object.entries(breakdown).map(([name, val]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="capitalize text-gray-200">{name}</span>
                <span className="text-indigo-300">{Number(val).toFixed(1)}%</span>
              </div>
            ))
          )}
        </div>
    </div>
  );
}
