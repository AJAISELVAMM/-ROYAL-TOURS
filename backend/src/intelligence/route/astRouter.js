// =============================================================================
// astRouter.js — A* path-finding over a node/edge graph.
//
// f(n) = g(n) + h(n)
//   g(n): actual cost from the origin (distance + optional traffic minutes)
//   h(n): admissible heuristic — straight-line (Haversine) distance to the goal.
//
// This is a DETERMINISTIC search algorithm (not a trained ML model). It is used
// for custom-graph route optimization and to order an itinerary's selected
// places; real road routing still goes through the configured routing provider.
// =============================================================================

import { haversineKm } from '../geo/haversine.js';
import config from '../config.js';

// Minimal binary min-heap keyed by f-score.
class MinHeap {
  constructor() {
    this.items = [];
  }
  push(item) {
    this.items.push(item);
    this.items.sort((a, b) => a.f - b.f);
  }
  pop() {
    return this.items.shift();
  }
  get size() {
    return this.items.length;
  }
}

// Normalize a flexible graph input into:
//   nodes: { id: { id, lat, lon } }
//   adjacency: { id: [ { to, distanceKm, durationMinutes } ] }
// Edges may be provided with explicit costs, or derive from node coordinates.
export function normalizeGraph(graph) {
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    throw new Error('A graph with at least one node is required.');
  }

  const nodes = {};
  for (const n of graph.nodes) {
    if (!n || n.id == null) throw new Error('Every node requires an id.');
    nodes[n.id] = { id: n.id, lat: Number(n.lat), lon: Number(n.lon) };
  }

  const adjacency = {};
  Object.keys(nodes).forEach((id) => {
    adjacency[id] = [];
  });

  const edges = graph.edges || [];
  for (const e of edges) {
    const from = nodes[e.from];
    const to = nodes[e.to];
    if (!from || !to) throw new Error(`Edge references an unknown node (${e.from} -> ${e.to}).`);
    const distanceKm =
      e.distanceKm != null ? Number(e.distanceKm) : haversineKm(from.lat, from.lon, to.lat, to.lon);
    const speed = config.routing.speeds.default;
    const durationMinutes =
      e.durationMinutes != null ? Number(e.durationMinutes) : (distanceKm / speed) * 60;
    const trafficCost = e.trafficCost != null ? Number(e.trafficCost) : 0;
    adjacency[e.from].push({ to: e.to, distanceKm, durationMinutes, trafficCost });
    // Assume undirected unless directed:true.
    if (!graph.directed) {
      adjacency[e.to].push({ to: e.from, distanceKm, durationMinutes, trafficCost });
    }
  }

  return { nodes, adjacency };
}

// Run A* from `start` to `goal` (node ids).
// options.heuristicKmPerHour — speed used to convert the heuristic distance
//   into the same cost units as g (defaults to the config default speed).
// Returns { path, distanceKm, durationMinutes, steps, geometry } or null.
export function astar(graph, start, goal, options = {}) {
  const { nodes, adjacency } = normalizeGraph(graph);

  if (!nodes[start]) throw new Error(`Start node '${start}' not found in graph.`);
  if (!nodes[goal]) throw new Error(`Goal node '${goal}' not found in graph.`);
  if (start === goal) {
    return emptyRoute(nodes[start]);
  }

  const speedKmh = options.heuristicKmPerHour || config.routing.speeds.default;

  const gScore = { [start]: 0 };
  const cameFrom = {};
  const closed = new Set();
  const open = new MinHeap();
  open.push({ id: start, f: heuristic(nodes[start], nodes[goal], speedKmh) });

  while (open.size > 0) {
    const current = open.pop().id;
    if (closed.has(current)) continue;
    if (current === goal) return reconstruct(cameFrom, nodes, gScore, goal);

    closed.add(current);
    for (const edge of adjacency[current] || []) {
      if (closed.has(edge.to)) continue;
      const stepCost = edge.distanceKm + edge.trafficCost / 60 * speedKmh; // minutes -> km-equivalent
      const tentative = gScore[current] + stepCost;
      if (gScore[edge.to] == null || tentative < gScore[edge.to]) {
        gScore[edge.to] = tentative;
        cameFrom[edge.to] = current;
        open.push({ id: edge.to, f: tentative + heuristic(nodes[edge.to], nodes[goal], speedKmh) });
      }
    }
  }

  return null; // no route
}

function heuristic(a, b, speedKmh) {
  return haversineKm(a.lat, a.lon, b.lat, b.lon);
}

function emptyRoute(node) {
  return {
    path: [node.id],
    distanceKm: 0,
    durationMinutes: 0,
    steps: [{ index: 0, instruction: `Start at ${node.id}`, distanceMeters: 0, durationSeconds: 0 }],
    geometry: { type: 'LineString', coordinates: [[node.lon, node.lat]] }
  };
}

function reconstruct(cameFrom, nodes, gScore, goal) {
  const path = [goal];
  let cur = goal;
  while (cameFrom[cur] != null) {
    cur = cameFrom[cur];
    path.unshift(cur);
  }

  const coordinates = [];
  const steps = [];
  let distanceKm = 0;
  for (let i = 0; i < path.length; i++) {
    const node = nodes[path[i]];
    coordinates.push([node.lon, node.lat]);
    if (i === 0) {
      steps.push({ index: 0, instruction: `Start at ${node.id}`, distanceMeters: 0, durationSeconds: 0 });
    } else {
      const prev = nodes[path[i - 1]];
      const leg = haversineKm(prev.lat, prev.lon, node.lat, node.lon);
      distanceKm += leg;
      steps.push({
        index: i,
        instruction: `Continue to ${node.id}`,
        distanceMeters: Math.round(leg * 1000),
        durationSeconds: Math.round((leg / config.routing.speeds.default) * 3600)
      });
    }
  }

  const durationMinutes = Math.max(1, Math.round((distanceKm / config.routing.speeds.default) * 60));

  return {
    path,
    distanceKm: +distanceKm.toFixed(2),
    durationMinutes,
    steps,
    geometry: { type: 'LineString', coordinates }
  };
}

// Build a complete graph from a set of coordinate "waypoints" (with optional
// edges) so itinerary/route callers can optimize a path through them.
export function graphFromWaypoints(waypoints, { idPrefix = 'wp', directed = false } = {}) {
  const nodes = waypoints.map((w, i) => ({
    id: w.id || `${idPrefix}${i}`,
    lat: w.lat,
    lon: w.lon
  }));
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      edges.push({ from: nodes[i].id, to: nodes[j].id });
    }
  }
  return { nodes, edges, directed };
}
