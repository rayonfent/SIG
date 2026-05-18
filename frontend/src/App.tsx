import { useMemo, useState } from "react";
import { updateSimulation } from "./api";
import { EmergencyOverlay } from "./components/EmergencyOverlay";
import { MapPanel } from "./components/MapPanel";
import { Sidebar } from "./components/Sidebar";
import { useRealtime } from "./hooks/useRealtime";
import { AlertLevel, DetectionStatus, RealtimeSnapshot } from "./types";

const statusMeta: Record<AlertLevel, { label: string; tone: string; action: string }> = {
  NORMAL: { label: "Normal", tone: "normal", action: "Monitoring rutin berjalan normal." },
  SUSPECT: { label: "Suspect", tone: "suspect", action: "Periksa anomali awal dan validasi data sensor." },
  WASPADA: { label: "Waspada", tone: "waspada", action: "Aktifkan kesiapsiagaan tim lapangan." },
  SIAGA: { label: "Siaga", tone: "siaga", action: "Aktifkan prosedur evakuasi parsial." },
  AWAS: { label: "Awas", tone: "awas", action: "Evakuasi segera. Prioritaskan jalur hijau." }
};

function MetricCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone?: string }) {
  return (
    <article className={`metric-card ${tone || ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-helper">{helper}</div>
    </article>
  );
}

function TopStatus({ detection, mode }: { detection?: DetectionStatus; mode: string }) {
  const level = detection?.level || "NORMAL";
  const meta = statusMeta[level];
  return (
    <section className={`top-status ${meta.tone}`}>
      <div>
        <div className="kicker">Incident Command</div>
        <h2>{meta.label}</h2>
        <p>{meta.action}</p>
      </div>
      <div className="status-meta">
        <span>Realtime: {mode === "ws" ? "WebSocket" : "Polling fallback"}</span>
        <span>Lokasi: {detection?.locationName || "Panjang, Lampung"}</span>
        <span>Update: {detection?.updatedAt ? new Date(detection.updatedAt).toLocaleTimeString() : "-"}</span>
      </div>
    </section>
  );
}

function SensorTable({ sensors }: { sensors: DetectionStatus["sensors"] }) {
  return (
    <section className="panel-card">
      <header className="panel-head">
        <div>
          <div className="kicker">Telemetry</div>
          <h3>Status Sensor Muka Air</h3>
        </div>
        <span className="badge-chip">{sensors.length} sensor</span>
      </header>
      <div className="table-wrap">
        <table className="sensor-table">
          <thead>
            <tr>
              <th>Sensor</th>
              <th>Level</th>
              <th>Muka Air</th>
              <th>Delta 3m</th>
              <th>Rate</th>
              <th>Z-Score</th>
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
                <td><span className={`badge-level ${sensor.level.toLowerCase()}`}>{sensor.level}</span></td>
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

function OperationsRail({ snapshot, realtimeMode }: { snapshot: RealtimeSnapshot | null; realtimeMode: string }) {
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
    <aside className="ops-rail" id="evakuasi">
      <section className="panel-card">
        <div className="kicker">Response Checklist</div>
        <h3>Apa yang dilakukan sekarang</h3>
        <ol className="checklist">
          <li>Perhatikan status level dan confidence.</li>
          <li>Arahkan warga ke jalur berkepadatan rendah.</li>
          <li>Validasi kondisi lapangan sebelum resolve.</li>
        </ol>
      </section>
      <section className="panel-card">
        <div className="kicker">Evakuasi Direkomendasikan</div>
        <h3>Rute dan Zona Aman</h3>
        <div className="stack-lines">
          <span>Kanal komunikasi: {realtimeMode === "ws" ? "Realtime" : "Polling 10 detik"}</span>
          <span>Rute prioritas: {recommended.route?.name || "Menunggu data"}</span>
          <span>Kepadatan: {recommended.route?.density || 0}%</span>
          <span>Zona aman: {recommended.zone?.name || "Menunggu data"}</span>
        </div>
      </section>
      <section className="panel-card">
        <div className="kicker">Simulation Drill</div>
        <h3>Uji skenario cepat</h3>
        <div className="sim-box">
          <div className="sim-value">{offset > 0 ? "+" : ""}{offset} cm</div>
          <input type="range" min={-200} max={300} value={offset} onChange={(event) => setOffset(Number(event.target.value))} />
          <button className="primary-btn" onClick={() => sendSimulation(offset)} disabled={saving}>
            {saving ? "Mengirim..." : "Jalankan Simulasi"}
          </button>
        </div>
      </section>
    </aside>
  );
}

function ModulePage({ active, snapshot, mode }: { active: string; snapshot: RealtimeSnapshot | null; mode: string }) {
  if (active === "Monitoring Peta") return <MapPanel data={snapshot?.map} />;
  if (active === "Deteksi & Alert" || active === "Status Perangkat") return <SensorTable sensors={snapshot?.detection?.sensors || []} />;
  if (active === "Evakuasi" || active === "Simulasi & Drill") return <OperationsRail snapshot={snapshot} realtimeMode={mode} />;
  return (
    <section className="panel-card module-placeholder">
      <div className="kicker">Module</div>
      <h3>{active}</h3>
      <p>Modul ini tersedia sebagai shell operasional dan tetap sinkron dengan data realtime utama.</p>
    </section>
  );
}

export default function App() {
  const [active, setActive] = useState("Dashboard");
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  const { data, mode } = useRealtime();
  const detection = data?.detection;
  const activeAlert = data?.alerts?.[0];
  const level = detection?.level || "NORMAL";

  const jumpEvacuation = () => {
    setActive("Evakuasi");
    window.setTimeout(() => document.getElementById("evakuasi")?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  return (
    <div className="shell">
      <Sidebar active={active} onSelect={setActive} />
      <main className="main-content">
        <header className="top-header">
          <div>
            <div className="kicker">Tsunami Geographic Intelligence</div>
            <h1>SIG Command Center</h1>
          </div>
          <div className={`pill ${level.toLowerCase()}`}>{level} · {mode.toUpperCase()}</div>
        </header>

        <TopStatus detection={detection} mode={mode} />

        <section className="metric-grid">
          <MetricCard label="Level Alert" value={level} helper={statusMeta[level].action} tone={level.toLowerCase()} />
          <MetricCard label="Confidence" value={`${detection?.confidence ?? 0}%`} helper="Skor gabungan sensor" />
          <MetricCard label="Sensor Konfirmasi" value={`${detection?.confirmedSensors ?? 0}`} helper="Sensor valid di jendela konfirmasi" />
          <MetricCard label="Sirine Aktif" value={`${data?.sirens?.filter((item) => item.active).length || 0}`} helper="Unit aktif saat ini" />
        </section>

        {active === "Dashboard" ? (
          <section className="dashboard-layout">
            <div className="left-stack">
              <MapPanel data={data?.map} />
              <SensorTable sensors={detection?.sensors || []} />
            </div>
            <OperationsRail snapshot={data} realtimeMode={mode} />
          </section>
        ) : (
          <ModulePage active={active} snapshot={data} mode={mode} />
        )}
      </main>

      {detection?.level === "AWAS" && (
        <EmergencyOverlay
          detection={detection}
          activeAlert={activeAlert}
          minimized={overlayMinimized}
          onClose={() => setOverlayMinimized(true)}
          onExpand={() => setOverlayMinimized(false)}
          onJumpEvacuation={jumpEvacuation}
        />
      )}
    </div>
  );
}
