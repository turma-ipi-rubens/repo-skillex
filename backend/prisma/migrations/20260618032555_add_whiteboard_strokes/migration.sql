-- CreateTable
CREATE TABLE "whiteboard_strokes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "points" TEXT NOT NULL,
    "text" TEXT,
    "pageIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whiteboard_strokes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "exchange_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "whiteboard_strokes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "whiteboard_strokes_requestId_createdAt_idx" ON "whiteboard_strokes"("requestId", "createdAt");
