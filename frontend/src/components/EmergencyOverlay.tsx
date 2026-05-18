import { resolveAlert, sirenOff } from "../api";
import { AlertRecord, DetectionStatus } from "../types";

type Props = {
  detection: DetectionStatus;
  activeAlert?: AlertRecord;
  acknowledged: boolean;
  onAcknowledge: () => void;
  onJumpEvacuation: () => void;
};

export function EmergencyOverlay({ detection, activeAlert, acknowledged, onAcknowledge, onJumpEvacuation }: Props) {
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
    const reason = window.prompt("Alasan resolve", "kondisi dikonfirmasi aman / simulasi selesai");
    if (!actor || !pin || !reason || !activeAlert?.id) return;
    try {
      await resolveAlert(activeAlert.id, actor, pin, reason);
      window.alert("Alert diselesaikan. Sistem kembali ke mode monitoring.");
    } catch {
      window.alert("Resolve gagal. Butuh PIN supervisor/admin yang valid.");
    }
  };

  return (
    <div className={acknowledged ? "emergency emergency--dock" : "emergency"}>
      <div className="emergency__card">
        <div className="emergency__top">
          <div>
            <div className="emergency__eyebrow">MODE DARURAT · AWAS</div>
            <h1>PERINGATAN TSUNAMI</h1>
          </div>
          <button className="emergency__ack" onClick={onAcknowledge}>
            {acknowledged ? "Sudah Diakui Operator" : "Acknowledge Operator"}
          </button>
        </div>
        <h2>Kondisi air laut abnormal terdeteksi</h2>
        <p>Prioritas: evakuasi warga ke zona aman, aktifkan komunikasi publik, dan validasi sensor.</p>
        <div className="emergency__meta">
          <span>Lokasi: {detection.locationName}</span>
          <span>Level: {detection.level}</span>
          <span>Confidence: {detection.confidence}%</span>
          <span>Sensor konfirmasi: {detection.confirmedSensors}</span>
          <span>Waktu: {new Date(detection.updatedAt).toLocaleString()}</span>
        </div>
        <ol className="emergency__checklist">
          <li>Instruksikan evakuasi menuju zona aman terdekat.</li>
          <li>Verifikasi sirine aktif dan jalur prioritas tidak padat.</li>
          <li>Supervisor melakukan resolve hanya setelah kondisi aman.</li>
        </ol>
        <div className="emergency__actions">
          <button onClick={onJumpEvacuation}>Lihat Jalur Evakuasi</button>
          <button onClick={onJumpEvacuation}>Tampilkan Titik Kumpul</button>
          <button onClick={() => window.alert("Supervisor confirmation recorded.")}>Konfirmasi Supervisor</button>
          <button onClick={handleSirenOff}>Matikan Sirine (2-step)</button>
          <button onClick={handleResolve}>Resolve Alert (Supervisor)</button>
        </div>
      </div>
    </div>
  );
}
