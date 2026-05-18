INSERT INTO users (username, full_name, role, pin_hash) VALUES
('operator', 'Operator Pusdalops', 'operator', '111111'),
('supervisor', 'Supervisor BPBD', 'supervisor', '222222'),
('admin', 'Administrator Sistem', 'admin', '333333');

INSERT INTO threshold_configs (name) VALUES ('default');

INSERT INTO sensors (code, name, is_primary, location, last_seen) VALUES
('SNS-PJG-01', 'Tide Gauge Dermaga Panjang', true, ST_SetSRID(ST_MakePoint(105.3227, -5.4722), 4326), now()),
('SNS-PJG-02', 'Radar Muka Air Way Lunik', false, ST_SetSRID(ST_MakePoint(105.3315, -5.4595), 4326), now()),
('SNS-PJG-03', 'Buoy Teluk Lampung', false, ST_SetSRID(ST_MakePoint(105.3050, -5.4850), 4326), now());

INSERT INTO sensor_readings (sensor_id, measured_at, water_level_cm, quality)
SELECT s.id, now() - (n || ' seconds')::interval, 95 + sin(n / 30.0) * 4, 'good'
FROM sensors s CROSS JOIN generate_series(0, 2700, 10) n;

INSERT INTO sirens (code, name, radius_m, active, location) VALUES
('SRN-PJG-01', 'Sirine Pelabuhan Panjang', 1400, false, ST_SetSRID(ST_MakePoint(105.3188, -5.4700), 4326)),
('SRN-PJG-02', 'Sirine Way Lunik', 1100, false, ST_SetSRID(ST_MakePoint(105.3340, -5.4555), 4326));

INSERT INTO facilities (type, name, status, capacity, location) VALUES
('polisi', 'Polsek Panjang', 'online', 80, ST_SetSRID(ST_MakePoint(105.3194, -5.4645), 4326)),
('medis', 'Puskesmas Panjang', 'online', 120, ST_SetSRID(ST_MakePoint(105.3157, -5.4628), 4326)),
('damkar', 'Pos Damkar Panjang', 'online', 40, ST_SetSRID(ST_MakePoint(105.3261, -5.4588), 4326)),
('sar', 'Pos SAR Teluk Lampung', 'online', 60, ST_SetSRID(ST_MakePoint(105.3095, -5.4770), 4326));

INSERT INTO heavy_equipment (type, name, status, location) VALUES
('excavator', 'Excavator PU-01', 'online', ST_SetSRID(ST_MakePoint(105.3290, -5.4610), 4326)),
('truck', 'Truck Evakuasi BPBD-02', 'online', ST_SetSRID(ST_MakePoint(105.3163, -5.4592), 4326));

INSERT INTO evacuation_routes (name, density, path) VALUES
('Rute Pelabuhan ke Bukit Panjang', 35, ST_GeogFromText('LINESTRING(105.319 -5.472,105.318 -5.463,105.312 -5.452)')),
('Rute Way Lunik ke Zona Aman Timur', 55, ST_GeogFromText('LINESTRING(105.334 -5.457,105.339 -5.450,105.346 -5.442)'));

INSERT INTO safe_zones (name, capacity, occupancy, area) VALUES
('Zona Aman Bukit Panjang', 8000, 1200, ST_GeogFromText('POLYGON((105.307 -5.454,105.316 -5.454,105.316 -5.446,105.307 -5.446,105.307 -5.454))')),
('Zona Aman Timur Way Lunik', 6000, 900, ST_GeogFromText('POLYGON((105.342 -5.446,105.351 -5.446,105.351 -5.438,105.342 -5.438,105.342 -5.446))'));

INSERT INTO inundation_zones (name, risk, area) VALUES
('Zona Rendaman Pesisir Panjang', 'high', ST_GeogFromText('POLYGON((105.301 -5.489,105.340 -5.479,105.336 -5.459,105.306 -5.464,105.301 -5.489))'));

INSERT INTO simulation_sessions (mode, active) VALUES ('live', false);
