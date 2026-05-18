import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL });

export async function fetchDetection() {
  const { data } = await api.get("/detection/status");
  return data;
}

export async function fetchMapConfig() {
  const { data } = await api.get("/map/config");
  return data;
}

export async function updateSimulation(waterOffsetCm: number, scenario: string) {
  const { data } = await api.post("/simulation/update", {
    scenario,
    waterOffsetCm,
    quality: "good"
  });
  return data;
}

export async function sirenOff(actor: string, pin: string, reason: string) {
  const { data } = await api.post("/sirens/off", { actor, pin, reason });
  return data;
}

export async function resolveAlert(alertId: string, actor: string, pin: string, reason: string) {
  const { data } = await api.post(`/alerts/${alertId}/resolve`, { actor, pin, reason });
  return data;
}
