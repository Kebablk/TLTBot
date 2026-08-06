-- CreateTable
CREATE TABLE "DailyData" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "open" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "fedRate" DOUBLE PRECISION,
    "inflation" DOUBLE PRECISION,
    "dividend" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyData_date_key" ON "DailyData"("date");

-- CreateIndex
CREATE INDEX "DailyData_date_idx" ON "DailyData"("date");
