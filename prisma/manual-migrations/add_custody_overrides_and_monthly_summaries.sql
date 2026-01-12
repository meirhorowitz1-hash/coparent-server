-- AlterTable: Add counter flow fields to SwapRequest
ALTER TABLE "SwapRequest" ADD COLUMN IF NOT EXISTS "previousProposedDate" TIMESTAMP(3);
ALTER TABLE "SwapRequest" ADD COLUMN IF NOT EXISTS "counteredById" TEXT;
ALTER TABLE "SwapRequest" ADD COLUMN IF NOT EXISTS "counterNote" TEXT;
ALTER TABLE "SwapRequest" ADD COLUMN IF NOT EXISTS "counteredAt" TIMESTAMP(3);
ALTER TABLE "SwapRequest" ADD COLUMN IF NOT EXISTS "counterResponseNote" TEXT;
ALTER TABLE "SwapRequest" ADD COLUMN IF NOT EXISTS "counterRespondedAt" TIMESTAMP(3);
ALTER TABLE "SwapRequest" ADD COLUMN IF NOT EXISTS "requesterConfirmedAt" TIMESTAMP(3);

-- CreateTable: CustodyOverride
CREATE TABLE IF NOT EXISTS "CustodyOverride" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "assignments" JSONB NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT,
    "requestedToId" TEXT,
    "requestedToName" TEXT,
    "responseNote" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustodyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: CustodyOverride
CREATE INDEX IF NOT EXISTS "CustodyOverride_familyId_idx" ON "CustodyOverride"("familyId");
CREATE INDEX IF NOT EXISTS "CustodyOverride_familyId_status_idx" ON "CustodyOverride"("familyId", "status");
CREATE INDEX IF NOT EXISTS "CustodyOverride_familyId_startDate_endDate_idx" ON "CustodyOverride"("familyId", "startDate", "endDate");

-- AddForeignKey: CustodyOverride
ALTER TABLE "CustodyOverride" ADD CONSTRAINT "CustodyOverride_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: MonthlyExpenseSummary
CREATE TABLE IF NOT EXISTS "MonthlyExpenseSummary" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "totalApproved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parent1Share" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parent2Share" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyExpenseSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: MonthlyExpenseSummary
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyExpenseSummary_familyId_year_month_key" ON "MonthlyExpenseSummary"("familyId", "year", "month");
CREATE INDEX IF NOT EXISTS "MonthlyExpenseSummary_familyId_idx" ON "MonthlyExpenseSummary"("familyId");
CREATE INDEX IF NOT EXISTS "MonthlyExpenseSummary_familyId_year_idx" ON "MonthlyExpenseSummary"("familyId", "year");

-- AddForeignKey: MonthlyExpenseSummary
ALTER TABLE "MonthlyExpenseSummary" ADD CONSTRAINT "MonthlyExpenseSummary_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
