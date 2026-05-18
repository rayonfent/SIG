export type AlertLevel = "NORMAL" | "SUSPECT" | "WASPADA" | "SIAGA" | "AWAS";

export type Geometry = {
  type: string;
  coordinates: number[] | number[][] | number[][][];
};

export type MapPoint = {
  id?: string;
  code?: string;
  name?: string;
  type?: string;
  status?: string;
  active?: boolean;
  radius_m?: number;
  density?: number;
  capacity?: number;
  occupancy?: number;
  risk?: string;
  geometry?: Geometry;
};

export type DetectionSensor = {
  sensor_id: string;
  sensor_code: string;
  sensor_name: string;
  level: AlertLevel;
  water_level_cm: number;
  delta_3m: number;
  rate_cm_per_minute: number;
  z_score: number;
  quality: string;
};

export type DetectionStatus = {
  level: AlertLevel;
  confidence: number;
  sensors: DetectionSensor[];
  confirmedSensors: number;
  updatedAt: string;
  locationName: string;
};

export type AlertRecord = {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  confidence: number;
  status: string;
  location_name: string;
  created_at: string;
};

export type MapConfig = {
  center: [number, number];
  zoom: number;
  sensors: MapPoint[];
  sirens: MapPoint[];
  facilities: MapPoint[];
  heavyEquipment: MapPoint[];
  routes: MapPoint[];
  safeZones: MapPoint[];
  inundationZones: MapPoint[];
};

export type RealtimeSnapshot = {
  detection: DetectionStatus;
  alerts: AlertRecord[];
  sirens: MapPoint[];
  map: MapConfig;
  simulation: Record<string, unknown>;
};
