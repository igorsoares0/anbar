-- CreateTable
CREATE TABLE "AnnouncementBar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "announcementType" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "discountCode" TEXT,
    "callToAction" TEXT NOT NULL,
    "link" TEXT,
    "showCloseIcon" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT NOT NULL DEFAULT 'top',
    "backgroundColor" TEXT NOT NULL DEFAULT '#000000',
    "borderRadius" INTEGER NOT NULL DEFAULT 0,
    "borderWidth" INTEGER NOT NULL DEFAULT 0,
    "borderColor" TEXT NOT NULL DEFAULT '#000000',
    "fontFamily" TEXT NOT NULL DEFAULT 'Arial',
    "titleSize" INTEGER NOT NULL DEFAULT 16,
    "titleColor" TEXT NOT NULL DEFAULT '#ffffff',
    "subtitleSize" INTEGER NOT NULL DEFAULT 14,
    "subtitleColor" TEXT NOT NULL DEFAULT '#ffffff',
    "discountCodeColor" TEXT NOT NULL DEFAULT '#ffff00',
    "buttonColor" TEXT NOT NULL DEFAULT '#ffffff',
    "buttonTextSize" INTEGER NOT NULL DEFAULT 14,
    "buttonTextColor" TEXT NOT NULL DEFAULT '#000000',
    "buttonBorderRadius" INTEGER NOT NULL DEFAULT 4,
    "displayLocation" TEXT NOT NULL DEFAULT 'all_pages',
    "targetCollections" JSONB,
    "targetProducts" JSONB,
    "targetCollectionPages" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AnnouncementBar_shop_idx" ON "AnnouncementBar"("shop");

-- CreateIndex
CREATE INDEX "AnnouncementBar_shop_isActive_idx" ON "AnnouncementBar"("shop", "isActive");
