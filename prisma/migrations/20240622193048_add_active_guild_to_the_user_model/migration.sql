-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeGuildId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeGuildId_fkey" FOREIGN KEY ("activeGuildId") REFERENCES "Guild"("id") ON DELETE SET NULL ON UPDATE CASCADE;
