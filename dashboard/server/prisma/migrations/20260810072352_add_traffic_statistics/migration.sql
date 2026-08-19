-- CreateTable
CREATE TABLE "traffic_statistics" (
    "id" TEXT NOT NULL,
    "stat_date" TIMESTAMP(3) NOT NULL,
    "hour_slot" INTEGER,
    "period_type" TEXT NOT NULL,
    "site_id" TEXT,
    "zone_id" TEXT,
    "total_vehicles" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_statistics_stat_date_idx" ON "traffic_statistics"("stat_date");

-- CreateIndex
CREATE INDEX "traffic_statistics_period_type_idx" ON "traffic_statistics"("period_type");

-- CreateIndex
CREATE INDEX "traffic_statistics_site_id_idx" ON "traffic_statistics"("site_id");

-- CreateIndex
CREATE INDEX "traffic_statistics_zone_id_idx" ON "traffic_statistics"("zone_id");

-- CreateIndex
CREATE INDEX "traffic_statistics_stat_date_period_type_idx" ON "traffic_statistics"("stat_date", "period_type");

-- CreateIndex
CREATE UNIQUE INDEX "traffic_statistics_stat_date_hour_slot_period_type_site_id__key" ON "traffic_statistics"("stat_date", "hour_slot", "period_type", "site_id", "zone_id");
