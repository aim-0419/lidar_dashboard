-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "zone_code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "device_code" TEXT,
    "name" TEXT NOT NULL,
    "device_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "health_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "ip_address" TEXT,
    "port" INTEGER,
    "last_seen_at" TIMESTAMP(3),
    "installed_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traffic_events" (
    "id" TEXT NOT NULL,
    "event_code" TEXT,
    "event_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "occurred_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zone_id" TEXT,
    "external_zone_id" TEXT,
    "track_id" TEXT,
    "confidence" DOUBLE PRECISION,
    "message" TEXT,
    "speed_ms" DOUBLE PRECISION,
    "speed_kmh" DOUBLE PRECISION,
    "object_class" INTEGER,
    "object_uuid" TEXT,
    "description" TEXT,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "zones_zone_code_key" ON "zones"("zone_code");

-- CreateIndex
CREATE INDEX "zones_site_id_idx" ON "zones"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_code_key" ON "devices"("device_code");

-- CreateIndex
CREATE INDEX "devices_zone_id_idx" ON "devices"("zone_id");

-- CreateIndex
CREATE INDEX "devices_device_type_idx" ON "devices"("device_type");

-- CreateIndex
CREATE INDEX "devices_status_idx" ON "devices"("status");

-- CreateIndex
CREATE INDEX "devices_health_status_idx" ON "devices"("health_status");

-- CreateIndex
CREATE UNIQUE INDEX "traffic_events_event_code_key" ON "traffic_events"("event_code");

-- CreateIndex
CREATE INDEX "traffic_events_zone_id_idx" ON "traffic_events"("zone_id");

-- CreateIndex
CREATE INDEX "traffic_events_external_zone_id_idx" ON "traffic_events"("external_zone_id");

-- CreateIndex
CREATE INDEX "traffic_events_track_id_idx" ON "traffic_events"("track_id");

-- CreateIndex
CREATE INDEX "traffic_events_event_type_idx" ON "traffic_events"("event_type");

-- CreateIndex
CREATE INDEX "traffic_events_status_idx" ON "traffic_events"("status");

-- CreateIndex
CREATE INDEX "traffic_events_occurred_at_idx" ON "traffic_events"("occurred_at");

-- CreateIndex
CREATE INDEX "traffic_events_received_at_idx" ON "traffic_events"("received_at");

-- CreateIndex
CREATE INDEX "event_logs_event_id_idx" ON "event_logs"("event_id");

-- CreateIndex
CREATE INDEX "event_logs_user_id_idx" ON "event_logs"("user_id");

-- CreateIndex
CREATE INDEX "event_logs_action_idx" ON "event_logs"("action");

-- CreateIndex
CREATE INDEX "event_logs_created_at_idx" ON "event_logs"("created_at");

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_events" ADD CONSTRAINT "traffic_events_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "traffic_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
