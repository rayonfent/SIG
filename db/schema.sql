CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE quality_flag AS ENUM ('good', 'suspect', 'bad', 'offline');
CREATE TYPE alert_level AS ENUM ('NORMAL', 'SUSPECT', 'WASPADA', 'SIAGA', 'AWAS');
CREATE TYPE device_status AS ENUM ('online', 'warning', 'critical', 'offline');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operator', 'supervisor', 'admin')),
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status device_status NOT NULL DEFAULT 'online',
  location GEOGRAPHY(Point, 4326) NOT NULL,
  last_seen TIMESTAMPTZ
);
CREATE INDEX sensors_location_gix ON sensors USING GIST (location);

CREATE TABLE sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  sensor_id UUID NOT NULL REFERENCES sensors(id),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  water_level_cm NUMERIC(8,2) NOT NULL,
  quality quality_flag NOT NULL DEFAULT 'good',
  source TEXT NOT NULL DEFAULT 'live'
);
CREATE INDEX sensor_readings_sensor_time_idx ON sensor_readings(sensor_id, measured_at DESC);

CREATE TABLE threshold_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'default',
  suspect_delta_3m NUMERIC NOT NULL DEFAULT 15,
  waspada_delta_3m NUMERIC NOT NULL DEFAULT 25,
  siaga_delta_3m NUMERIC NOT NULL DEFAULT 40,
  awas_delta_3m NUMERIC NOT NULL DEFAULT 60,
  waspada_rate NUMERIC NOT NULL DEFAULT 8,
  siaga_rate NUMERIC NOT NULL DEFAULT 13,
  awas_rate NUMERIC NOT NULL DEFAULT 20,
  suspect_z NUMERIC NOT NULL DEFAULT 2.0,
  waspada_z NUMERIC NOT NULL DEFAULT 2.5,
  siaga_z NUMERIC NOT NULL DEFAULT 3.0,
  awas_z NUMERIC NOT NULL DEFAULT 3.5,
  min_confidence_auto_siren INT NOT NULL DEFAULT 70,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level alert_level NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  confidence INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  location_name TEXT NOT NULL DEFAULT 'Panjang, Lampung',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE alert_sensor_evidence (
  id BIGSERIAL PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES alerts(id),
  sensor_id UUID NOT NULL REFERENCES sensors(id),
  delta_3m NUMERIC,
  rate_cm_per_minute NUMERIC,
  z_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sirens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status device_status NOT NULL DEFAULT 'online',
  active BOOLEAN NOT NULL DEFAULT false,
  radius_m INT NOT NULL DEFAULT 1200,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  last_event_at TIMESTAMPTZ
);
CREATE INDEX sirens_location_gix ON sirens USING GIST (location);

CREATE TABLE siren_events (
  id BIGSERIAL PRIMARY KEY,
  siren_id UUID NOT NULL REFERENCES sirens(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status device_status NOT NULL DEFAULT 'online',
  capacity INT,
  location GEOGRAPHY(Point, 4326) NOT NULL
);
CREATE INDEX facilities_location_gix ON facilities USING GIST (location);

CREATE TABLE heavy_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status device_status NOT NULL DEFAULT 'online',
  location GEOGRAPHY(Point, 4326) NOT NULL
);
CREATE INDEX heavy_equipment_location_gix ON heavy_equipment USING GIST (location);

CREATE TABLE evacuation_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  density INT NOT NULL DEFAULT 25,
  path GEOGRAPHY(LineString, 4326) NOT NULL
);
CREATE INDEX evacuation_routes_path_gix ON evacuation_routes USING GIST (path);

CREATE TABLE safe_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  capacity INT NOT NULL,
  occupancy INT NOT NULL DEFAULT 0,
  area GEOGRAPHY(Polygon, 4326) NOT NULL
);
CREATE INDEX safe_zones_area_gix ON safe_zones USING GIST (area);

CREATE TABLE inundation_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  risk TEXT NOT NULL,
  area GEOGRAPHY(Polygon, 4326) NOT NULL
);
CREATE INDEX inundation_zones_area_gix ON inundation_zones USING GIST (area);

CREATE TABLE simulation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'live',
  scenario TEXT,
  water_offset_cm NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_events (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
