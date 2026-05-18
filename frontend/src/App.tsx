import { useMemo, useState } from "react";
import { updateSimulation } from "./api";
import { EmergencyOverlay } from "./components/EmergencyOverlay";
import { MapPanel } from "./components/MapPanel";
import { Sidebar } from "./components/Sidebar";
import { useRealtime } from "./hooks/useRealtime";
import { AlertLevel, DetectionStatus, RealtimeSnapshot } from "./types";

const statusMeta: Record<AlertLevel, { label: string; tone: string; action: string }> = {
  NORMAL: { label: "Normal", tone: "normal", action: "Monitoring rutin. Sistem siaga." },
  SUSPECT: { label: "Suspect", tone: "suspect", action: "Validasi sensor dan pantau tren." },
  WASPADA: { label: "Waspada", tone: "waspada", action: "Siapkan tim dan komunikasi publik." },
  SIAGA: { label: "Siaga", tone: "siaga", action: "Aktifkan posko dan siapkan evakuasi." },
  AWAS: { label: "Awas", tone: "awas", action: "Evakuasi sekarang. Prioritaskan zona aman." }
};

function MetricCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone?: string }) {
  return (
    <article className={`metric ${tone || ""}`}>
      <div className="metric__label">{label}</div>
      <div className="metric__value">{value}</div>
      <div className="metric__helper">{helper}</div>
    </article>
  );
}

function CommandSummary({ detection, mode }: { detection?: DetectionStatus; mode: string }) {
  const level = detection?.level || "NORMAL";
  const meta = statusMeta[level];
  return (
    <section className={`command-summary ${meta.tone}`}>
      <div>
        <div className="panel__eyebrow">Incident Command Status</div>
        <h2>{meta.label}</h2>
        <p>{meta.action}</p>
      </div>
      <div className="command-summary__right">
        <span>Realtime: {mode === "ws" ? "WebSocket aktif" : "Polling fallback"}</span>
        <span>Lokasi: {detection?.locationName || "Panjang, Lampung"}</span>
      </div>
    </section>
  );
}

function SensorTable({ sensors }: { sensors: DetectionStatus["sensors"] }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <div className="panel__eyebrow">Telemetry</div>
          <div className="panel__title">Sensor Muka Air</div>
        </div>
        <span className="panel__chip">{sensors.length} sensor</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Sensor</th>
              <th>Level</th>
              <th>Muka Air</th>
              <th>Δ 3m</th>
              <th>Rate</th>
              <th>Z</th>
              <th>Quality</th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((sensor) => (
              <tr key={sensor.sensor_id}>
                <td>
                  <strong>{sensor.sensor_name}</strong>
                  <span>{sensor.sensor_code}</span>
                </td>
                <td><span className={`badge ${sensor.level.toLowerCase()}`}>{sensor.level}</span></td>
                <td>{sensor.water_level_cm} cm</td>
                <td>{sensor.delta_3m} cm</td>
                <td>{sensor.rate_cm_per_minute} cm/m</td>
                <td>{sensor.z_score}</td>
                <td>{sensor.quality}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionPanel({ snapshot, realtimeMode }: { snapshot: RealtimeSnapshot | null; realtimeMode: string }) {
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const recommended = useMemo(() => {
    const routes = snapshot?.map?.routes || [];
    const safeZones = snapshot?.map?.safeZones || [];
    return {
      route: [...routes].sort((a, b) => Number(a.density || 0) - Number(b.density || 0))[0],
      zone: [...safeZones].sort((a, b) => Number(a.occupancy || 0) / Number(a.capacity || 1) - Number(b.occupancy || 0) / Number(b.capacity || 1))[0]
    };
  }, [snapshot]);

  const sendSimulation = async (value: number) => {
    setSaving(true);
    try {
      await updateSimulation(value, value >= 60 ? "Air Naik Cepat" : value <= -60 ? "Air Surut Mendadak" : "Manual");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="right-rail">
      <div className="panel">
        <div className="panel__eyebrow">Recommended Response</div>
        <div className="panel__title">Apa yang harus dilakukan sekarang</div>
        <div className="response-list">
          <div><b>1</b><span>Monitor status AWAS/SIAGA dan confidence sensor.</span></div>
          <div><b>2</b><span>Arahkan warga melalui rute terendah kepadatan.</span></div>
          <div><b>3</b><span>Supervisor resolve alert hanya jika aman tervalidasi.</span></div>
        </div>
      </div>
      <div className="panel" id="evakuasi">
        <div className="panel__eyebrow">Evacuation</div>
        <div className="panel__title">Rute Prioritas</div>
        <div className="info-stack">
          <span>Komunikasi: {realtimeMode === "ws" ? "Realtime" : "Polling fallback"}</span>
          <span>Jalur: {recommended.route?.name || "Menunggu data"}</span>
          <span>Kepadatan: {recommended.route?.density || 0}%</span>
          <span>Zona aman: {recommended.zone?.name || "Menunggu data"}</span>
        </div>
      </div>
      <div className="panel">
        <div className="panel__eyebrow">Drill</div>
        <div className="panel__title">Simulasi Muka Air</div>
        <div className="sim">
          <div className="sim__reading">{offset > 0 ? "+" : ""}{offset} cm</div>
          <input min={-200} max={300} type="range" value={offset} onChange={(event) => setOffset(Number(event.target.value))} />
          <button className="primary" onClick={() => sendSimulation(offset)} disabled={saving}>
            {saving ? "Mengirim..." : "Jalankan Simulasi"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ModulePage({ active, snapshot, mode }: { active: string; snapshot: RealtimeSnapshot | null; mode: string }) {
  if (active === "Monitoring Peta") return <MapPanel data={snapshot?.map} />;
  if (active === "Deteksi & Alert" || active === "Status Perangkat") return <SensorTable sensors={snapshot?.detection?.sensors || []} />;
  if (active === "Evakuasi" || active === "Simulasi & Drill") return <ActionPanel snapshot={snapshot} realtimeMode={mode} />;
  return (
    <section className="panel module-placeholder">
      <div className="panel__eyebrow">Module Shell</div>
      <div className="panel__title">{active}</div>
      <p>Modul ini sudah tersedia dalam navigasi operasi. Data utama tetap sinkron dengan peta, sensor, alert, sirine, dan audit trail.</p>
    </section>
  );
}

export default function App() {
  const [active, setActive] = useState("Dashboard");
  const [acknowledged, setAcknowledged] = useState(false);
  const { data, mode } = useRealtime();
  const detection = data?.detection;
  const activeAlert = data?.alerts?.[0];
  const level = detection?.level || "NORMAL";

  const jumpEvacuation = () => {
    setActive("Evakuasi");
    setAcknowledged(true);
    window.setTimeout(() => document.getElementById("evakuasi")?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  return (
    <div className="app-shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow">Tsunami Geographic Intelligence System</div>
            <h1>Command Center Pesisir Panjang</h1>
          </div>
          <div className={`system-pill ${level.toLowerCase()}`}>{level} · {mode.toUpperCase()}</div>
        </header>

        <CommandSummary detection={detection} mode={mode} />
        <div className="metrics-grid">
          <MetricCard label="Level Alert" value={level} helper={statusMeta[level].action} tone={level.toLowerCase()} />
          <MetricCard label="Confidence" value={`${detection?.confidence ?? 0}%`} helper="Skor gabungan sensor dan intensitas" />
          <MetricCard label="Sensor Validasi" value={`${detection?.confirmedSensors ?? 0}`} helper="Sensor valid dalam jendela konfirmasi" />
          <MetricCard label="Sirine Aktif" value={`${data?.sirens?.filter((item) => item.active).length || 0}`} helper="Unit sirine dalam mode aktif" />
        </div>

        {active === "Dashboard" ? (
          <div className="dashboard-grid">
            <div className="main-column">
              <MapPanel data={data?.map} />
              <SensorTable sensors={detection?.sensors || []} />
            </div>
            <ActionPanel snapshot={data} realtimeMode={mode} />
          </div>
        ) : (
          <ModulePage active={active} snapshot={data} mode={mode} />
        )}
      </main>
      {detection?.level === "AWAS" && (
        <EmergencyOverlay
          detection={detection}
          activeAlert={activeAlert}
          acknowledged={acknowledged}
          onAcknowledge={() => setAcknowledged(true)}
          onJumpEvacuation={jumpEvacuation}
        />
      )}
    </div>
  );
}
