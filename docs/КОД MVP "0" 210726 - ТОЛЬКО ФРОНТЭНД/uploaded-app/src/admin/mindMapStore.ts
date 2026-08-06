// ═══════════════════════════════════════════════════════════════════
//  Mind Map Store — localStorage persistence + CRUD operations
// ═══════════════════════════════════════════════════════════════════

import {
  BRANCHES,
  CROSS_CONNECTIONS,
  TIMELINE,
  STATUS,
} from './mindMapData';
import type { Branch, MindNode, Connection, TimelineItem, Status } from './mindMapData';

const STORAGE_KEY = 'ugt_mindmap_data';
const POSITIONS_KEY = 'ugt_mindmap_positions_v4';

// ─── Types ──────────────────────────────────────────────────────

interface StoredData {
  branches: Branch[];
  connections: Connection[];
  timeline: TimelineItem[];
}

// ─── Load / Save ────────────────────────────────────────────────

function getDefaultData(): StoredData {
  return {
    branches: JSON.parse(JSON.stringify(BRANCHES)),
    connections: JSON.parse(JSON.stringify(CROSS_CONNECTIONS)),
    timeline: JSON.parse(JSON.stringify(TIMELINE)),
  };
}

export function loadMindMapData(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredData;
      // Validate structure
      if (parsed.branches && Array.isArray(parsed.branches)) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return getDefaultData();
}

export function saveMindMapData(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

// ─── Node Positions ─────────────────────────────────────────────

export function loadNodePositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, { x: number; y: number }>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveNodePosition(id: string, pos: { x: number; y: number }): void {
  const positions = loadNodePositions();
  positions[id] = pos;
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

export function saveAllPositions(positions: Record<string, { x: number; y: number }>): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

// ─── CRUD: Branches ─────────────────────────────────────────────

export function addBranch(branch: Branch): void {
  const data = loadMindMapData();
  data.branches.push(branch);
  saveMindMapData(data);
}

export function updateBranch(id: string, updates: Partial<Branch>): void {
  const data = loadMindMapData();
  const idx = data.branches.findIndex((b) => b.id === id);
  if (idx !== -1) {
    data.branches[idx] = { ...data.branches[idx], ...updates };
    saveMindMapData(data);
  }
}

export function deleteBranch(id: string): void {
  const data = loadMindMapData();
  data.branches = data.branches.filter((b) => b.id !== id);
  // Also remove connections referencing this branch's nodes
  const branchNodeIds = new Set<string>();
  const branch = data.branches.find((b) => b.id === id);
  if (branch) {
    collectNodeIds(branch.nodes, branchNodeIds);
  }
  data.connections = data.connections.filter(
    (c) => !branchNodeIds.has(c.from) && !branchNodeIds.has(c.to)
  );
  saveMindMapData(data);
}

// ─── CRUD: Nodes ────────────────────────────────────────────────

export function addNode(branchId: string, node: MindNode): void {
  const data = loadMindMapData();
  const branch = data.branches.find((b) => b.id === branchId);
  if (branch) {
    branch.nodes.push(node);
    saveMindMapData(data);
  }
}

export function updateNode(
  branchId: string,
  nodeId: string,
  updates: Partial<MindNode>
): void {
  const data = loadMindMapData();
  const branch = data.branches.find((b) => b.id === branchId);
  if (!branch) return;
  const target = findNode(branch.nodes, nodeId);
  if (target) {
    Object.assign(target, updates);
    saveMindMapData(data);
  }
}

export function deleteNode(branchId: string, nodeId: string): void {
  const data = loadMindMapData();
  const branch = data.branches.find((b) => b.id === branchId);
  if (!branch) return;
  branch.nodes = removeNode(branch.nodes, nodeId);
  // Remove connections referencing this node
  data.connections = data.connections.filter(
    (c) => c.from !== nodeId && c.to !== nodeId
  );
  saveMindMapData(data);
}

export function addChildNode(
  branchId: string,
  parentId: string,
  child: MindNode
): void {
  const data = loadMindMapData();
  const branch = data.branches.find((b) => b.id === branchId);
  if (!branch) return;
  const parent = findNode(branch.nodes, parentId);
  if (parent) {
    if (!parent.children) parent.children = [];
    parent.children.push(child);
    saveMindMapData(data);
  }
}

// ─── CRUD: Connections ──────────────────────────────────────────

export function addConnection(connection: Connection): void {
  const data = loadMindMapData();
  data.connections.push(connection);
  saveMindMapData(data);
}

export function deleteConnection(from: string, to: string): void {
  const data = loadMindMapData();
  data.connections = data.connections.filter(
    (c) => !(c.from === from && c.to === to)
  );
  saveMindMapData(data);
}

// ─── CRUD: Timeline ─────────────────────────────────────────────

export function updateTimeline(timeline: TimelineItem[]): void {
  const data = loadMindMapData();
  data.timeline = timeline;
  saveMindMapData(data);
}

export function addTimelineItem(item: TimelineItem): void {
  const data = loadMindMapData();
  data.timeline.push(item);
  saveMindMapData(data);
}

// ─── Reset ──────────────────────────────────────────────────────

export function resetToDefaults(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(POSITIONS_KEY);
}

// ─── Helpers ────────────────────────────────────────────────────

function collectNodeIds(nodes: MindNode[], set: Set<string>): void {
  for (const n of nodes) {
    set.add(n.id);
    if (n.children) collectNodeIds(n.children, set);
  }
}

function findNode(nodes: MindNode[], id: string): MindNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function removeNode(nodes: MindNode[], id: string): MindNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => {
      if (n.children) {
        return { ...n, children: removeNode(n.children, id) };
      }
      return n;
    });
}

// ─── ID Generator ───────────────────────────────────────────────

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Status helpers ─────────────────────────────────────────────

export { STATUS };
export type { Status, Branch, MindNode, Connection, TimelineItem };
