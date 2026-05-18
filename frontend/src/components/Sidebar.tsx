const items = [
  "Dashboard",
  "Monitoring Peta",
  "Deteksi & Alert",
  "Evakuasi",
  "Fasilitas & Aset",
  "Status Perangkat",
  "Simulasi & Drill",
  "Riwayat",
  "Audit Log",
  "Laporan",
  "Data Master",
  "Pengaturan"
];

type Props = {
  active: string;
  onSelect: (value: string) => void;
};

export function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__seal">TS</div>
        <div>
          <div className="sidebar__title">SIG-Pantau Tsunami</div>
          <div className="sidebar__subtitle">Command Center · Panjang, Lampung</div>
        </div>
      </div>
      <div className="sidebar__section-title">Modul Operasi</div>
      <nav className="sidebar__nav">
        {items.map((item) => (
          <button
            key={item}
            className={item === active ? "sidebar__item active" : "sidebar__item"}
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__section-title">Prinsip Operasi</div>
        <ul className="sidebar__notes">
          <li>Deteksi multi-sensor + confidence</li>
          <li>Evakuasi diarahkan ke zona aman</li>
          <li>Supervisor wajib untuk resolve alert</li>
        </ul>
      </div>
    </aside>
  );
}
