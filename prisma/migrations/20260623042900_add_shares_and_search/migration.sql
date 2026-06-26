-- CreateTable
CREATE TABLE "shares" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "pin" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shares_slug_key" ON "shares"("slug");

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search index on summaries
CREATE INDEX IF NOT EXISTS summaries_search_idx ON "summaries"
  USING gin(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce("videoTitle", '')));
