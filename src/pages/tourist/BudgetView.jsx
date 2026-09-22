import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Icon from '../../components/common/Icon.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { DonutChart } from '../../components/common/Chart.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useStore from '../../useStore.js';
import { setState } from '../../store.js';
import useLoad from '../../hooks/useLoad.js';
import * as tripService from '../../services/tripService.js';
import {
  parseCost,
  getDurationDays,
  getActiveMemberCount,
  buildBudgetAllocation
} from '../../utils/budgetTrip.js';

const CATEGORIES = [
  { key: 'hotel', label: 'Hotel', icon: 'bed', color: '#7c3aed', percent: 0.36 },
  { key: 'food', label: 'Food', icon: 'utensils', color: '#a78bfa', percent: 0.24 },
  { key: 'transport', label: 'Transport', icon: 'bus', color: '#c4b5fd', percent: 0.18 },
  { key: 'entertainment', label: 'Entertainment', icon: 'film', color: '#8b5cf6', percent: 0.10 },
  { key: 'attractions', label: 'Attractions', icon: 'map-pin', color: '#5b21b6', percent: 0.12 }
];

function formatMoney(value, decimals = 0) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function expenseCategoryKey(category) {
  const value = String(category || '').toLowerCase().trim();
  if (value === 'accommodation' || value === 'hotel') return 'hotel';
  if (value === 'food' || value === 'meal' || value === 'restaurant') return 'food';
  if (value === 'transport' || value === 'travel' || value === 'taxi' || value === 'bus') return 'transport';
  if (value === 'entertainment' || value === 'activities' || value === 'activity' || value === 'shopping') return 'entertainment';
  if (value === 'attractions' || value === 'attraction' || value === 'sightseeing') return 'attractions';
  return 'entertainment';
}

function getCategoryIcon(catKey) {
  const found = CATEGORIES.find((c) => c.key === catKey);
  return found ? found.icon : 'wallet';
}

function getCategoryColor(catKey) {
  const found = CATEGORIES.find((c) => c.key === catKey);
  return found ? found.color : '#7c3aed';
}

function formatTripDates(trip) {
  if (trip?.startDate && trip?.endDate) {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const opts = { day: '2-digit', month: 'short', year: 'numeric' };
      return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
    }
  }
  return trip?.dates || 'Dates not set';
}

function getTripMembersList(trip, user, explicitMemberCount, budgetData) {
  if (Array.isArray(budgetData?.members) && budgetData.members.length > 0) {
    return budgetData.members;
  }

  const rawMembers = Array.isArray(trip?.members) ? trip.members : [];
  const active = rawMembers.filter((m) => {
    const status = String(m?.memberStatus || m?.status || '').toUpperCase();
    return !['LEFT', 'REMOVED'].includes(status);
  });

  if (active.length > 0) {
    return active.map((m, idx) => {
      const isLead = idx === 0 || m.role === 'Owner' || m.role === 'Lead Traveler' || (trip?.userId && m.userId === trip.userId);
      const realName = m.user?.name || 
        (m.name && !m.name.startsWith('Traveler ') && !m.name.startsWith('Member ') ? m.name : '') ||
        (isLead ? (trip?.touristName || user?.name || m.name) : m.name);

      return {
        id: m.id || m.userId || `member-${idx}`,
        userId: m.userId || m.id,
        name: realName || (isLead ? 'Lead Traveler' : m.name || `Member ${idx + 1}`),
        role: m.role || (isLead ? 'Lead Traveler' : 'Member'),
        avatarUrl: m.avatarUrl || m.user?.avatarUrl || null
      };
    });
  }

  const ownerName = user?.name || trip?.touristName || 'Lead Traveler';
  return [
    {
      id: `owner-${user?.id || 'lead'}`,
      userId: user?.id || null,
      name: ownerName,
      role: 'Lead Traveler',
      avatarUrl: user?.avatarUrl || null
    }
  ];
}

export default function BudgetView() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const store = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const { loading } = useLoad(() => tripService.getTrips(user?.id), [user?.id]);
  const [budgetData, setBudgetData] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Add Expense modal state
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Hotel',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Filter trips belonging to this user
  const userTrips = useMemo(() => {
    return (store.trips || []).filter(
      (t) => !user?.id || t.touristId === user.id || t.userId === user.id || t.members?.some((m) => m.userId === user.id)
    );
  }, [store.trips, user?.id]);

  // Read selected trip ID from URL search param for 100% reliable refresh persistence
  const selectedTripId = searchParams.get('tripId');
  const trip = useMemo(() => {
    if (!selectedTripId) return null;
    return userTrips.find((t) => t.id === selectedTripId) || null;
  }, [selectedTripId, userTrips]);

  // When a trip is selected, fetch fresh budget and expenses from backend API
  useEffect(() => {
    let active = true;
    if (!trip?.id) {
      setBudgetData(null);
      return undefined;
    }
    setBudgetLoading(true);
    tripService.getBudget(trip.id)
      .then((data) => {
        if (active) setBudgetData(data);
      })
      .catch(() => {
        if (active) setBudgetData(null);
      })
      .finally(() => {
        if (active) setBudgetLoading(false);
      });
    return () => { active = false; };
  }, [trip?.id]);

  function handleSelectTrip(tripId) {
    setSearchParams({ tripId });
    setState((s) => ({ ...s, selectedTripId: tripId }));
  }

  function handleBackToTrips() {
    setSearchParams({});
    setState((s) => ({ ...s, selectedTripId: null }));
  }

  async function handleAddExpenseSubmit(e) {
    if (e) e.preventDefault();
    if (!expenseForm.title.trim()) {
      push('Please enter an expense title.', 'error');
      return;
    }
    const amt = Math.round(Number(expenseForm.amount));
    if (!amt || amt <= 0) {
      push('Please enter a valid expense amount.', 'error');
      return;
    }
    setSavingExpense(true);
    try {
      const updatedBudget = await tripService.createExpense(trip.id, {
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        amount: amt,
        date: expenseForm.date,
        description: expenseForm.description ? expenseForm.description.trim() : null
      });
      setBudgetData(updatedBudget);
      setAddExpenseOpen(false);
      setExpenseForm({
        title: '',
        category: 'Hotel',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      push('Expense added successfully!', 'success');
      tripService.getTrips(user?.id);
    } catch (err) {
      push(err?.message || 'Could not add expense.', 'error');
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleDeleteExpense(expenseId) {
    try {
      const updatedBudget = await tripService.deleteExpense(trip.id, expenseId);
      setBudgetData(updatedBudget);
      push('Expense deleted.', 'info');
      tripService.getTrips(user?.id);
    } catch (err) {
      push(err?.message || 'Could not delete expense.', 'error');
    }
  }

  // 1. Initial State: No trips created yet in the system
  if (!loading && userTrips.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        title="No trips found"
        message="Create your first trip to view and track your journey budget."
        action={<Button onClick={() => navigate('/my-journey/trip?create=true')} icon="sparkles">Create My Trip</Button>}
      />
    );
  }

  // 2. Initial State with Trips: User clicked Budget → Show Trip Selection List
  if (!trip) {
    return (
      <div className="journey-view">
        <Card className="select-trip-card">
          <div className="card-head">
            <div>
              <h2>Select a Trip to View Budget</h2>
              <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                Choose one of your planned trips below to view its dynamic budget breakdown.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {userTrips.map((t) => {
              const tripName = t.destination?.toLowerCase().includes('trip') ||
                t.destination?.toLowerCase().includes('tour') ||
                t.destination?.toLowerCase().includes('getaway') ||
                t.destination?.toLowerCase().includes('escape')
                ? t.destination
                : `${t.destination} Trip`;
              const duration = getDurationDays(t);
              const members = getActiveMemberCount(t);
              const dateString = formatTripDates(t);
              const tripBudgetAmount = parseCost(t.budget || t.totalBudget || t.tripBudget);

              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTrip(t.id)}
                  className="account-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    background: 'var(--bg-card, #ffffff)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="marker-icon purple" style={{ width: '42px', height: '42px', borderRadius: '12px' }}>
                      <Icon name="map" size={20} />
                    </span>
                    <div>
                      <strong style={{ fontSize: '16px', color: 'var(--text)', fontWeight: 650 }}>
                        {tripName}
                      </strong>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {dateString}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--purple)', fontWeight: 600, marginTop: '2px' }}>
                        {duration} {duration === 1 ? 'day' : 'days'} · {members} {members === 1 ? 'member' : 'members'} · ₹{formatMoney(tripBudgetAmount)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon name="chevron-right" size={22} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  // 3. Selected Trip Budget Details
  const durationDays = getDurationDays(trip);
  const memberCount = getActiveMemberCount(trip);

  // Exact trip budget from trip data (the source of truth)
  const totalBudget = parseCost(budgetData?.totalBudget ?? trip.budget ?? trip.totalBudget ?? trip.tripBudget);

  // Real recorded spending from API/database
  const expenses = Array.isArray(budgetData?.expenses)
    ? budgetData.expenses
    : (Array.isArray(trip.expenses) ? trip.expenses : []);
  const totalSpent = budgetData?.totalSpent != null
    ? parseCost(budgetData.totalSpent)
    : expenses.reduce((sum, e) => sum + parseCost(e.amount), 0);

  const remaining = totalBudget - totalSpent;
  const over = remaining < 0;

  // Daily budget per member: Total Trip Budget ÷ Trip Days ÷ Number of Members
  const perPersonPerDay = durationDays > 0 && memberCount > 0
    ? totalBudget / (durationDays * memberCount)
    : 0;

  // Category distribution: Exact percentage allocation (Hotel 36%, Food 24%, Transport 18%, Entertainment 10%, Attractions 12%)
  const allocation = buildBudgetAllocation(trip, totalBudget, durationDays, memberCount);

  // Real spending per category from actual expense records
  const categorySpending = {};
  CATEGORIES.forEach((c) => {
    categorySpending[c.key] = expenses
      .filter((e) => expenseCategoryKey(e.category) === c.key)
      .reduce((sum, e) => sum + parseCost(e.amount), 0);
  });

  // Donut chart represents the selected trip's category allocations
  const donutData = CATEGORIES.map((c) => ({
    label: c.label,
    value: allocation[c.key] || 0,
    color: c.color
  })).filter((d) => d.value > 0);

  // Member-wise budget breakdown
  const membersList = getTripMembersList(trip, user, memberCount, budgetData);
  const activeMemberCount = Math.max(1, membersList.length);
  const memberShare = activeMemberCount > 0 ? (totalBudget / activeMemberCount) : 0;

  const selectedTripTitle = trip.destination?.toLowerCase().includes('trip') ||
    trip.destination?.toLowerCase().includes('tour') ||
    trip.destination?.toLowerCase().includes('getaway') ||
    trip.destination?.toLowerCase().includes('escape')
    ? trip.destination
    : `${trip.destination} Trip`;

  return (
    <div className="journey-view">
      {/* Top navigation row: ← Back to Trips */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <Button
          variant="ghost"
          size="sm"
          icon="arrow-left"
          onClick={handleBackToTrips}
        >
          ← Back to Trips
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
          <Icon name="map-pin" size={15} />
          <strong style={{ color: 'var(--text)' }}>{selectedTripTitle}</strong>
        </div>
      </div>

      {/* Selected Trip Header Card */}
      <Card style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className="marker-icon purple" style={{ width: '46px', height: '46px', borderRadius: '12px' }}>
              <Icon name="map" size={22} />
            </span>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>{selectedTripTitle}</h2>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px' }}>
                <span>{formatTripDates(trip)}</span>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>{durationDays} {durationDays === 1 ? 'day' : 'days'}</span>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon="eye"
              onClick={() => navigate('/my-journey/trip')}
            >
              View / Edit Trip
            </Button>
          </div>
        </div>
      </Card>

      {/* Top row: Budget Summary + Spending Breakdown Donut */}
      <div className="budget-grid">
        <Card className="budget-summary">
          <div className="card-head">
            <h2>Total Budget</h2>
            {over ? <StatusBadge status="Over Budget">Over Budget</StatusBadge> : <StatusBadge status="Within Budget">Within Budget</StatusBadge>}
          </div>
          <div className="budget-total">
            ₹{formatMoney(totalBudget)}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '10px' }}>
              ({durationDays} {durationDays === 1 ? 'day' : 'days'} · {memberCount} {memberCount === 1 ? 'member' : 'members'})
            </span>
          </div>
          <div className="budget-stats">
            <div className="budget-stat">
              <span className="budget-stat-label">Total Spent</span>
              <span className="budget-stat-value">₹{formatMoney(totalSpent)}</span>
            </div>
            <div className="budget-stat">
              <span className="budget-stat-label">Remaining</span>
              <span className={`budget-stat-value ${over ? 'text-danger' : 'text-success'}`}>
                ₹{formatMoney(remaining)}
              </span>
            </div>
            <div className="budget-stat">
              <span className="budget-stat-label">Daily / Member</span>
              <span className="budget-stat-value">₹{formatMoney(perPersonPerDay, 2)}</span>
            </div>
          </div>
        </Card>

        <Card className="budget-chart">
          <div className="card-head"><h2>Spending Breakdown</h2></div>
          <div className="budget-chart-inner">
            <DonutChart data={donutData} centerValue={`₹${formatMoney(totalSpent)}`} centerLabel="spent" />
            <div className="donut-legend">
              {CATEGORIES.map((c) => (
                <div className="legend-row" key={c.key}>
                  <span className="legend-dot" style={{ background: c.color }} />
                  <span className="legend-label">{c.label} ({Math.round(c.percent * 100)}%)</span>
                  <span className="legend-value">
                    ₹{formatMoney(categorySpending[c.key])} / ₹{formatMoney(allocation[c.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Category-wise Budget Allocation Details */}
      <div style={{ marginTop: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {CATEGORIES.map((c) => {
            const allocated = allocation[c.key] || 0;
            const spent = categorySpending[c.key] || 0;
            const catRemaining = Math.max(0, allocated - spent);
            const usedPercent = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;

            return (
              <Card key={c.key} style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="cat-icon" style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${c.color}1a`, color: c.color }}>
                      <Icon name={c.icon} size={16} />
                    </span>
                    <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{c.label}</strong>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {Math.round(c.percent * 100)}%
                  </span>
                </div>

                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                  ₹{formatMoney(allocated)}
                </div>

                <div className="progress-track" style={{ height: '6px' }}>
                  <div
                    className="progress-fill"
                    style={{ width: `${usedPercent}%`, background: usedPercent > 90 ? 'var(--red)' : c.color }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <span>Spent: ₹{formatMoney(spent)}</span>
                  <span>Remaining: ₹{formatMoney(catRemaining)}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px', textAlign: 'right' }}>
                  {usedPercent}% used
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Member-wise Budget Information */}
      <Card className="budget-members" style={{ marginTop: '18px' }}>
        <div className="card-head">
          <div>
            <h2>Member Budget Breakdown</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Equal budget share of ₹{formatMoney(memberShare, 2)} per member ({activeMemberCount} {activeMemberCount === 1 ? 'member' : 'members'})
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '14px' }}>
          {membersList.map((m, idx) => {
            const memberSpent = m.spent != null
              ? Number(m.spent)
              : (activeMemberCount > 0 ? (totalSpent / activeMemberCount) : 0);
            const memberBudgetShare = m.budgetShare != null ? Number(m.budgetShare) : memberShare;
            const memberRemaining = m.remaining != null ? Number(m.remaining) : (memberBudgetShare - memberSpent);
            const usagePercent = memberBudgetShare > 0
              ? Math.min(100, Math.round((memberSpent / memberBudgetShare) * 100))
              : 0;
            const isCurrentUser = user?.id && m.userId === user.id;

            return (
              <div
                key={m.id || idx}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  background: 'var(--bg, #f9fafb)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--purple-50, #f5f3ff)',
                        color: 'var(--purple, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      {m.name ? m.name.charAt(0).toUpperCase() : 'M'}
                    </span>
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{m.name}</strong>
                      {isCurrentUser && (
                        <span className="chip chip-muted" style={{ fontSize: '10px', marginLeft: '6px', padding: '1px 5px' }}>You</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--border-soft)', padding: '2px 6px', borderRadius: '4px' }}>
                    {m.role}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Budget Share</span>
                  <strong style={{ color: 'var(--text)' }}>₹{formatMoney(memberBudgetShare, 2)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Spent</span>
                  <strong style={{ color: 'var(--text)' }}>₹{formatMoney(memberSpent, 2)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Remaining</span>
                  <strong className={memberRemaining < 0 ? 'text-danger' : 'text-success'}>₹{formatMoney(memberRemaining, 2)}</strong>
                </div>

                <div style={{ marginTop: '4px' }}>
                  <div className="progress-track" style={{ height: '6px' }}>
                    <div className="progress-fill" style={{ width: `${usagePercent}%`, background: usagePercent > 90 ? 'var(--red)' : 'var(--purple)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {usagePercent}% used
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Expenses Section */}
      <Card style={{ marginTop: '18px' }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2>Recent Expenses {expenses.length > 0 ? `(${expenses.length})` : ''}</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Actual recorded expenses for this trip.
            </span>
          </div>
          <Button icon="plus" size="sm" onClick={() => setAddExpenseOpen(true)}>
            + Add Expense
          </Button>
        </div>

        {expenses.length === 0 ? (
          <div style={{ padding: '20px 0' }}>
            <EmptyState
              icon="wallet"
              title="No expenses recorded yet"
              message="Track real trip expenses by clicking + Add Expense."
              action={<Button icon="plus" size="sm" onClick={() => setAddExpenseOpen(true)}>+ Add Expense</Button>}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {expenses.map((expense) => {
              const catKey = expenseCategoryKey(expense.category);
              const catIcon = getCategoryIcon(catKey);
              const catColor = getCategoryColor(catKey);
              const dateStr = expense.spentAt || expense.date;
              const formattedDate = dateStr
                ? new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Recent';

              return (
                <div
                  key={expense.id}
                  className="account-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    background: 'var(--bg-card, #ffffff)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span className="marker-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${catColor}1a`, color: catColor }}>
                      <Icon name={catIcon} size={18} />
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14.5px', color: 'var(--text)' }}>{expense.title}</strong>
                        <span className="chip chip-muted" style={{ fontSize: '11px', padding: '1px 6px' }}>
                          {expense.category}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <span>{formattedDate}</span>
                        {expense.description && (
                          <>
                            <span style={{ margin: '0 5px' }}>·</span>
                            <span>{expense.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--text)' }}>
                      ₹{formatMoney(expense.amount)}
                    </strong>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleDeleteExpense(expense.id)}
                      title="Delete expense"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add Expense Modal */}
      <Modal
        open={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        title="Add Expense"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddExpenseOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddExpenseSubmit} loading={savingExpense} icon="plus">
              Add Expense
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddExpenseSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label className="field">
            <span className="field-label">Expense Title *</span>
            <input
              type="text"
              required
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              placeholder="e.g. Hotel Booking, Dinner, Taxi fare"
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">Category *</span>
            <select
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            >
              <option value="Hotel">Hotel</option>
              <option value="Food">Food</option>
              <option value="Transport">Transport</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Attractions">Attractions</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Amount (₹) *</span>
            <input
              type="number"
              required
              min="1"
              step="1"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              placeholder="e.g. 1500"
            />
          </label>

          <label className="field">
            <span className="field-label">Date *</span>
            <div className="field-control">
              <Icon name="calendar" size={16} />
              <input
                type="date"
                required
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Note / Description (Optional)</span>
            <input
              type="text"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              placeholder="e.g. Paid via UPI / bill receipt"
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
