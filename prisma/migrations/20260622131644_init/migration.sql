-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "videoTitle" TEXT,
    "transcript" TEXT,
    "summary" TEXT NOT NULL,
    "keyPoints" TEXT,
    "motivational" TEXT,
    "timestamps" TEXT,
    "insight" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);
