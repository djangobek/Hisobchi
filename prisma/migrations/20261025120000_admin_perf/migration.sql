CREATE INDEX "Transaction_occurredAt_idx" ON "Transaction"("occurredAt");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE TABLE "AdminStatsSnapshot" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminStatsSnapshot_pkey" PRIMARY KEY ("key")
);
