CREATE TABLE "MobileSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MobileSession_tokenHash_key" ON "MobileSession"("tokenHash");
CREATE INDEX "MobileSession_userId_expiresAt_idx" ON "MobileSession"("userId", "expiresAt");
CREATE INDEX "MobileSession_storeId_idx" ON "MobileSession"("storeId");
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
