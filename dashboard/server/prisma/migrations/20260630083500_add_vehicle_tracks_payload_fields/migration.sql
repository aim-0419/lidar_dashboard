-- CreateTable
CREATE TABLE "vehicle_tracks" (
    "id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "zone_id" TEXT,
    "external_zone_id" TEXT,
    "last_event_type" TEXT,
    "last_warning_level" INTEGER,
    "object_class" INTEGER,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_normal_moving_vehicle_count" INTEGER,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_tracks_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "traffic_events" ADD COLUMN "vehicle_track_id" TEXT;
ALTER TABLE "traffic_events" ADD COLUMN "warning_level" INTEGER;
ALTER TABLE "traffic_events" ADD COLUMN "consecutive_count" INTEGER;
ALTER TABLE "traffic_events" ADD COLUMN "is_confirmed" BOOLEAN;
ALTER TABLE "traffic_events" ADD COLUMN "normal_moving_vehicle_count" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_tracks_track_id_key" ON "vehicle_tracks"("track_id");

-- CreateIndex
CREATE INDEX "vehicle_tracks_zone_id_idx" ON "vehicle_tracks"("zone_id");

-- CreateIndex
CREATE INDEX "vehicle_tracks_external_zone_id_idx" ON "vehicle_tracks"("external_zone_id");

-- CreateIndex
CREATE INDEX "vehicle_tracks_last_event_type_idx" ON "vehicle_tracks"("last_event_type");

-- CreateIndex
CREATE INDEX "vehicle_tracks_last_seen_at_idx" ON "vehicle_tracks"("last_seen_at");

-- CreateIndex
CREATE INDEX "traffic_events_vehicle_track_id_idx" ON "traffic_events"("vehicle_track_id");

-- CreateIndex
CREATE INDEX "traffic_events_warning_level_idx" ON "traffic_events"("warning_level");

-- AddForeignKey
ALTER TABLE "vehicle_tracks" ADD CONSTRAINT "vehicle_tracks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traffic_events" ADD CONSTRAINT "traffic_events_vehicle_track_id_fkey" FOREIGN KEY ("vehicle_track_id") REFERENCES "vehicle_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
