import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapConfig, MapPoint } from "../types";

type Props = {
  data: MapConfig | undefined;
};

type LayerState = {
  sensors: boolean;
  sirens: boolean;
  facilities: boolean;
  routes: boolean;
  safeZones: boolean;
  inundation: boolean;
};

const initialLayers: LayerState = {
  sensors: true,
  sirens: true,
  facilities: true,
  routes: true,
  safeZones: true,
  inundation: true
};

const facilitySymbols: Record<string, { icon: string; color: string; label: string }> = {
  polisi: { icon: "🛡️", color: "#1E88E5", label: "Polisi" },
  medis: { icon: "✚", color: "#16A34A", label: "Medis" },
  damkar: { icon: "🔥", color: "#E53935", label: "Damkar" },
  sar: { icon: "🛟", color: "#FDD835", label: "SAR" }
};

function pointCoords(item: MapPoint): [number, number] | null {
  const coords = item.geometry?.coordinates as number[] | undefined;
  return coords ? [coords[1], coords[0]] : null;
}

function lineCoords(item: MapPoint): [number, number][] {
  const coords = (item.geometry?.coordinates as number[][] | undefined) || [];
  return coords.map(([lon, lat]) => [lat, lon]);
}

function polygonCoords(item: MapPoint): [number, number][][] {
  const coords = (item.geometry?.coordinates as number[][][] | undefined) || [];
  return coords.map((ring) => ring.map(([lon, lat]) => [lat, lon]));
}

function markerIcon(kind: string, symbol: string, color: string, active = false) {
  return L.divIcon({
    className: "gis-marker-wrap",
    html: `
      <div class="gis-marker ${kind} ${active ? "is-active" : ""}" style="--pin:${color}">
        <span>${symbol}</span>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -18]
  });
}

function addFadedRadius(group: L.LayerGroup, coords: [number, number], radius: number, color: string, active: boolean) {
  const rings = [
    { scale: 1, opacity: active ? 0.16 : 0.07, weight: 1.4 },
    { scale: 0.66, opacity: active ? 0.21 : 0.09, weight: 1.2 },
    { scale: 0.33, opacity: active ? 0.27 : 0.11, weight: 1 }
  ];
  rings.forEach((ring) => {
    L.circle(coords, {
      radius: radius * ring.scale,
      color,
      weight: ring.weight,
      fillColor: color,
      fillOpacity: ring.opacity,
      opacity: Math.min(0.65, ring.opacity * 2.2)
    }).addTo(group);
  });
}

function popup(title: string, rows: string[]) {
  return `
    <div class="popup-card">
      <strong>${title}</strong>
      ${rows.map((row) => `<span>${row}</span>`).join("")}
    </div>
  `;
}

export function MapPanel({ data }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [layers, setLayers] = useState<LayerState>(initialLayers);
  const [basemap, setBasemap] = useState<"street" | "satellite">("street");

  useEffect(() => {
    if (!mapRef.current || leafletRef.current || !data) return;
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(data.center, data.zoom);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    leafletRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      leafletRef.current = null;
      layerRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (!leafletRef.current) return;
    const map = leafletRef.current;
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    const street = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const satellite = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    L.tileLayer(basemap === "street" ? street : satellite, {
      maxZoom: 19,
      attribution: basemap === "street" ? "© OpenStreetMap" : "Tiles © Esri"
    }).addTo(map);
  }, [basemap]);

  useEffect(() => {
    if (!data || !leafletRef.current || !layerRef.current) return;
    const map = leafletRef.current;
    const group = layerRef.current;
    group.clearLayers();

    if (layers.inundation) {
      data.inundationZones.forEach((zone) => {
        L.polygon(polygonCoords(zone), {
          color: "#BE123C",
          weight: 1.8,
          fillColor: "#FB7185",
          fillOpacity: 0.22,
          dashArray: "8 6"
        }).bindPopup(popup(zone.name || "Zona Genangan", [`Risiko: ${zone.risk || "tinggi"}`])).addTo(group);
      });
    }

    if (layers.safeZones) {
      data.safeZones.forEach((zone) => {
        L.polygon(polygonCoords(zone), {
          color: "#15803D",
          weight: 2.4,
          fillColor: "#22C55E",
          fillOpacity: 0.18
        }).bindPopup(popup(zone.name || "Zona Aman", [`Kapasitas: ${zone.occupancy || 0}/${zone.capacity || 0}`])).addTo(group);
      });
    }

    if (layers.routes) {
      data.routes.forEach((route) => {
        const density = Number(route.density || 0);
        const color = density > 70 ? "#DC2626" : density > 40 ? "#F59E0B" : "#16A34A";
        L.polyline(lineCoords(route), { color: "#FFFFFF", weight: 9, opacity: 0.78 }).addTo(group);
        L.polyline(lineCoords(route), { color, weight: 5, opacity: 0.95 })
          .bindPopup(popup(route.name || "Jalur Evakuasi", [`Kepadatan: ${density}%`, "Warna hijau paling direkomendasikan"]))
          .addTo(group);
      });
    }

    if (layers.sirens) {
      data.sirens.forEach((siren) => {
        const coords = pointCoords(siren);
        if (!coords) return;
        const active = Boolean(siren.active);
        addFadedRadius(group, coords, Number(siren.radius_m || 1200), "#DC2626", active);
        L.marker(coords, { icon: markerIcon("siren", "📢", active ? "#DC2626" : "#FB7185", active) })
          .bindPopup(popup(siren.name || siren.code || "Sirine", [`Status: ${active ? "AKTIF" : "Siaga"}`, `Radius suara: ${siren.radius_m || 1200} m`]))
          .addTo(group);
      });
    }

    if (layers.sensors) {
      data.sensors.forEach((sensor) => {
        const coords = pointCoords(sensor);
        if (!coords) return;
        addFadedRadius(group, coords, 850, "#2563EB", false);
        L.marker(coords, { icon: markerIcon("sensor", "≈", "#2563EB") })
          .bindPopup(popup(sensor.name || sensor.code || "Sensor", ["Radius biru = area monitoring", `Status: ${sensor.status || "online"}`]))
          .addTo(group);
      });
    }

    if (layers.facilities) {
      data.facilities.forEach((facility) => {
        const coords = pointCoords(facility);
        if (!coords) return;
        const meta = facilitySymbols[facility.type || ""] || { icon: "●", color: "#64748B", label: "Lainnya" };
        L.marker(coords, { icon: markerIcon("facility", meta.icon, meta.color) })
          .bindPopup(popup(facility.name || meta.label, [`Jenis: ${meta.label}`, `Kapasitas: ${facility.capacity || "-"}`]))
          .addTo(group);
      });
    }

    map.invalidateSize();
  }, [data, layers]);

  const toggle = (key: keyof LayerState) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <section className="map-shell">
      <div className="map-toolbar">
        <div>
          <div className="kicker">Live GIS Map</div>
          <h2>Monitoring Pesisir Panjang</h2>
        </div>
        <div className="basemap-switch">
          <button className={basemap === "street" ? "active" : ""} onClick={() => setBasemap("street")}>Map</button>
          <button className={basemap === "satellite" ? "active" : ""} onClick={() => setBasemap("satellite")}>Satellite</button>
        </div>
      </div>
      <div className="map-body">
        <aside className="layer-card">
          <div className="layer-title">Layers</div>
          {[
            ["sensors", "≈", "Sensor & radius monitoring"],
            ["sirens", "📢", "Sirine & radius suara"],
            ["facilities", "✚", "Public service"],
            ["routes", "━", "Jalur evakuasi"],
            ["safeZones", "▰", "Zona aman"],
            ["inundation", "▰", "Zona genangan"]
          ].map(([key, iconValue, label]) => (
            <button key={key} className={layers[key as keyof LayerState] ? "layer-row on" : "layer-row"} onClick={() => toggle(key as keyof LayerState)}>
              <span>{iconValue}</span>
              <b>{label}</b>
              <i />
            </button>
          ))}
        </aside>
        <div ref={mapRef} className="map-canvas" />
        <div className="map-legend-card">
          <div><i className="legend sensor" /> Sensor</div>
          <div><i className="legend siren" /> Sirine aktif/siaga</div>
          <div><i className="legend safe" /> Zona aman</div>
          <div><i className="legend flood" /> Genangan</div>
          <div><i className="legend route" /> Jalur evakuasi</div>
        </div>
      </div>
    </section>
  );
}
