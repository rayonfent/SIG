import { useEffect, useMemo, useState } from "react";
import { fetchDetection, fetchMapConfig } from "../api";
import { RealtimeSnapshot } from "../types";

const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/realtime";

export function useRealtime() {
  const [data, setData] = useState<RealtimeSnapshot | null>(null);
  const [mode, setMode] = useState<"ws" | "polling">("ws");

  useEffect(() => {
    let ws: WebSocket | null = null;
    let polling: number | undefined;

    const startPolling = () => {
      setMode("polling");
      polling = window.setInterval(async () => {
        const [detection, map] = await Promise.all([fetchDetection(), fetchMapConfig()]);
        setData((prev) => ({
          detection,
          map,
          alerts: prev?.alerts || [],
          sirens: prev?.sirens || [],
          simulation: prev?.simulation || {}
        }));
      }, 10000);
    };

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        setMode("ws");
        setData(JSON.parse(event.data));
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
        if (!polling) startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      if (polling) window.clearInterval(polling);
      ws?.close();
    };
  }, []);

  return useMemo(() => ({ data, mode }), [data, mode]);
}
