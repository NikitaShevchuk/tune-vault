/*
  Warnings:

  - Added the required column `globalName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "globalName" TEXT NOT NULL;
