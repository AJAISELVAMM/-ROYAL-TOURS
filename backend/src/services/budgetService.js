import prisma from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';

const CATEGORY_ALIASES = new Map([
  ['hotel', 'Hotel'],
  ['accommodation', 'Hotel'],
  ['food', 'Food'],
  ['transport', 'Transport'],
  ['entertainment', 'Entertainment'],
  ['activities', 'Entertainment'],
  ['activity', 'Entertainment'],
  ['attractions', 'Attractions'],
  ['attraction', 'Attractions'],
  ['shopping', 'Shopping'],
  ['emergency', 'Emergency'],
  ['other', 'Other']
]);

function normalizeCategory(value) {
  const category = CATEGORY_ALIASES.get(String(value || '').trim().toLowerCase());
  if (!category) throw badRequest('A valid expense category is required.');
  return category;
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw badRequest('A valid expense date is required.');
  return date;
}

function serializeExpense(expense) {
  return { ...expense, amount: Number(expense.amount) };
}

async function ownedTrip(tripId, userId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      members: {
        where: {
          status: { notIn: ['LEFT', 'REMOVED'] }
        },
        include: {
          user: { select: { id: true, name: true, phone: true, avatarUrl: true } }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  if (!trip) throw notFound('Trip not found.');
  const caller = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  const callerCleanPhone = caller?.phone ? caller.phone.replace(/\D/g, '').slice(-10) : '';
  const isOwner = trip.userId === userId;
  const isMember = Array.isArray(trip.members) && trip.members.some((m) => 
    m.userId === userId || (callerCleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === callerCleanPhone)
  );
  if (!isOwner && !isMember) throw forbidden('You do not have permission to access this trip budget.');

  // Resolve member users by phone if userId is not linked
  if (Array.isArray(trip.members) && trip.members.length > 0) {
    const unlinkedPhones = trip.members
      .filter((m) => !m.user && m.phone)
      .map((m) => m.phone.replace(/\D/g, '').slice(-10))
      .filter(Boolean);

    if (unlinkedPhones.length > 0) {
      const matchedUsers = await prisma.user.findMany({
        where: {
          phone: { in: unlinkedPhones }
        },
        select: { id: true, name: true, phone: true, avatarUrl: true }
      });
      const userPhoneMap = new Map(matchedUsers.map((u) => [u.phone.replace(/\D/g, '').slice(-10), u]));

      trip.members = trip.members.map((m) => {
        if (!m.user && m.phone) {
          const clean = m.phone.replace(/\D/g, '').slice(-10);
          const found = userPhoneMap.get(clean);
          if (found) {
            return { ...m, userId: found.id, user: found, name: found.name || m.name };
          }
        }
        return m;
      });
    }
  }

  return trip;
}

function summarize(trip, expenses) {
  const categoryTotals = {
    Hotel: 0,
    Food: 0,
    Transport: 0,
    Entertainment: 0,
    Attractions: 0,
    Shopping: 0,
    Emergency: 0,
    Other: 0
  };
  const serialized = expenses.map(serializeExpense);
  serialized.forEach((expense) => {
    let cat = expense.category;
    if (cat === 'Accommodation') cat = 'Hotel';
    if (cat === 'Activities') cat = 'Entertainment';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
  });
  const totalSpent = serialized.reduce((sum, expense) => sum + expense.amount, 0);
  const totalBudget = Number(trip.budget) || 0;
  const remainingBudget = totalBudget - totalSpent;

  // Resolve active members list (include all trip participants except those who explicitly left or were removed)
  let activeMembers = Array.isArray(trip.members)
    ? trip.members.filter((m) => !['LEFT', 'REMOVED'].includes(m.status))
    : [];

  // If creator is not in activeMembers list, include them as Lead Traveler
  const hasOwner = activeMembers.some((m) => m.userId === trip.userId || (trip.user?.phone && m.phone?.includes(trip.user.phone.slice(-10))));
  if (!hasOwner && trip.user) {
    activeMembers.unshift({
      id: `owner-${trip.userId}`,
      userId: trip.userId,
      name: trip.user.name || 'Lead Traveler',
      phone: trip.user.phone || '',
      role: 'Lead Traveler',
      user: trip.user
    });
  }

  // If still empty, fall back to owner
  if (activeMembers.length === 0) {
    activeMembers = [
      {
        id: `owner-${trip.userId}`,
        userId: trip.userId,
        name: trip.user?.name || 'Lead Traveler',
        phone: trip.user?.phone || '',
        role: 'Lead Traveler',
        user: trip.user
      }
    ];
  }

  const memberCount = Math.max(1, activeMembers.length);
  const perMemberBudget = memberCount > 0 ? totalBudget / memberCount : 0;
  const perMemberSpent = memberCount > 0 ? totalSpent / memberCount : 0;
  const perMemberRemaining = perMemberBudget - perMemberSpent;

  const members = activeMembers.map((m, idx) => {
    const displayName = m.user?.name || m.name || (m.userId === trip.userId && trip.user?.name ? trip.user.name : `Traveler ${idx + 1}`);
    return {
      id: m.id || m.userId || `member-${idx}`,
      userId: m.userId || m.user?.id || null,
      name: displayName,
      role: m.role || (idx === 0 ? 'Lead Traveler' : 'Member'),
      budgetShare: perMemberBudget,
      spent: perMemberSpent,
      remaining: perMemberRemaining,
      usagePercent: perMemberBudget > 0 ? Math.min(100, Math.round((perMemberSpent / perMemberBudget) * 100)) : 0,
      avatarUrl: m.user?.avatarUrl || m.avatarUrl || null
    };
  });

  return {
    tripId: trip.id,
    totalBudget,
    totalSpent,
    remainingBudget,
    percentageUsed: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    categoryTotals,
    expenses: serialized,
    memberCount,
    perMemberBudget,
    perMemberSpent,
    perMemberRemaining,
    members
  };
}

export async function getBudget(tripId, userId) {
  const trip = await ownedTrip(tripId, userId);
  const expenses = await prisma.tripExpense.findMany({
    where: { tripId },
    orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }]
  });
  return summarize(trip, expenses);
}

export async function createExpense(tripId, userId, input) {
  await ownedTrip(tripId, userId);
  const title = String(input.title || '').trim();
  const amount = Number(input.amount);
  if (!title) throw badRequest('Expense title is required.');
  if (!Number.isInteger(amount) || amount <= 0) throw badRequest('Expense amount must be a positive whole number.');

  const expense = await prisma.tripExpense.create({
    data: {
      tripId,
      category: normalizeCategory(input.category),
      title,
      description: input.description ? String(input.description).trim() : null,
      amount,
      currency: String(input.currency || 'INR').trim().toUpperCase(),
      spentAt: normalizeDate(input.date || input.spentAt)
    }
  });
  return getBudget(tripId, userId).then((budget) => ({ ...budget, expense: serializeExpense(expense) }));
}

export async function updateExpense(tripId, expenseId, userId, input) {
  await ownedTrip(tripId, userId);
  const existing = await prisma.tripExpense.findFirst({ where: { id: expenseId, tripId } });
  if (!existing) throw notFound('Expense not found.');
  const title = String(input.title || '').trim();
  const amount = Number(input.amount);
  if (!title) throw badRequest('Expense title is required.');
  if (!Number.isInteger(amount) || amount <= 0) throw badRequest('Expense amount must be a positive whole number.');

  const expense = await prisma.tripExpense.update({
    where: { id: expenseId },
    data: {
      category: normalizeCategory(input.category),
      title,
      description: input.description ? String(input.description).trim() : null,
      amount,
      currency: String(input.currency || existing.currency || 'INR').trim().toUpperCase(),
      spentAt: normalizeDate(input.date || input.spentAt)
    }
  });
  return getBudget(tripId, userId).then((budget) => ({ ...budget, expense: serializeExpense(expense) }));
}

export async function deleteExpense(tripId, expenseId, userId) {
  await ownedTrip(tripId, userId);
  const existing = await prisma.tripExpense.findFirst({ where: { id: expenseId, tripId } });
  if (!existing) throw notFound('Expense not found.');
  await prisma.tripExpense.delete({ where: { id: expenseId } });
  return getBudget(tripId, userId);
}