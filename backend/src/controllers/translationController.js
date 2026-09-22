// =============================================================================
// translationController.js — translation endpoints.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as translationService from '../services/translationService.js';

export const translate = asyncHandler(async (req, res) => {
  const { text, sourceLanguage, targetLanguage } = req.body || {};
  const result = await translationService.translateText({ text, sourceLanguage, targetLanguage });
  ok(res, result);
});

export const languages = asyncHandler(async (_req, res) => {
  ok(res, { languages: translationService.listLanguages() });
});
