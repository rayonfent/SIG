import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapConfig, MapPoint } from "../types";

type Props = {
  data: MapConfig | undefined;
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

function icon(label: string, color: string) {
  return L.divIcon({
    className: "map-pin-shell",
    html: `<div class="map-pin" style="background:${color}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

export function MapPanel({ data }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletRef.current || !data) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView(data.center, data.zoom);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    leafletRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      leafletRef.current = null;
      layersRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (!data || !leafletRef.current || !layersRef.current) return;
    const map = leafletRef.current;
    const layerGroup = layersRef.current;
    layerGroup.clearLayers();

    data.inundationZones.forEach((zone) => {
      L.polygon(polygonCoords(zone), {
        color: "#db2777",
        weight: 1.5,
        fillColor: "#f43f5e",
        fillOpacity: 0.18
      }).bindTooltip(`${zone.name} · Risiko ${zone.risk}`).addTo(layerGroup);
    });

    data.safeZones.forEach((zone) => {
      L.polygon(polygonCoords(zone), {
        color: "#22c55e",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.14
      }).bindTooltip(`${zone.name} · ${zone.occupancy}/${zone.capacity}`).addTo(layerGroup);
    });

    data.routes.forEach((route) => {
      const density = Number(route.density || 0);
      const color = density > 70 ? "#ef4444" : density > 40 ? "#f59e0b" : "#22c55e";
      L.polyline(lineCoords(route), { color, weight: 5, opacity: 0.9 })
        .bindTooltip(`${route.name} · Kepadatan ${density}%`)
        .addTo(layerGroup);
    });

    data.sensors.forEach((sensor) => {
      const coords = pointCoords(sensor);
      if (!coords) return;
      L.marker(coords, { icon: icon("S", "#2563eb") })
        .bindPopup(`<strong>${sensor.name}</strong><br/>Sensor muka air`)
        .addTo(layerGroup);
    });

    data.sirens.forEach((siren) => {
      const coords = pointCoords(siren);
      if (!coords) return;
      L.marker(coords, { icon: icon("R", siren.active ? "#dc2626" : "#f97316") })
        .bindPopup(`<strong>${siren.name}</strong><br/>${siren.active ? "Aktif" : "Siaga"}`)
        .addTo(layerGroup);
      L.circle(coords, {
        radius: Number(siren.radius_m || 1000),
        color: "#dc2626",
        weight: 1,
        fillColor: "#dc2626",
        fillOpacity: siren.active ? 0.12 : 0.04
      }).addTo(layerGroup);
    });

    data.facilities.forEach((facility) => {
      const coords = pointCoords(facility);
      if (!coords) return;
      const colorByType: Record<string, string> = {
        polisi: "#1d4ed8",
        medis: "#16a34a",
        damkar: "#dc2626",
        sar: "#eab308"
      };
      L.marker(coords, { icon: icon("F", colorByType[facility.type || ""] || "#64748b") })
        .bindPopup(`<strong>${facility.name}</strong><br/>${facility.type || "Fasilitas"}`)
        .addTo(layerGroup);
    });

    map.invalidateSize();
  }, [data]);

  return (
    <section className="map-panel">
      <div className="map-panel__header">
        <div>
          <div className="panel__eyebrow">Live Operational Map</div>
          <div className="panel__title">Common Operating Picture</div>
        </div>
        <div className="map-panel__legend">
          <span><i className="legend-dot sensor" /> Sensor</span>
          <span><i className="legend-dot siren" /> Sirine</span>
          <span><i className="legend-dot route" /> Jalur</span>
          <span><i className="legend-dot safe" /> Zona aman</span>
          <span><i className="legend-dot flood" /> Genangan</span>
        </div>
      </div>
      <div ref={mapRef} className="map-canvas" />
    </section>
  );
}
