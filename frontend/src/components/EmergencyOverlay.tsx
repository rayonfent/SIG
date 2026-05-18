import { resolveAlert, sirenOff } from "../api";
import { AlertRecord, DetectionStatus } from "../types";

type Props = {
  detection: DetectionStatus;
  activeAlert?: AlertRecord;
  minimized: boolean;
  onClose: () => void;
  onExpand: () => void;
  onJumpEvacuation: () => void;
};

export function EmergencyOverlay({ detection, activeAlert, minimized, onClose, onExpand, onJumpEvacuation }: Props) {
  const handleSirenOff = async () => {
    const actor = window.prompt("Username supervisor/admin", "supervisor");
    const pin = window.prompt("PIN konfirmasi 2-step");
    if (!actor || !pin) return;
    try {
      await sirenOff(actor, pin, "manual override darurat");
      window.alert("Sirine dimatikan oleh supervisor/admin.");
    } catch {
      window.alert("Konfirmasi gagal. Sirine tetap aktif.");
    }
  };

  const handleResolve = async () => {
    const actor = window.prompt("Username supervisor/admin", "supervisor");
    const pin = window.prompt("PIN supervisor/admin untuk resolve alert");
    const reason = window.prompt("Alasan resolve", "simulasi selesai / kondisi aman tervalidasi");
    if (!actor || !pin || !reason || !activeAlert?.id) return;
    try {
      await resolveAlert(activeAlert.id, actor, pin, reason);
      window.alert("Alert diselesaikan. Sistem kembali ke monitoring.");
      onClose();
    } catch {
      window.alert("Resolve gagal. Butuh PIN supervisor/admin valid.");
    }
  };

  if (minimized) {
    return (
      <button className="alert-chip-floating" onClick={onExpand}>
        <span className="alert-pulse" />
        AWAS · Peringatan tsunami aktif
      </button>
    );
  }

  return (
    <div className="tsunami-overlay" role="dialog" aria-modal="false">
      <div className="tsunami-card">
        <button className="overlay-close" onClick={onClose} aria-label="Tutup overlay">×</button>
        <div className="tsunami-grid">
          <div className="tsunami-main">
            <div className="danger-kicker"><span className="alert-pulse" /> MODE DARURAT · AWAS</div>
            <h1>PERINGATAN TSUNAMI</h1>
            <h2>Kondisi air laut abnormal terdeteksi</h2>
            <p className="tsunami-message">Segera evakuasi ke zona aman. Jangan menunggu konfirmasi tambahan jika instruksi evakuasi sudah diberikan.</p>
            <div className="tsunami-actions">
              <button className="danger-action" onClick={onJumpEvacuation}>Lihat Jalur Evakuasi</button>
              <button onClick={onClose}>Sembunyikan Overlay</button>
              <button onClick={handleSirenOff}>Matikan Sirine (2-step)</button>
              <button onClick={handleResolve}>Resolve Supervisor</button>
            </div>
          </div>
          <aside className="tsunami-side">
            <div className="status-tile">
              <span>Lokasi</span>
              <b>{detection.locationName}</b>
            </div>
            <div className="status-tile">
              <span>Confidence</span>
              <b>{detection.confidence}%</b>
            </div>
            <div className="status-tile">
              <span>Sensor Konfirmasi</span>
              <b>{detection.confirmedSensors}</b>
            </div>
            <div className="status-tile">
              <span>Waktu</span>
              <b>{new Date(detection.updatedAt).toLocaleTimeString()}</b>
            </div>
          </aside>
        </div>
        <div className="procedure-strip">
          <span>1. Evakuasi warga</span>
          <span>2. Pantau jalur hijau</span>
          <span>3. Verifikasi sirine</span>
          <span>4. Supervisor resolve setelah aman</span>
        </div>
      </div>
    </div>
  );
}
