-- 기존 단일 track_id 고유키를 장비별 복합 고유키로 교체합니다.
DROP INDEX "vehicle_tracks_track_id_key";

ALTER TABLE "devices"
ADD COLUMN "controller_id" TEXT,
ADD COLUMN "operation_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "power_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "protocol_device_id" INTEGER,
ADD COLUMN "status_checked_at" TIMESTAMP(3);

ALTER TABLE "traffic_events"
ADD COLUMN "device_id" TEXT,
ADD COLUMN "incident_id" TEXT;

-- 기존 개발 데이터가 있으므로 device_id는 우선 nullable로 추가합니다.
ALTER TABLE "vehicle_tracks"
ADD COLUMN "device_id" TEXT,
ADD COLUMN "ended_at" TIMESTAMP(3),
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "last_confidence" DOUBLE PRECISION,
ADD COLUMN "last_speed_kmh" DOUBLE PRECISION,
ADD COLUMN "last_speed_ms" DOUBLE PRECISION;

CREATE TABLE "safety_incidents" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "source_device_id" TEXT NOT NULL,
    "incident_type" TEXT NOT NULL DEFAULT 'WRONG_WAY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "safety_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_traffic_stats" (
    "id" TEXT NOT NULL,
    "stat_date" DATE NOT NULL,
    "zone_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "total_vehicle_count" INTEGER NOT NULL DEFAULT 0,
    "normal_vehicle_count" INTEGER NOT NULL DEFAULT 0,
    "wrong_way_count" INTEGER NOT NULL DEFAULT 0,
    "pedestrian_entered_count" INTEGER NOT NULL DEFAULT 0,
    "pedestrian_exited_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_traffic_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "control_commands" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT,
    "control_board_id" TEXT NOT NULL,
    "target_device_id" TEXT,
    "command_type" TEXT NOT NULL,
    "sequence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "packet_hex" TEXT,
    "response_hex" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "control_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "safety_incidents_zone_id_status_idx" ON "safety_incidents"("zone_id", "status");
CREATE INDEX "safety_incidents_source_device_id_status_idx" ON "safety_incidents"("source_device_id", "status");
CREATE INDEX "safety_incidents_started_at_idx" ON "safety_incidents"("started_at");
CREATE INDEX "daily_traffic_stats_zone_id_stat_date_idx" ON "daily_traffic_stats"("zone_id", "stat_date");
CREATE INDEX "daily_traffic_stats_device_id_stat_date_idx" ON "daily_traffic_stats"("device_id", "stat_date");
CREATE UNIQUE INDEX "daily_traffic_stats_stat_date_zone_id_device_id_key" ON "daily_traffic_stats"("stat_date", "zone_id", "device_id");
CREATE INDEX "control_commands_incident_id_idx" ON "control_commands"("incident_id");
CREATE INDEX "control_commands_control_board_id_status_idx" ON "control_commands"("control_board_id", "status");
CREATE INDEX "control_commands_target_device_id_idx" ON "control_commands"("target_device_id");
CREATE INDEX "control_commands_requested_at_idx" ON "control_commands"("requested_at");
CREATE INDEX "devices_controller_id_idx" ON "devices"("controller_id");
CREATE UNIQUE INDEX "devices_controller_id_protocol_device_id_key" ON "devices"("controller_id", "protocol_device_id");
CREATE INDEX "traffic_events_device_id_idx" ON "traffic_events"("device_id");
CREATE INDEX "traffic_events_incident_id_idx" ON "traffic_events"("incident_id");
CREATE INDEX "vehicle_tracks_device_id_idx" ON "vehicle_tracks"("device_id");
CREATE UNIQUE INDEX "vehicle_tracks_device_id_track_id_key" ON "vehicle_tracks"("device_id", "track_id");

ALTER TABLE "devices" ADD CONSTRAINT "devices_controller_id_fkey" FOREIGN KEY ("controller_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "traffic_events" ADD CONSTRAINT "traffic_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "traffic_events" ADD CONSTRAINT "traffic_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "safety_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_tracks" ADD CONSTRAINT "vehicle_tracks_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_source_device_id_fkey" FOREIGN KEY ("source_device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_traffic_stats" ADD CONSTRAINT "daily_traffic_stats_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_traffic_stats" ADD CONSTRAINT "daily_traffic_stats_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "control_commands" ADD CONSTRAINT "control_commands_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "safety_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "control_commands" ADD CONSTRAINT "control_commands_control_board_id_fkey" FOREIGN KEY ("control_board_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "control_commands" ADD CONSTRAINT "control_commands_target_device_id_fkey" FOREIGN KEY ("target_device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
