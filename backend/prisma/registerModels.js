// =============================================================================
// registerModels.js — sync the trained model artifacts (ml/models/*) into the
// IntelligenceModel registry table so the admin AI page + /api/intelligence/models
// reflect real, trained model metadata (version, dataset, metrics, status).
//
//   node prisma/registerModels.js
// =============================================================================

import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const MODELS_ROOT = path.resolve(__dirname, '../../ml/models');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  for (const dir of fs.readdirSync(MODELS_ROOT)) {
    const meta = readJson(path.join(MODELS_ROOT, dir, 'metadata.json'));
    const report = readJson(path.join(MODELS_ROOT, dir, `${dir.replace('_model_', '_model_')}_report.json`));
    // report filename is <modelKey>_report.json, e.g. fare_model_v1 -> fare_model_report.json
    const reportPath = path.join(MODELS_ROOT, dir, `${dir.replace('_v1', '')}_report.json`);
    const rep = readJson(reportPath) || report;
    if (!meta) continue;

    const kind = dir.startsWith('fare') ? 'FARE' : 'SAFETY';
    const data = {
      key: meta.modelKey || dir,
      kind,
      version: meta.version || '1.0.0',
      trainingDate: meta.trainingDate ? new Date(meta.trainingDate) : null,
      datasetVersion: meta.datasetVersion || null,
      datasetSource: meta.datasetSource || 'synthetic',
      features: JSON.stringify(meta.features || []),
      hyperparameters: rep ? JSON.stringify(rep.hyperparameters || {}) : null,
      metrics: rep ? JSON.stringify(rep.metrics || {}) : null,
      featureImportance: rep ? JSON.stringify(rep.featureImportance || []) : null,
      status: 'ACTIVE'
    };

    await prisma.intelligenceModel.upsert({
      where: { key: data.key },
      update: data,
      create: data
    });
    console.log(`Registered ${data.key} (${kind})`);
  }
}

main()
  .catch((e) => {
    console.error('Failed to register models:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
