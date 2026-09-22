import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Icon from '../../components/common/Icon.jsx';
import AdminStatCard from '../../components/admin/AdminStatCard.jsx';
import { BarChart, LineChart } from '../../components/common/Chart.jsx';
import * as adminService from '../../services/adminService.js';

const EMPTY = {
  users: { newUsers: [], activeUsers: [], returningUsers: [], labels: [] },
  trips: { tripsCreated: [], popularDestinations: [], avgTripDuration: '—' },
  discover: { popularPlaces: [], popularHotels: [], popularRestaurants: [], popularTheatres: [] },
  smartTravel: { fareChecks: 0, transportSearches: 0, translationUsage: 0 },
  safety: { safetyReports: 0, sosRequests: 0, safetyAlerts: 0 }
};

export default function AdminAnalytics() {
  const [a, setA] = useState(EMPTY);

  useEffect(() => {
    adminService.getAnalytics().then(setA).catch(() => {});
  }, []);

  return (
    <div className="page-inner">
      <h1 className="page-title">Analytics</h1>
      <p className="page-sub">Platform performance and usage insights.</p>

      <h2 className="section-title">Users</h2>
      <div className="analytics-grid">
        <Card className="analytics-chart">
          <div className="card-head"><h3>User Growth</h3></div>
          <LineChart
            series={[
              { name: 'New Users', data: a.users.newUsers, color: '#7c3aed' },
              { name: 'Active Users', data: a.users.activeUsers, color: '#a78bfa' },
              { name: 'Returning', data: a.users.returningUsers, color: '#10b981' }
            ]}
            labels={a.users.labels}
          />
        </Card>
      </div>

      <h2 className="section-title">Trips</h2>
      <div className="analytics-grid">
        <Card className="analytics-chart">
          <div className="card-head"><h3>Trips Created</h3></div>
          <BarChart data={a.trips.tripsCreated} labels={a.users.labels} />
        </Card>
        <Card className="analytics-list">
          <div className="card-head"><h3>Popular Destinations</h3></div>
          <div className="dest-list">
            {a.trips.popularDestinations.map((d) => (
              <div className="dest-row" key={d.name}>
                <span>{d.name}</span>
                <div className="dest-bar"><div className="dest-fill" style={{ width: `${d.value}%` }} /></div>
                <span>{d.value}%</span>
              </div>
            ))}
          </div>
          <div className="avg-duration">
            <Icon name="clock" size={16} /> Average trip duration: <strong>{a.trips.avgTripDuration}</strong>
          </div>
        </Card>
      </div>

      <h2 className="section-title">Discover</h2>
      <div className="analytics-grid">
        <Card className="analytics-chart">
          <div className="card-head"><h3>Popular Places</h3></div>
          <BarChart data={a.discover.popularPlaces.map((p) => p.value)} labels={a.discover.popularPlaces.map((p) => p.name)} color="#8b5cf6" showValues={false} />
        </Card>
        <Card className="analytics-list">
          <div className="card-head"><h3>Top Picks</h3></div>
          <div className="top-list">
            <div className="top-group">
              <strong><Icon name="bed" size={15} /> Hotels</strong>
              {a.discover.popularHotels.map((h) => <span key={h} className="top-item">{h}</span>)}
            </div>
            <div className="top-group">
              <strong><Icon name="utensils" size={15} /> Restaurants</strong>
              {a.discover.popularRestaurants.map((h) => <span key={h} className="top-item">{h}</span>)}
            </div>
            <div className="top-group">
              <strong><Icon name="film" size={15} /> Theatres</strong>
              {a.discover.popularTheatres.map((h) => <span key={h} className="top-item">{h}</span>)}
            </div>
          </div>
        </Card>
      </div>

      <h2 className="section-title">Smart Travel & Safety</h2>
      <div className="overview-grid overview-grid-admin">
        <AdminStatCard icon="target" label="Fare Checks" value={a.smartTravel.fareChecks.toLocaleString('en-IN')} tone="purple" />
        <AdminStatCard icon="bus" label="Transport Searches" value={a.smartTravel.transportSearches.toLocaleString('en-IN')} tone="blue" />
        <AdminStatCard icon="translate" label="Translation Usage" value={a.smartTravel.translationUsage.toLocaleString('en-IN')} tone="green" />
        <AdminStatCard icon="alert-triangle" label="Safety Reports" value={a.safety.safetyReports} tone="amber" />
        <AdminStatCard icon="siren" label="SOS Requests" value={a.safety.sosRequests} tone="red" />
        <AdminStatCard icon="shield" label="Safety Alerts" value={a.safety.safetyAlerts} tone="purple" />
      </div>
    </div>
  );
}
