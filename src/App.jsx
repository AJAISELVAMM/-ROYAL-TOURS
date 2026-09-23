import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { pingBackendHealth } from './services/api.js';

import TouristLayout from './components/layout/TouristLayout.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import { RequireTourist, RequireAdmin, RedirectIfAuthed } from './components/auth/ProtectedRoute.jsx';

// Public pages
import LandingPage from './pages/public/LandingPage.jsx';
import LoginPage from './pages/public/LoginPage.jsx';
import CreateAccountPage from './pages/public/CreateAccountPage.jsx';
import VerifyPhonePage from './pages/public/VerifyPhonePage.jsx';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/public/ResetPasswordPage.jsx';
import NotFound from './pages/NotFound.jsx';

// Tourist pages
import Dashboard from './pages/tourist/Dashboard.jsx';
import MyJourney from './pages/tourist/MyJourney.jsx';
import TripView from './pages/tourist/TripView.jsx';
import BudgetView from './pages/tourist/BudgetView.jsx';
import PackingView from './pages/tourist/PackingView.jsx';
import GroupView from './pages/tourist/GroupView.jsx';
import SmartTravel from './pages/tourist/SmartTravel.jsx';
import TransportView from './pages/tourist/TransportView.jsx';
import FairFareView from './pages/tourist/FairFareView.jsx';
import TranslatorView from './pages/tourist/TranslatorView.jsx';
import WeatherView from './pages/tourist/WeatherView.jsx';
import Discover from './pages/tourist/Discover.jsx';
import PlacesView from './pages/tourist/PlacesView.jsx';
import HotelsView from './pages/tourist/HotelsView.jsx';
import RestaurantsView from './pages/tourist/RestaurantsView.jsx';
import TheatresView from './pages/tourist/TheatresView.jsx';
import ShoppingView from './pages/tourist/ShoppingView.jsx';
import DetailView from './pages/tourist/DetailView.jsx';
import Safety from './pages/tourist/Safety.jsx';
import SafetyMapView from './pages/tourist/SafetyMapView.jsx';
import LostView from './pages/tourist/LostView.jsx';
import ReportIssueView from './pages/tourist/ReportIssueView.jsx';
import EmergencyView from './pages/tourist/EmergencyView.jsx';
import Account from './pages/tourist/Account.jsx';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminTravelData from './pages/admin/AdminTravelData.jsx';
import AdminAI from './pages/admin/AdminAI.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminSafety from './pages/admin/AdminSafety.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import AdminAccount from './pages/admin/AdminAccount.jsx';

export default function App() {
  useEffect(() => {
    // Non-blocking background ping to wake Render cold start on initial visit
    pingBackendHealth();
  }, []);

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/create-account"
        element={
          <RedirectIfAuthed>
            <CreateAccountPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <CreateAccountPage />
          </RedirectIfAuthed>
        }
      />
      <Route path="/verify-phone" element={<VerifyPhonePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Tourist (protected) */}
      <Route
        element={
          <RequireTourist>
            <TouristLayout />
          </RequireTourist>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-journey" element={<MyJourney />}>
          <Route path="trip" element={<TripView />} />
          <Route path="trips" element={<TripView />} />
          <Route path="budget" element={<BudgetView />} />
          <Route path="packing" element={<PackingView />} />
          <Route path="group" element={<GroupView />} />
          <Route path="group/:groupId" element={<GroupView />} />
        </Route>
        <Route path="/smart-travel" element={<SmartTravel />}>
          <Route path="transport" element={<TransportView />} />
          <Route path="fair-fare" element={<FairFareView />} />
          <Route path="translator" element={<TranslatorView />} />
          <Route path="weather" element={<WeatherView />} />
        </Route>
        <Route path="/discover" element={<Discover />}>
          <Route path="places" element={<PlacesView />} />
          <Route path="hotels" element={<HotelsView />} />
          <Route path="restaurants" element={<RestaurantsView />} />
          <Route path="theatres" element={<TheatresView />} />
          <Route path="shopping" element={<ShoppingView />} />
        </Route>
        <Route path="/discover/detail/:type/:id" element={<DetailView />} />
        <Route path="/discover/details/:type/:id" element={<DetailView />} />
        <Route path="/discover/places/:id" element={<DetailView />} />
        <Route path="/discover/hotels/:id" element={<DetailView />} />
        <Route path="/discover/restaurants/:id" element={<DetailView />} />
        <Route path="/discover/theatres/:id" element={<DetailView />} />
        <Route path="/discover/shopping/:id" element={<DetailView />} />
        <Route path="/safety" element={<Safety />}>
          <Route path="map" element={<SafetyMapView />} />
          <Route path="lost" element={<LostView />} />
          <Route path="report" element={<ReportIssueView />} />
          <Route path="emergency" element={<EmergencyView />} />
        </Route>
        <Route path="/account" element={<Account />} />
      </Route>

      {/* Admin (hidden — only reachable by authorized admin login) */}
      <Route
        path="/control-center"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="travel-data" element={<AdminTravelData />} />
        <Route path="ai" element={<AdminAI />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="safety" element={<AdminSafety />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="account" element={<AdminAccount />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
