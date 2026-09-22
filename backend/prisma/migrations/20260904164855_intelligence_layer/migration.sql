-- CreateEnum
CREATE TYPE "EmergencyServiceType" AS ENUM ('POLICE', 'HOSPITAL', 'FIRE_STATION', 'PHARMACY');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('FARE', 'RECOMMENDATION', 'SAFETY', 'PACKING', 'ROUTE');

-- CreateEnum
CREATE TYPE "PredictionModel" AS ENUM ('FARE', 'SAFETY');

-- CreateTable
CREATE TABLE "emergency_services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmergencyServiceType" NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_models" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "PredictionModel" NOT NULL,
    "version" TEXT NOT NULL,
    "trainingDate" TIMESTAMP(3),
    "datasetVersion" TEXT,
    "datasetSource" TEXT,
    "features" TEXT,
    "hyperparameters" TEXT,
    "metrics" TEXT,
    "featureImportance" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_logs" (
    "id" TEXT NOT NULL,
    "model" "PredictionModel" NOT NULL,
    "modelVersion" TEXT,
    "inputHash" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "method" TEXT NOT NULL DEFAULT 'rule_based',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "FeedbackType" NOT NULL,
    "refId" TEXT,
    "rating" INTEGER,
    "useful" BOOLEAN,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emergency_services_type_idx" ON "emergency_services"("type");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_models_key_key" ON "intelligence_models"("key");

-- CreateIndex
CREATE INDEX "prediction_logs_model_idx" ON "prediction_logs"("model");

-- CreateIndex
CREATE INDEX "prediction_logs_createdAt_idx" ON "prediction_logs"("createdAt");

-- CreateIndex
CREATE INDEX "intelligence_feedback_type_idx" ON "intelligence_feedback"("type");

-- AddForeignKey
ALTER TABLE "intelligence_feedback" ADD CONSTRAINT "intelligence_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
