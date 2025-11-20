/*
  Warnings:

  - You are about to drop the column `cronExpression` on the `Routine` table. All the data in the column will be lost.
  - You are about to drop the column `scheduleTime` on the `Routine` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Routine` table. All the data in the column will be lost.
  - You are about to drop the column `durationSeconds` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `routineId` on the `Task` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "RoutineTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routineId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    CONSTRAINT "RoutineTask_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoutineTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutineAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "scheduleTime" TEXT,
    "cronExpression" TEXT,
    "themeColor" TEXT,
    CONSTRAINT "RoutineAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoutineAssignment_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Routine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "themeColor" TEXT,
    "icon" TEXT
);
INSERT INTO "new_Routine" ("id", "themeColor", "title") SELECT "id", "themeColor", "title" FROM "Routine";
DROP TABLE "Routine";
ALTER TABLE "new_Routine" RENAME TO "Routine";
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL
);
INSERT INTO "new_Task" ("icon", "id", "title") SELECT "icon", "id", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
