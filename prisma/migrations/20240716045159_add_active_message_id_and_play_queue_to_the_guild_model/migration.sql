-- AlterTable
ALTER TABLE "Guild" ADD COLUMN     "activeMessageId" TEXT,
ADD COLUMN     "playQueueId" INTEGER;

-- CreateTable
CREATE TABLE "PlayQueue" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT,
    "queue" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "PlayQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayQueue_guildId_key" ON "PlayQueue"("guildId");

-- AddForeignKey
ALTER TABLE "PlayQueue" ADD CONSTRAINT "PlayQueue_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE SET NULL ON UPDATE CASCADE;
