-- DropIndex
DROP INDEX "PasswordReset_tokenHash_idx";

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");
