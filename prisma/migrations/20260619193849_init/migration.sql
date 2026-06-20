-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "targetLength" TEXT NOT NULL DEFAULT 'NOVEL',
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "model" TEXT NOT NULL DEFAULT 'claude-opus-4-8',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "blueprint" JSONB,
    "inferred" JSONB,
    "voiceSample" TEXT,
    "voiceAnalysis" JSONB,
    "voiceExcerpts" JSONB,
    "storyBible" JSONB,
    "runningSummary" TEXT,
    "currentChapter" INTEGER NOT NULL DEFAULT 0,
    "shareToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "outline" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "wordCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Story_shareToken_key" ON "Story"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_storyId_index_key" ON "Chapter"("storyId", "index");
