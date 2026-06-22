-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sample" TEXT,
    "analysis" JSONB NOT NULL,
    "excerpts" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "logline" TEXT,
    "description" TEXT NOT NULL,
    "targetLength" TEXT NOT NULL DEFAULT 'NOVEL',
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-opus-4-8',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "blueprint" JSONB,
    "inferred" JSONB,
    "voiceProfileId" TEXT,
    "voiceSample" TEXT,
    "voiceAnalysis" JSONB,
    "voiceExcerpts" JSONB,
    "storyBible" JSONB,
    "runningSummary" TEXT,
    "currentChapter" INTEGER NOT NULL DEFAULT 0,
    "shareToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Story_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Story" ("blueprint", "createdAt", "currentChapter", "description", "id", "inferred", "logline", "model", "provider", "runningSummary", "shareToken", "status", "storyBible", "targetLength", "title", "updatedAt", "voiceAnalysis", "voiceExcerpts", "voiceSample") SELECT "blueprint", "createdAt", "currentChapter", "description", "id", "inferred", "logline", "model", "provider", "runningSummary", "shareToken", "status", "storyBible", "targetLength", "title", "updatedAt", "voiceAnalysis", "voiceExcerpts", "voiceSample" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE UNIQUE INDEX "Story_shareToken_key" ON "Story"("shareToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
