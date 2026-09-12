-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "googleTokens" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "sensing" TEXT NOT NULL,
    "ipRating" TEXT NOT NULL,
    "tempRange" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "voltage" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "moq" INTEGER NOT NULL,
    "warranty" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "warehouse" TEXT NOT NULL,
    "advantages" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "customerId" TEXT,
    "rawEmail" TEXT NOT NULL,
    "extractedSpecs" TEXT,
    "productId" TEXT,
    "stockResult" TEXT,
    "comparison" TEXT,
    "emailDraft" TEXT,
    "finalEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'intake',
    "sentAt" DATETIME,
    "totalTime" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_company_model_key" ON "Product"("company", "model");
