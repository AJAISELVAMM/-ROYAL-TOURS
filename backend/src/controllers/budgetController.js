import { z } from 'zod';
import asyncHandler from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { validationError } from '../utils/errors.js';
import * as budgetService from '../services/budgetService.js';

const expenseSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  date: z.string().optional(),
  spentAt: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().optional()
});

function parseExpense(body) {
  const result = expenseSchema.safeParse(body || {});
  if (!result.success) throw validationError(result.error.issues[0].message, result.error.issues);
  return result.data;
}

export const getBudget = asyncHandler(async (req, res) => {
  ok(res, await budgetService.getBudget(req.params.id, req.user.id));
});

export const createExpense = asyncHandler(async (req, res) => {
  created(res, await budgetService.createExpense(req.params.id, req.user.id, parseExpense(req.body)));
});

export const updateExpense = asyncHandler(async (req, res) => {
  ok(res, await budgetService.updateExpense(req.params.id, req.params.expenseId, req.user.id, parseExpense(req.body)));
});

export const deleteExpense = asyncHandler(async (req, res) => {
  ok(res, await budgetService.deleteExpense(req.params.id, req.params.expenseId, req.user.id));
});