// ═══════════════════════════════════════════════════════════════════
//  MindMapPage.tsx — Interactive Roadmap with Collapsible Levels
//  + Radial Layout + Collision Detection + DnD + CRUD + Zoom/Pan
//  + Mini-map + Search + PDF Export + Curved Lines
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  FlaskConical,
  Landmark,
  Factory,
  Target,
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowRight,
  Zap,
  Layers,
  Users,
  Building2,
  Sparkles,
  Rocket,
  CircleDot,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minus,
  FileDown,
  Search,
  X,
  Info,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadMindMapData,
  loadNodePositions,
  saveNodePosition,
  addBranch,
  updateBranch,
  deleteBranch,
  addNode,
  updateNode,
  deleteNode,
  addChildNode,
  resetToDefaults,
  generateId,
} from './mindMapStore';
import {
  STATUS,
  CENTER,
  UGT9_GOAL,
} from './mindMapData';
import type { Branch, MindNode, Status } from './mindMapData';
import { getPerformers, getCustomers } from '@/data/adminData';

// ─── Types ──────────────────────────────────────────────────────

interface SelectedNode {
  type: 'center' | 'branch' | 'node';
  data: Branch | MindNode | typeof CENTER;
  branch?: Branch;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  delay: number;
}

interface NodeInfo {
  id: string;
  label: string;
  type: 'center' | 'branch' | 'node' | 'child' | 'leaf';
  branchId?: string;
  parentId?: string;
  description?: string;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  level: number;
  branchId: string;
  parentId?: string;
  data: MindNode | Branch | typeof CENTER;
  color: string;
  hasChildren: boolean;
}

type ModalType = 'addBranch' | 'editBranch' | 'addNode' | 'editNode' | 'deleteConfirm' | null;

// ─── Icon Map ───────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  FlaskConical,
  Landmark,
  Factory,
  Target,
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowRight,
  Zap,
  Layers,
  Users,
  Building2,
  Sparkles,
  Rocket,
  CircleDot,
  ChevronRight,
  MapPin,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minus,
};

const PRESET_COLORS = ['#4A82FF', '#5B9BD5', '#A8D65A', '#FF7A2E', '#8B5CF6', '#06B6D4'];
const ICON_NAMES = Object.keys(ICON_MAP);

// ─── Layout Constants ───────────────────────────────────────────

const VB_W = 4200;
const VB_H = 4000;
const CX = 2100;
const CY = 2000;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.12;

// Only 3 levels ON the map: center, branch, sub-node
// Level 3+ (children) shown in detail panel only
// Sub-nodes are placed on an ARC (not a straight line) within the branch sector
const LEVEL_RADIUS = [0, 520, 1600, 0, 0];

// Branch config with angular sectors — each branch occupies its own 50° sector
interface BranchConfig {
  id: string;
  angle: number;
  sectorStart: number;
  sectorEnd: number;
  color: string;
}

const BRANCH_CONFIG: BranchConfig[] = [
  { id: 'ugt',          angle: -90,  sectorStart: -120, sectorEnd: -60,  color: '#8B5CF6' },
  { id: 'science',      angle: -30,  sectorStart: -60,  sectorEnd: 0,    color: '#4A82FF' },
  { id: 'gov',          angle: 30,   sectorStart: 0,    sectorEnd: 60,   color: '#5B9BD5' },
  { id: 'industry',     angle: 90,   sectorStart: 60,   sectorEnd: 120,  color: '#A8D65A' },
  { id: 'infra',        angle: 150,  sectorStart: 120,  sectorEnd: 180,  color: '#F59E0B' },
  { id: 'finance',      angle: -150, sectorStart: -180, sectorEnd: -120, color: '#EC4899' },
];

const BRANCH_BY_ID: Record<string, BranchConfig> = {};
BRANCH_CONFIG.forEach((b) => { BRANCH_BY_ID[b.id] = b; });

// ─── Layout Helper Functions ────────────────────────────────────

/** Convert degrees to radians */
function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Polar position from center */
function polarPosition(r: number, angleDeg: number): { x: number; y: number } {
  return {
    x: CX + r * Math.cos(toRad(angleDeg)),
    y: CY + r * Math.sin(toRad(angleDeg)),
  };
}

/** Distribute sub-nodes evenly within the branch sector */
function getSubNodeAngle(branchCfg: BranchConfig, index: number, total: number): number {
  const { sectorStart, sectorEnd } = branchCfg;
  if (total === 1) return branchCfg.angle;
  const step = (sectorEnd - sectorStart) / (total + 1);
  return sectorStart + step * (index + 1);
}

/** Distribute child nodes around parent angle, clamped to sector */

/** Leaf nodes — tight spread around parent, clamped to sector */



// ─── CSS Helpers ────────────────────────────────────────────────

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ');

function statusDot(status: Status) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: STATUS[status].color }}
    />
  );
}

function statusBadge(status: Status) {
  const cfg = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {statusDot(status)}
      {cfg.label}
    </span>
  );
}

/** Count nodes by status recursively */
function countStatuses(node: MindNode): Record<Status, number> {
  const counts: Record<Status, number> = { done: 0, progress: 0, todo: 0, planned: 0 };
  counts[node.status]++;
  node.children?.forEach((child) => {
    const childCounts = countStatuses(child);
    (Object.keys(childCounts) as Status[]).forEach((k) => {
      counts[k] += childCounts[k];
    });
  });
  return counts;
}

/** Animated counter */
function useAnimatedCounter(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return value;
}

// ─── StatCard Component ─────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1E293B] px-4 py-3"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-white leading-tight">{value}</div>
        <div className="text-xs text-[#94A3B8] truncate">{label}</div>
      </div>
    </motion.div>
  );
}

// ─── Straight Connection Line ───────────────────────────────────

function StraightConnection({
  x1,
  y1,
  x2,
  y2,
  color,
  dashed,
  delay = 0,
  strokeWidth = 1.5,
  opacity = 0.6,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dashed?: boolean;
  delay?: number;
  strokeWidth?: number;
  opacity?: number;
}) {
  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed ? '6,4' : undefined}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity }}
      transition={{ duration: 0.8, delay, ease: 'easeOut' }}
      style={{ strokeLinecap: 'round' }}
    />
  );
}

// ─── MiniMap Component ──────────────────────────────────────────

function MiniMap({
  layoutNodes,
  zoom,
  pan,
  viewportWidth,
  viewportHeight,
  onPan,
}: {
  layoutNodes: LayoutNode[];
  zoom: number;
  pan: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  onPan: (x: number, y: number) => void;
}) {
  const mmW = 150;
  const mmH = 100;
  const scaleX = mmW / VB_W;
  const scaleY = mmH / VB_H;
  const scale = Math.min(scaleX, scaleY);

  const visibleNodes = useMemo(() => {
    return layoutNodes.map((n) => ({
      x: n.x * scale,
      y: n.y * scale,
      color: n.color,
      level: n.level,
    }));
  }, [layoutNodes, scale]);

  const vpX = (-pan.x / zoom) * scale;
  const vpY = (-pan.y / zoom) * scale;
  const vpW = (viewportWidth / zoom) * scale;
  const vpH = (viewportHeight / zoom) * scale;

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const sx = (e.clientX - rect.left) / mmW;
      const sy = (e.clientY - rect.top) / mmH;
      const mapX = sx * VB_W;
      const mapY = sy * VB_H;
      onPan(mapX, mapY);
    },
    [onPan]
  );

  return (
    <svg
      width={mmW}
      height={mmH}
      className="absolute bottom-4 left-4 bg-[#0F172A]/90 rounded-lg shadow-lg border border-white/10 z-20 cursor-pointer"
      onClick={handleClick}
    >
      <rect width={mmW} height={mmH} rx={8} fill="#0F172A" opacity={0.95} />
      <line x1={0} y1={mmH / 2} x2={mmW} y2={mmH / 2} stroke="white" strokeOpacity={0.05} strokeWidth={0.5} />
      <line x1={mmW / 2} y1={0} x2={mmW / 2} y2={mmH} stroke="white" strokeOpacity={0.05} strokeWidth={0.5} />
      {visibleNodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.level === 0 ? 2.5 : n.level === 1 ? 2 : 1.2}
          fill={n.color}
          opacity={0.85}
        />
      ))}
      <rect
        x={Math.max(0, vpX)}
        y={Math.max(0, vpY)}
        width={Math.min(mmW - Math.max(0, vpX), vpW)}
        height={Math.min(mmH - Math.max(0, vpY), vpH)}
        fill="none"
        stroke="#4A82FF"
        strokeWidth={1.5}
        rx={2}
        opacity={0.8}
      />
    </svg>
  );
}

// ─── Tooltip Component ──────────────────────────────────────────

function Tooltip({
  x,
  y,
  label,
  description,
  status,
}: {
  x: number;
  y: number;
  label: string;
  description?: string;
  status?: Status;
}) {
  return (
    <div
      className="fixed z-50 pointer-events-none bg-[#1E293B] text-white px-3 py-2 rounded-lg shadow-xl border border-white/10"
      style={{ left: x + 12, top: y + 12, maxWidth: 240 }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {status && (
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS[status].color }}
          />
        )}
        <span className="text-xs font-semibold truncate">{label}</span>
      </div>
      {description && (
        <p className="text-[10px] text-[#94A3B8] leading-relaxed">{description}</p>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function MindMapPage() {
  // ── Data state (loaded from localStorage) ──
  const [data, setData] = useState(() => loadMindMapData());
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>(
    loadNodePositions
  );
  const [selected, setSelected] = useState<SelectedNode>({
    type: 'center',
    data: CENTER,
  });
  // Default: ONLY center + branches visible (level 0-1)
  // All branches expanded by default
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(BRANCH_CONFIG.map(b => b.id)));
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // ── Zoom / Pan state ──
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenNode, setFullscreenNode] = useState<SelectedNode | null>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // ── Tooltip state ──
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    description?: string;
    status?: Status;
  } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // ── Modal state ──
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalData, setModalData] = useState<{
    branchId?: string;
    nodeId?: string;
    node?: MindNode;
    branch?: Branch;
  }>({});

  // ── Form state ──
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formIcon, setFormIcon] = useState(ICON_NAMES[0]);
  const [formStatus, setFormStatus] = useState<Status>('todo');
  const [formActions, setFormActions] = useState('');

  // ── Container ref for viewport sizing ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });

  // ── DnD refs ──
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Refresh data helper ──
  const refreshData = useCallback(() => {
    setData(loadMindMapData());
  }, []);

  const { branches, timeline } = data;

  // ── Viewport size tracking ──
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewportSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ── Dynamic stats from admin data ──
  const stats = useMemo(() => {
    const performers = getPerformers();
    const customers = getCustomers();
    const avgUGT =
      performers.length > 0
        ? (
            performers.reduce((s, p) => s + (p.currentUGT || 0), 0) /
            performers.length
          ).toFixed(1)
        : '0.0';
    const activeProjects =
      performers.filter((p) => p.status === 'Активный').length +
      customers.filter((c) => c.status === 'Активный').length;
    return { performerCount: performers.length, customerCount: customers.length, avgUGT, activeProjects };
  }, []);

  const animPerformers = useAnimatedCounter(stats.performerCount);
  const animCustomers = useAnimatedCounter(stats.customerCount);
  const animProjects = useAnimatedCounter(stats.activeProjects);

  // ── Flat node list for search ──
  const allNodes = useMemo(() => {
    const results: NodeInfo[] = [];
    results.push({ id: 'center', label: 'Центр', type: 'center', description: CENTER.subtitle });
    branches.forEach((b) => {
      results.push({ id: b.id, label: b.label, type: 'branch', description: b.description });
      b.nodes.forEach((n) => {
        results.push({
          id: n.id,
          label: n.label,
          type: 'node',
          branchId: b.id,
          description: n.description,
        });
        n.children?.forEach((c) => {
          results.push({
            id: c.id,
            label: c.label,
            type: 'child',
            branchId: b.id,
            parentId: n.id,
            description: c.description,
          });
          c.children?.forEach((leaf) => {
            results.push({
              id: leaf.id,
              label: leaf.label,
              type: 'leaf',
              branchId: b.id,
              parentId: c.id,
              description: leaf.description,
            });
          });
        });
      });
    });
    return results;
  }, [branches]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allNodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 10);
  }, [searchQuery, allNodes]);

  // ── COMPUTE VISIBLE LAYOUT — SECTOR-BASED (扇形) ──
  const layoutNodes = useMemo((): LayoutNode[] => {
    const nodes: LayoutNode[] = [];

    // Level 0: Center
    nodes.push({
      id: 'center',
      x: CX,
      y: CY,
      level: 0,
      branchId: 'center',
      data: CENTER,
      color: '#2E5BFF',
      hasChildren: false,
    });

    // Level 1: Branches
    branches.forEach((branch) => {
      const bcfg = BRANCH_BY_ID[branch.id];
      if (!bcfg) return;
      const saved = savedPositions[branch.id];
      const bx = saved ? saved.x : CX + LEVEL_RADIUS[1] * Math.cos(toRad(bcfg.angle));
      const by = saved ? saved.y : CY + LEVEL_RADIUS[1] * Math.sin(toRad(bcfg.angle));

      nodes.push({
        id: branch.id,
        x: bx,
        y: by,
        level: 1,
        branchId: branch.id,
        data: branch,
        color: branch.color,
        hasChildren: branch.nodes.length > 0,
      });

      // Level 2: Sub-nodes (only if branch expanded)
      if (expandedBranches.has(branch.id)) {
        branch.nodes.forEach((node, ni) => {
          const savedN = savedPositions[node.id];
          let nx: number, ny: number;
          if (savedN) {
            nx = savedN.x;
            ny = savedN.y;
          } else {
            const angle = getSubNodeAngle(bcfg, ni, branch.nodes.length);
            const pos = polarPosition(LEVEL_RADIUS[2], angle);
            nx = pos.x;
            ny = pos.y;
          }

          nodes.push({
            id: node.id,
            x: nx,
            y: ny,
            level: 2,
            branchId: branch.id,
            parentId: branch.id,
            data: node,
            color: branch.color,
            hasChildren: (node.children?.length ?? 0) > 0,
          });

          // Level 3+ (children/leaves) are NOT rendered on the map
          // They are shown in the detail panel when this node is selected
          // This prevents overlap between different branches
        });
      }
    });

    return nodes;
  }, [branches, expandedBranches, expandedNodes, savedPositions]);

  // ── Find a layout node by id ──
  const findLayoutNode = useCallback(
    (id: string): LayoutNode | undefined => {
      return layoutNodes.find((n) => n.id === id);
    },
    [layoutNodes]
  );

  // ── Focus on node (pan + zoom) ──
  const focusOnNode = useCallback(
    (nodeId: string) => {
      const ln = findLayoutNode(nodeId);
      if (ln) {
        setZoom(1.2);
        setPan({
          x: CX - ln.x * 1.2,
          y: CY - ln.y * 1.2,
        });
      } else if (nodeId === 'center') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
      setSearchQuery('');
    },
    [findLayoutNode]
  );

  // ── Mini-map pan handler ──
  const handleMiniMapPan = useCallback(
    (mapX: number, mapY: number) => {
      setZoom(1);
      setPan({
        x: CX - mapX,
        y: CY - mapY,
      });
    },
    []
  );

  // ── Tooltip handlers ──
  const showTooltip = useCallback(
    (clientX: number, clientY: number, label: string, description?: string, status?: Status) => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = setTimeout(() => {
        setTooltip({ x: clientX, y: clientY, label, description, status });
      }, 300);
    },
    []
  );

  const hideTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltip(null);
  }, []);

  // ── Breadcrumb path ──
  const breadcrumb = useMemo(() => {
    const path: { label: string; nodeId: string; type: string }[] = [
      { label: 'Центр', nodeId: 'center', type: 'center' },
    ];
    if (selected.type === 'center') return path;
    if (selected.type === 'branch') {
      const b = selected.data as Branch;
      path.push({ label: b.label, nodeId: b.id, type: 'branch' });
      return path;
    }
    if (selected.type === 'node') {
      const n = selected.data as MindNode;
      const branch = selected.branch;
      if (branch) path.push({ label: branch.label, nodeId: branch.id, type: 'branch' });
      if (branch && branch.nodes.find((bn) => bn.id === n.id)) {
        path.push({ label: n.label, nodeId: n.id, type: 'node' });
        return path;
      }
      for (const bn of branch?.nodes || []) {
        if (bn.children?.find((c) => c.id === n.id)) {
          path.push({ label: bn.label, nodeId: bn.id, type: 'node' });
          path.push({ label: n.label, nodeId: n.id, type: 'child' });
          return path;
        }
        for (const c of bn.children || []) {
          if (c.children?.find((l) => l.id === n.id)) {
            path.push({ label: bn.label, nodeId: bn.id, type: 'node' });
            path.push({ label: c.label, nodeId: c.id, type: 'child' });
            path.push({ label: n.label, nodeId: n.id, type: 'leaf' });
            return path;
          }
        }
      }
      path.push({ label: n.label, nodeId: n.id, type: 'node' });
    }
    return path;
  }, [selected]);

  // ── Toggle helpers ──
  const toggleBranch = useCallback((branchId: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // ── Initial fit-to-view on load ──
  const initialPanSetRef = useRef(false);
  useEffect(() => {
    if (!initialPanSetRef.current && viewportSize.width > 0 && viewportSize.height > 0) {
      initialPanSetRef.current = true;
      // Fit entire viewBox into the container with 5% margin
      const fitZ = Math.min(
        (viewportSize.width * 0.95) / VB_W,
        (viewportSize.height * 0.95) / VB_H
      );
      const z = Math.max(0.15, Math.min(fitZ, 1.5));
      setZoom(z);
      // pan = 0 — content centered by preserveAspectRatio="xMidYMid meet"
      setPan({ x: 0, y: 0 });
    }
  }, [viewportSize.width, viewportSize.height]);

  // ── SVG Coordinate Helper (used by zoom/pan and DnD) ──
  const getSVGPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  // ── Zoom / Pan Handlers (all in SVG units via getSVGPoint) ──

  // Clamp pan so content stays within viewBox bounds
  const clampPan = useCallback(
    (p: { x: number; y: number }, z: number) => {
      if (z <= 1) return { x: 0, y: 0 };
      const minX = -VB_W * (1 - 1 / z);
      const minY = -VB_H * (1 - 1 / z);
      return {
        x: Math.max(minX, Math.min(0, p.x)),
        y: Math.max(minY, Math.min(0, p.y)),
      };
    },
    []
  );

  const handleZoomIn = useCallback(() => {
    setZoom((prevZoom) => {
      const newZoom = Math.min(prevZoom + ZOOM_STEP, ZOOM_MAX);
      // Zoom about viewport center
      const svgCenter = getSVGPoint(viewportSize.width / 2, viewportSize.height / 2);
      const ratio = newZoom / prevZoom;
      setPan((prevPan) => ({
        x: svgCenter.x - (svgCenter.x - prevPan.x) * ratio,
        y: svgCenter.y - (svgCenter.y - prevPan.y) * ratio,
      }));
      return newZoom;
    });
  }, [viewportSize, getSVGPoint]);

  const handleZoomOut = useCallback(() => {
    setZoom((prevZoom) => {
      const newZoom = Math.max(prevZoom - ZOOM_STEP, ZOOM_MIN);
      const svgCenter = getSVGPoint(viewportSize.width / 2, viewportSize.height / 2);
      const ratio = newZoom / prevZoom;
      setPan((prevPan) => ({
        x: svgCenter.x - (svgCenter.x - prevPan.x) * ratio,
        y: svgCenter.y - (svgCenter.y - prevPan.y) * ratio,
      }));
      return newZoom;
    });
  }, [viewportSize, getSVGPoint]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleFitToView = useCallback(() => {
    // Fit the content diameter (~3600px) into viewport with 15% margin
    const fitZoom = Math.min(
      (viewportSize.width * 0.85) / VB_W,
      (viewportSize.height * 0.85) / VB_H
    );
    const z = Math.max(fitZoom, 0.12);
    setZoom(z);
    setPan({ x: CX * (1 - z), y: CY * (1 - z) });
  }, [viewportSize]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const svgP = getSVGPoint(e.clientX, e.clientY);
      setZoom((prevZoom) => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prevZoom + delta));
        const ratio = newZoom / prevZoom;
        setPan((prevPan) => ({
          x: svgP.x - (svgP.x - prevPan.x) * ratio,
          y: svgP.y - (svgP.y - prevPan.y) * ratio,
        }));
        return newZoom;
      });
    },
    [getSVGPoint]
  );

  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (draggingRef.current) return;
      const target = e.target as Element;
      if (target.tagName === 'rect' || target.tagName === 'circle' || target.closest('foreignObject'))
        return;
      setIsPanning(true);
      const svgP = getSVGPoint(e.clientX, e.clientY);
      panStartRef.current = { x: svgP.x - pan.x, y: svgP.y - pan.y };
    },
    [pan, getSVGPoint]
  );

  const handlePanMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const svgP = getSVGPoint(e.clientX, e.clientY);
      const newPan = {
        x: svgP.x - panStartRef.current.x,
        y: svgP.y - panStartRef.current.y,
      };
      setPan(clampPan(newPan, zoomRef.current));
    },
    [isPanning, getSVGPoint, clampPan]
  );

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── Fullscreen toggle ──
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Show popup when node selected in fullscreen
  useEffect(() => {
    if (isFullscreen && selected.type !== 'center') {
      setFullscreenNode(selected);
    }
  }, [selected, isFullscreen]);

  // ── PDF Export ──
  const exportToPDF = useCallback(async () => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const originalZoom = zoom;
    const originalPan = pan;
    setZoom(1);
    setPan({ x: 0, y: 0 });

    await new Promise((r) => setTimeout(r, 300));

    try {
      const canvas = await html2canvas(svgElement.parentElement!, {
        backgroundColor: '#0F172A',
        scale: 2,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);
      pdf.save('mind-map.pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
    }

    setZoom(originalZoom);
    setPan(originalPan);
  }, [zoom, pan]);

  // ── DnD Handlers ──
  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent, nodeId: string) => {
      e.preventDefault?.();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const svgP = getSVGPoint(clientX, clientY);
      const ln = findLayoutNode(nodeId);
      dragOffsetRef.current = {
        x: ln ? svgP.x - ln.x : 0,
        y: ln ? svgP.y - ln.y : 0,
      };
      draggingRef.current = nodeId;
    },
    [getSVGPoint, findLayoutNode]
  );

  const handleDragMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault?.();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const svgP = getSVGPoint(clientX, clientY);
      const newPos = {
        x: svgP.x - dragOffsetRef.current.x,
        y: svgP.y - dragOffsetRef.current.y,
      };
      setSavedPositions((prev) => ({ ...prev, [draggingRef.current!]: newPos }));
    },
    [getSVGPoint]
  );

  const handleDragEnd = useCallback(() => {
    if (draggingRef.current) {
      const pos = savedPositions[draggingRef.current];
      if (pos) saveNodePosition(draggingRef.current, pos);
      draggingRef.current = null;
    }
  }, [savedPositions]);

  // ── Count status summary for a branch ──
  const getBranchStatusCounts = useCallback((branch: Branch) => {
    const counts: Record<Status, number> = { done: 0, progress: 0, todo: 0, planned: 0 };
    branch.nodes.forEach((node) => {
      const nc = countStatuses(node);
      (Object.keys(nc) as Status[]).forEach((k) => {
        counts[k] += nc[k];
      });
    });
    return counts;
  }, []);

  // ── Find position for cross-connections ──

  // ── Modal helpers ──
  const openAddBranch = () => {
    setFormName('');
    setFormDescription('');
    setFormColor(PRESET_COLORS[0]);
    setFormIcon('FlaskConical');
    setModalType('addBranch');
    setModalData({});
  };

  const openEditBranch = (branch: Branch) => {
    setFormName(branch.label);
    setFormDescription(branch.description);
    setFormColor(branch.color);
    setFormIcon(branch.icon);
    setModalType('editBranch');
    setModalData({ branchId: branch.id, branch });
  };

  const openAddNode = (branchId: string, parentId?: string) => {
    setFormName('');
    setFormDescription('');
    setFormStatus('todo');
    setFormActions('');
    setModalType('addNode');
    setModalData({ branchId, nodeId: parentId });
  };

  const openEditNode = (branchId: string, node: MindNode) => {
    setFormName(node.label);
    setFormDescription(node.description || '');
    setFormStatus(node.status);
    setFormActions(node.actions?.join(', ') || '');
    setModalType('editNode');
    setModalData({ branchId, nodeId: node.id, node });
  };

  const openDeleteConfirm = (branchId: string, nodeId?: string) => {
    setModalType('deleteConfirm');
    setModalData({ branchId, nodeId });
  };

  const handleSaveBranch = () => {
    if (!formName.trim()) return;
    if (modalType === 'addBranch') {
      const angles = [-90, -30, 30, 90, 150, -150];
      const newAngle = angles[branches.length % angles.length];
      const newBranch: Branch = {
        id: generateId('branch'),
        label: formName.trim(),
        description: formDescription.trim(),
        color: formColor,
        icon: formIcon,
        angle: newAngle,
        nodes: [],
      };
      addBranch(newBranch);
      setExpandedBranches((prev) => new Set([...prev, newBranch.id]));
    } else if (modalType === 'editBranch' && modalData.branchId) {
      updateBranch(modalData.branchId, {
        label: formName.trim(),
        description: formDescription.trim(),
        color: formColor,
        icon: formIcon,
      });
    }
    refreshData();
    setModalType(null);
  };

  const handleSaveNode = () => {
    if (!formName.trim() || !modalData.branchId) return;
    const actions = formActions
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (modalType === 'addNode') {
      const newNode: MindNode = {
        id: generateId('node'),
        label: formName.trim(),
        description: formDescription.trim() || undefined,
        status: formStatus,
        actions: actions.length > 0 ? actions : undefined,
      };
      if (modalData.nodeId) {
        addChildNode(modalData.branchId, modalData.nodeId, newNode);
        setExpandedNodes((prev) => new Set([...prev, modalData.nodeId!]));
      } else {
        addNode(modalData.branchId, newNode);
      }
    } else if (modalType === 'editNode' && modalData.nodeId) {
      updateNode(modalData.branchId, modalData.nodeId, {
        label: formName.trim(),
        description: formDescription.trim() || undefined,
        status: formStatus,
        actions: actions.length > 0 ? actions : undefined,
      });
    }
    refreshData();
    setModalType(null);
  };

  const handleDelete = () => {
    if (!modalData.branchId) return;
    if (modalData.nodeId) {
      deleteNode(modalData.branchId, modalData.nodeId);
    } else {
      deleteBranch(modalData.branchId);
    }
    refreshData();
    setSelected({ type: 'center', data: CENTER });
    setModalType(null);
  };

  const handleReset = () => {
    if (
      window.confirm('Сбросить все данные к значениям по умолчанию? Все изменения будут потеряны.')
    ) {
      resetToDefaults();
      setSavedPositions({});
      refreshData();
      setSelected({ type: 'center', data: CENTER });
      setExpandedBranches(new Set());
      setExpandedNodes(new Set());
    }
  };

  // ── Get mind node data from branch by id ──
  const findMindNode = useCallback(
    (nodeId: string): { node: MindNode; branch: Branch } | null => {
      for (const b of branches) {
        const search = (nodes: MindNode[]): MindNode | null => {
          for (const n of nodes) {
            if (n.id === nodeId) return n;
            if (n.children) {
              const found = search(n.children);
              if (found) return found;
            }
          }
          return null;
        };
        const found = search(b.nodes);
        if (found) return { node: found, branch: b };
      }
      return null;
    },
    [branches]
  );

  // ── Render ──
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-72px)] bg-[#0F172A]">
      {/* ── Title Bar with Search ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={18} className="text-[#2E5BFF] flex-shrink-0" />
          <h1 className="text-lg font-bold text-white truncate">Дорожная карта проекта</h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-[#94A3B8] ml-2">
            <ChevronRight size={12} />
            Центр технологического развития Удмуртии — 100 концептов
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search */}
          <div className="relative mr-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  const result = searchResults[0];
                  // Expand parents to make node visible
                  if (result.branchId) {
                    setExpandedBranches((prev) => new Set([...prev, result.branchId!]));
                  }
                  if (result.parentId) {
                    setExpandedNodes((prev) => new Set([...prev, result.parentId!]));
                    // Check if parent has a parent (for level 4 nodes)
                    const found = findMindNode(result.id);
                    if (found) {
                      // Find the grandparent
                      for (const b of branches) {
                        for (const n of b.nodes) {
                          if (n.children?.some((c) => c.id === result.parentId)) {
                            setExpandedBranches((prev) => new Set([...prev, b.id]));
                            setExpandedNodes((prev) => new Set([...prev, n.id, result.parentId!]));
                          }
                        }
                      }
                    }
                  }
                  focusOnNode(result.id);
                  setSearchQuery('');
                }
              }}
              placeholder="Поиск..."
              className="w-48 sm:w-56 h-8 pl-8 pr-7 rounded-lg bg-[#1E293B] border border-white/10 text-white text-xs placeholder-[#64748B] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30"
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
            {/* Search results dropdown */}
            {searchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1E293B] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    className="w-full text-left px-3 py-2 text-xs text-[#CBD5E1] hover:bg-white/5 transition-colors flex items-center gap-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (result.branchId) {
                        setExpandedBranches((prev) => new Set([...prev, result.branchId!]));
                      }
                      if (result.parentId) {
                        setExpandedNodes((prev) => new Set([...prev, result.parentId!]));
                        const found = findMindNode(result.id);
                        if (found) {
                          for (const b of branches) {
                            for (const n of b.nodes) {
                              if (n.children?.some((c) => c.id === result.parentId)) {
                                setExpandedBranches((prev) => new Set([...prev, b.id]));
                                setExpandedNodes((prev) => new Set([...prev, n.id, result.parentId!]));
                              }
                            }
                          }
                        }
                      }
                      focusOnNode(result.id);
                      setSearchQuery('');
                    }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          result.type === 'center'
                            ? '#4A82FF'
                            : result.type === 'branch'
                              ? branches.find((b) => b.id === result.id)?.color || '#94A3B8'
                              : result.type === 'node'
                                ? branches.find((b) => b.id === result.branchId)?.color || '#94A3B8'
                                : '#94A3B8',
                      }}
                    />
                    <span className="truncate">{result.label}</span>
                    <span className="text-[#64748B] text-[10px] ml-auto flex-shrink-0">
                      {result.type === 'center'
                        ? 'Центр'
                        : result.type === 'branch'
                          ? 'Ветвь'
                          : result.type === 'node'
                            ? 'Узел'
                            : result.type === 'child'
                              ? 'Дочерний'
                              : 'Лист'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={exportToPDF}
            className="text-[#94A3B8] hover:text-white hover:bg-white/5 h-8 px-2"
            title="Экспорт PDF"
          >
            <FileDown size={14} className="mr-1" />
            <span className="hidden sm:inline text-xs">Экспорт PDF</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-[#94A3B8] hover:text-white hover:bg-white/5 h-8 px-2"
            title="Сбросить к дефолтам"
          >
            <RotateCcw size={14} className="mr-1" />
            <span className="hidden sm:inline text-xs">Сбросить</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openAddBranch}
            className="border-[#2E5BFF]/30 text-[#4A82FF] hover:bg-[#2E5BFF]/10 h-8 px-2"
          >
            <Plus size={14} className="mr-1" />
            <span className="text-xs">Ветка</span>
          </Button>
          <Sparkles size={14} className="text-[#FF7A2E] ml-1" />
        </div>
      </div>

      {/* ── Branch Quick-jump Pills ── */}
      <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2 border-b border-white/5 overflow-x-auto">
        <button
          onClick={() => focusOnNode('center')}
          className={cx(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors flex-shrink-0',
            selected.type === 'center'
              ? 'bg-[#2E5BFF]/20 text-[#4A82FF] ring-1 ring-[#2E5BFF]/40'
              : 'bg-[#1E293B] text-[#94A3B8] hover:bg-white/5'
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#4A82FF]" />
          Центр
        </button>
        {branches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => {
              setExpandedBranches((prev) => new Set([...prev, branch.id]));
              focusOnNode(branch.id);
              setSelected({ type: 'branch', data: branch, branch });
            }}
            className={cx(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors flex-shrink-0',
              selected.type === 'branch' && (selected.data as Branch).id === branch.id
                ? 'ring-1'
                : 'bg-[#1E293B] text-[#94A3B8] hover:bg-white/5'
            )}
            style={
              selected.type === 'branch' && (selected.data as Branch).id === branch.id
                ? { backgroundColor: `${branch.color}20`, color: branch.color }
                : {}
            }
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: branch.color }} />
            {branch.label}
          </button>
        ))}
      </div>

      {/* ── Breadcrumb Trail ── */}
      <div className="flex items-center gap-1 px-4 sm:px-6 py-1.5 border-b border-white/5 overflow-x-auto">
        {breadcrumb.map((crumb, i) => (
          <div key={crumb.nodeId} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <ChevronRight size={10} className="text-[#475569] flex-shrink-0" />}
            <button
              onClick={() => {
                if (crumb.type === 'center') {
                  setSelected({ type: 'center', data: CENTER });
                  focusOnNode('center');
                } else if (crumb.type === 'branch') {
                  const b = branches.find((br) => br.id === crumb.nodeId);
                  if (b) {
                    setExpandedBranches((prev) => new Set([...prev, b.id]));
                    setSelected({ type: 'branch', data: b, branch: b });
                    focusOnNode(b.id);
                  }
                } else {
                  for (const b of branches) {
                    const searchNode = (nodes: MindNode[]): MindNode | null => {
                      for (const n of nodes) {
                        if (n.id === crumb.nodeId) return n;
                        if (n.children) {
                          const found = searchNode(n.children);
                          if (found) return found;
                        }
                      }
                      return null;
                    };
                    const found = searchNode(b.nodes);
                    if (found) {
                      setExpandedBranches((prev) => new Set([...prev, b.id]));
                      for (const bn of b.nodes) {
                        if (
                          bn.children?.find(
                            (c) => c.id === crumb.nodeId || c.children?.find((l) => l.id === crumb.nodeId)
                          )
                        ) {
                          setExpandedNodes((prev) => new Set([...prev, bn.id]));
                        }
                        if (bn.children) {
                          for (const c of bn.children) {
                            if (c.children?.find((l) => l.id === crumb.nodeId)) {
                              setExpandedNodes((prev) => new Set([...prev, bn.id, c.id]));
                            }
                          }
                        }
                      }
                      setSelected({ type: 'node', data: found, branch: b });
                      focusOnNode(crumb.nodeId);
                      break;
                    }
                  }
                }
              }}
              className={cx(
                'text-[10px] transition-colors hover:underline',
                i === breadcrumb.length - 1 ? 'text-white font-medium' : 'text-[#94A3B8] hover:text-white'
              )}
            >
              {crumb.label}
            </button>
          </div>
        ))}
      </div>

      {/* ── Dynamic Stats Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-4 sm:px-6 py-3 border-b border-white/5">
        <StatCard label="Исполнителей" value={animPerformers} icon={Users} color="#4A82FF" delay={0} />
        <StatCard label="Заказчиков" value={animCustomers} icon={Building2} color="#5B9BD5" delay={0.1} />
        <StatCard label="Средний УГТ" value={stats.avgUGT} icon={TrendingUp} color="#A8D65A" delay={0.2} />
        <StatCard label="Активных проектов" value={animProjects} icon={Zap} color="#FF7A2E" delay={0.3} />
      </div>

      {/* ── Main Content: Map + Detail Panel ── */}
      <div className="flex flex-1 min-h-0">
        {/* SVG Connection Map */}
        <div className="flex-1 relative overflow-hidden" ref={containerRef}>
          {/* Zoom Controls — bottom-right corner */}
          <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
            <button
              onClick={handleZoomIn}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E293B]/90 border border-white/10 text-white hover:bg-[#2E5BFF] transition-colors"
              title="Увеличить"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E293B]/90 border border-white/10 text-white hover:bg-[#2E5BFF] transition-colors"
              title="Уменьшить"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleZoomReset}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E293B]/90 border border-white/10 text-white hover:bg-[#2E5BFF] transition-colors"
              title="Сбросить масштаб"
            >
              <Maximize size={16} />
            </button>
            <button
              onClick={handleFitToView}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E293B]/90 border border-white/10 text-white hover:bg-[#2E5BFF] transition-colors"
              title="По размеру экрана"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2E5BFF]/90 border border-[#2E5BFF]/30 text-white hover:bg-[#2E5BFF] transition-colors"
              title={isFullscreen ? 'Выйти из полноэкранного' : 'На весь экран'}
            >
              <Maximize2 size={16} />
            </button>
            <div className="text-center text-[9px] text-[#94A3B8] mt-0.5">{Math.round(zoom * 100)}%</div>
          </div>

          {/* Mini-map */}
          <MiniMap
            layoutNodes={layoutNodes}
            zoom={zoom}
            pan={pan}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
            onPan={handleMiniMapPan}
          />

          {/* Tooltip */}
          {tooltip && (
            <Tooltip
              x={tooltip.x}
              y={tooltip.y}
              label={tooltip.label}
              description={tooltip.description}
              status={tooltip.status}
            />
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full min-h-[500px] select-none"
            overflow="visible"
            style={{ background: '#0F172A', cursor: isPanning ? 'grabbing' : 'grab' }}
            onMouseUp={() => {
              handleDragEnd();
              handlePanEnd();
            }}
            onMouseLeave={() => {
              handleDragEnd();
              handlePanEnd();
              hideTooltip();
            }}
            onTouchEnd={handleDragEnd}
            onMouseDown={handlePanStart}
            onMouseMove={(e) => {
              handleDragMove(e);
              handlePanMove(e);
            }}
            onWheel={handleWheel}
          >
            <defs>
              <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4A82FF" />
                <stop offset="100%" stopColor="#2E5BFF" />
              </radialGradient>
              <radialGradient id="pulseGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2E5BFF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#2E5BFF" stopOpacity="0" />
              </radialGradient>
              {branches.map((b) => (
                <radialGradient key={b.id} id={`grad-${b.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={b.color} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={b.color} stopOpacity="0.4" />
                </radialGradient>
              ))}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Zoom/Pan transform group */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* ── Cross-branch connections removed ── */}

              {/* ── Straight connection lines ── */}
              {/* Center to branches */}
              {branches.map((branch, i) => {
                const branchLn = layoutNodes.find((n) => n.id === branch.id);
                if (!branchLn) return null;
                return (
                  <StraightConnection
                    key={`center-${branch.id}`}
                    x1={CX}
                    y1={CY}
                    x2={branchLn.x}
                    y2={branchLn.y}
                    color={branch.color}
                    delay={0.1 + i * 0.08}
                    strokeWidth={2.5}
                    opacity={0.5}
                  />
                );
              })}

              {/* Branch to sub-nodes (level 2) */}
              {branches.map((branch) => {
                if (!expandedBranches.has(branch.id)) return null;
                const branchLn = layoutNodes.find((n) => n.id === branch.id);
                if (!branchLn) return null;
                return branch.nodes.map((node, ni) => {
                  const nodeLn = layoutNodes.find((n) => n.id === node.id);
                  if (!nodeLn) return null;
                  return (
                    <StraightConnection
                      key={`${branch.id}-${node.id}`}
                      x1={branchLn.x}
                      y1={branchLn.y}
                      x2={nodeLn.x}
                      y2={nodeLn.y}
                      color={branch.color}
                      delay={0.3 + ni * 0.04}
                      strokeWidth={2}
                      opacity={0.45}
                    />
                  );
                });
              })}

              {/* Level 3+ connections removed — children shown in detail panel only */}

              {/* ── Center Pulse Animation ── */}
              <motion.circle
                cx={CX}
                cy={CY}
                r={62}
                fill="url(#pulseGrad)"
                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{ originX: `${CX}px`, originY: `${CY}px` }}
              />

              {/* ── Center Node ── */}
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected({ type: 'center', data: CENTER })}
                onMouseEnter={(e) => showTooltip(e.clientX, e.clientY, 'Центр', CENTER.subtitle)}
                onMouseLeave={hideTooltip}
              >
                <circle cx={CX} cy={CY} r={46} fill="url(#centerGrad)" filter="url(#glow)" />
                <text x={CX} y={CY - 6} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">
                  Центр
                </text>
                <text x={CX} y={CY + 7} textAnchor="middle" fill="white" fontSize="8" opacity="0.9">
                  УГТ 9
                </text>
                <Rocket x={CX - 7} y={CY + 12} size={14} color="white" opacity={0.8} />
              </motion.g>

              {/* ── Branch Nodes (Level 1) ── */}
              {branches.map((branch, bi) => {
                const branchLn = layoutNodes.find((n) => n.id === branch.id);
                if (!branchLn) return null;
                const isExpanded = expandedBranches.has(branch.id);
                const IconComp = ICON_MAP[branch.icon] || Layers;
                const isHovered = hoveredNode === branch.id;
                return (
                  <motion.g
                    key={branch.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 + bi * 0.08 }}
                    onMouseEnter={(e) => {
                      setHoveredNode(branch.id);
                      showTooltip(e.clientX, e.clientY, branch.label, branch.description);
                    }}
                    onMouseLeave={() => {
                      setHoveredNode(null);
                      hideTooltip();
                    }}
                  >
                    {/* Branch circle */}
                    <circle
                      cx={branchLn.x}
                      cy={branchLn.y}
                      r={30}
                      fill={`url(#grad-${branch.id})`}
                      stroke={branch.color}
                      strokeWidth={2}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        toggleBranch(branch.id);
                        setSelected({ type: 'branch', data: branch, branch });
                      }}
                      filter="url(#glow)"
                    />
                    {/* Icon */}
                    <foreignObject x={branchLn.x - 10} y={branchLn.y - 10} width={20} height={20}>
                      <div className="flex items-center justify-center h-full">
                        <IconComp size={15} color="white" />
                      </div>
                    </foreignObject>
                    {/* Label */}
                    <text
                      x={branchLn.x}
                      y={branchLn.y + 48}
                      textAnchor="middle"
                      fill={branch.color}
                      fontSize="11"
                      fontWeight="600"
                    >
                      {branch.label}
                    </text>
                    {/* Node count badge */}
                    <foreignObject
                      x={branchLn.x + 20}
                      y={branchLn.y - 40}
                      width={80}
                      height={20}
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-[8px] font-bold text-white px-1.5 py-0.5"
                        style={{ backgroundColor: branch.color }}
                      >
                        {branch.nodes.length} направлений
                      </div>
                    </foreignObject>
                    {/* Expand/collapse indicator */}
                    {branch.nodes.length > 0 && (
                      <g
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBranch(branch.id);
                        }}
                      >
                        <circle
                          cx={branchLn.x}
                          cy={branchLn.y + 22}
                          r={8}
                          fill="#0F172A"
                          stroke={branch.color}
                          strokeWidth={1.5}
                        />
                        <foreignObject
                          x={branchLn.x - 5}
                          y={branchLn.y + 17}
                          width={10}
                          height={10}
                        >
                          <div className="flex items-center justify-center h-full">
                            {isExpanded ? (
                              <ChevronDown size={8} color={branch.color} />
                            ) : (
                              <ChevronUp size={8} color={branch.color} />
                            )}
                          </div>
                        </foreignObject>
                      </g>
                    )}
                    {/* Edit/Delete buttons on hover */}
                    {isHovered && (
                      <>
                        <foreignObject x={branchLn.x - 44} y={branchLn.y - 10} width={16} height={16}>
                          <button
                            className="flex items-center justify-center w-full h-full rounded-full bg-[#1E293B]/80 text-[#94A3B8] hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditBranch(branch);
                            }}
                          >
                            <Pencil size={8} />
                          </button>
                        </foreignObject>
                        <foreignObject x={branchLn.x - 44} y={branchLn.y + 4} width={16} height={16}>
                          <button
                            className="flex items-center justify-center w-full h-full rounded-full bg-[#1E293B]/80 text-[#94A3B8] hover:text-[#EF4444]"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteConfirm(branch.id);
                            }}
                          >
                            <Trash2 size={9} />
                          </button>
                        </foreignObject>
                      </>
                    )}
                  </motion.g>
                );
              })}

              {/* ── Sub-nodes (Level 2) ── */}
              {branches.map((branch) => {
                if (!expandedBranches.has(branch.id)) return null;
                return branch.nodes.map((node, ni) => {
                  const nodeLn = layoutNodes.find((n) => n.id === node.id);
                  if (!nodeLn) return null;
                  const hasChildren = (node.children?.length ?? 0) > 0;
                  const isHovered = hoveredNode === node.id;
                  const isSelected =
                    selected.type === 'node' && (selected.data as MindNode).id === node.id;

                  return (
                    <motion.g
                      key={node.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.3 + ni * 0.04 }}
                      onMouseEnter={(e) => {
                        setHoveredNode(node.id);
                        showTooltip(e.clientX, e.clientY, node.label, node.description, node.status);
                      }}
                      onMouseLeave={() => {
                        setHoveredNode(null);
                        hideTooltip();
                      }}
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) =>
                        handleDragStart(e as unknown as React.MouseEvent, node.id)
                      }
                      onMouseMove={(e) => handleDragMove(e as unknown as React.MouseEvent)}
                      onMouseUp={handleDragEnd}
                      onTouchStart={(e) =>
                        handleDragStart(e as unknown as React.TouchEvent, node.id)
                      }
                      onTouchMove={(e) => handleDragMove(e as unknown as React.TouchEvent)}
                      onTouchEnd={handleDragEnd}
                    >
                      {/* Drag handle */}
                      {isHovered && (
                        <foreignObject x={nodeLn.x - 50} y={nodeLn.y - 14} width={14} height={14}>
                          <div className="flex items-center justify-center h-full">
                            <GripVertical size={9} className="text-white/30" />
                          </div>
                        </foreignObject>
                      )}
                      {/* Node rect */}
                      <rect
                        x={nodeLn.x - 32}
                        y={nodeLn.y - 9}
                        width={64}
                        height={18}
                        rx={5}
                        fill="#1E293B"
                        stroke={isSelected ? branch.color : branch.color + '99'}
                        strokeWidth={isSelected ? 2 : 1.5}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasChildren) toggleNode(node.id);
                          setSelected({ type: 'node', data: node, branch });
                        }}
                        filter={isSelected ? 'url(#glow)' : undefined}
                      />
                      {/* Status dot */}
                      <circle
                        cx={nodeLn.x - 26}
                        cy={nodeLn.y}
                        r={2.5}
                        fill={STATUS[node.status].color}
                      />
                      {/* Label */}
                      <text
                        x={nodeLn.x - 22}
                        y={nodeLn.y + 2}
                        fill="white"
                        fontSize="7"
                        fontWeight="500"
                        style={{ pointerEvents: 'none' }}
                      >
                        {node.label.length > 12 ? node.label.slice(0, 12) + '…' : node.label}
                      </text>
                      {/* Expand/collapse indicator */}
                      {hasChildren && (
                        <g
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNode(node.id);
                          }}
                        >
                          <circle
                            cx={nodeLn.x + 36}
                            cy={nodeLn.y}
                            r={6}
                            fill="#0F172A"
                            stroke={branch.color}
                            strokeWidth={1}
                          />
                          <foreignObject x={nodeLn.x + 32} y={nodeLn.y - 4} width={8} height={8}>
                            <div className="flex items-center justify-center h-full">
                              {expandedNodes.has(node.id) ? (
                                <ChevronDown size={7} color={branch.color} />
                              ) : (
                                <ChevronUp size={7} color={branch.color} />
                              )}
                            </div>
                          </foreignObject>
                        </g>
                      )}
                      {/* Edit/Delete on hover */}
                      {isHovered && (
                        <>
                          <foreignObject x={nodeLn.x + 44} y={nodeLn.y - 14} width={14} height={14}>
                            <button
                              className="flex items-center justify-center w-full h-full rounded bg-[#1E293B] text-[#94A3B8] hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditNode(branch.id, node);
                              }}
                            >
                              <Pencil size={8} />
                            </button>
                          </foreignObject>
                          <foreignObject x={nodeLn.x + 44} y={nodeLn.y + 2} width={14} height={14}>
                            <button
                              className="flex items-center justify-center w-full h-full rounded bg-[#1E293B] text-[#94A3B8] hover:text-[#EF4444]"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteConfirm(branch.id, node.id);
                              }}
                            >
                              <Trash2 size={8} />
                            </button>
                          </foreignObject>
                        </>
                      )}
                    </motion.g>
                  );
                });
              })}

              {/* ── Child nodes (Level 3) ── */}
              {branches.map((branch) => {
                if (!expandedBranches.has(branch.id)) return null;
                return branch.nodes.map((node) => {
                  if (!expandedNodes.has(node.id) || !node.children) return null;
                  const nodeLn = layoutNodes.find((n) => n.id === node.id);
                  if (!nodeLn) return null;
                  return node.children.map((child, ci) => {
                    const childLn = layoutNodes.find((n) => n.id === child.id);
                    if (!childLn) return null;
                    const hasLeaves = (child.children?.length ?? 0) > 0;
                    const isHovered = hoveredNode === child.id;
                    const isSelected =
                      selected.type === 'node' && (selected.data as MindNode).id === child.id;

                    return (
                      <motion.g
                        key={child.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25, delay: 0.4 + ci * 0.03 }}
                        onMouseEnter={(e) => {
                          setHoveredNode(child.id);
                          showTooltip(e.clientX, e.clientY, child.label, child.description, child.status);
                        }}
                        onMouseLeave={() => {
                          setHoveredNode(null);
                          hideTooltip();
                        }}
                        style={{ cursor: 'grab' }}
                        onMouseDown={(e) =>
                          handleDragStart(e as unknown as React.MouseEvent, child.id)
                        }
                        onMouseMove={(e) => handleDragMove(e as unknown as React.MouseEvent)}
                        onMouseUp={handleDragEnd}
                        onTouchStart={(e) =>
                          handleDragStart(e as unknown as React.TouchEvent, child.id)
                        }
                        onTouchMove={(e) => handleDragMove(e as unknown as React.TouchEvent)}
                        onTouchEnd={handleDragEnd}
                      >
                        {isHovered && (
                          <foreignObject x={childLn.x - 54} y={childLn.y - 14} width={12} height={12}>
                            <div className="flex items-center justify-center h-full">
                              <GripVertical size={8} className="text-white/25" />
                            </div>
                          </foreignObject>
                        )}
                        <rect
                          x={childLn.x - 40}
                          y={childLn.y - 11}
                          width={80}
                          height={22}
                          rx={8}
                          fill="#151F32"
                          stroke={isSelected ? branch.color : branch.color + '99'}
                          strokeWidth={isSelected ? 2 : 1}
                          strokeOpacity={isSelected ? 1 : 0.6}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasLeaves) toggleNode(child.id);
                            setSelected({ type: 'node', data: child, branch });
                          }}
                        />
                        <circle
                          cx={childLn.x - 30}
                          cy={childLn.y}
                          r={2.5}
                          fill={STATUS[child.status].color}
                        />
                        <text
                          x={childLn.x - 24}
                          y={childLn.y + 2.5}
                          fill="#CBD5E1"
                          fontSize="7"
                          fontWeight="400"
                          style={{ pointerEvents: 'none' }}
                        >
                          {child.label.length > 16 ? child.label.slice(0, 16) + '…' : child.label}
                        </text>
                        {/* Expand/collapse */}
                        {hasLeaves && (
                          <g
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNode(child.id);
                            }}
                          >
                            <circle
                              cx={childLn.x + 34}
                              cy={childLn.y}
                              r={6}
                              fill="#0F172A"
                              stroke={branch.color}
                              strokeWidth={1}
                            />
                            <foreignObject
                              x={childLn.x + 30}
                              y={childLn.y - 4}
                              width={8}
                              height={8}
                            >
                              <div className="flex items-center justify-center h-full">
                                {expandedNodes.has(child.id) ? (
                                  <ChevronDown size={6} color={branch.color} />
                                ) : (
                                  <ChevronUp size={6} color={branch.color} />
                                )}
                              </div>
                            </foreignObject>
                          </g>
                        )}
                        {isHovered && (
                          <>
                            <foreignObject x={childLn.x + 40} y={childLn.y - 10} width={12} height={12}>
                              <button
                                className="flex items-center justify-center w-full h-full rounded bg-[#151F32] text-[#94A3B8] hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditNode(branch.id, child);
                                }}
                              >
                                <Pencil size={7} />
                              </button>
                            </foreignObject>
                            <foreignObject x={childLn.x + 40} y={childLn.y + 2} width={12} height={12}>
                              <button
                                className="flex items-center justify-center w-full h-full rounded bg-[#151F32] text-[#94A3B8] hover:text-[#EF4444]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteConfirm(branch.id, child.id);
                                }}
                              >
                                <Trash2 size={7} />
                              </button>
                            </foreignObject>
                          </>
                        )}
                      </motion.g>
                    );
                  });
                });
              })}

              {/* ── Leaf nodes (Level 4) ── */}
              {branches.map((branch) => {
                if (!expandedBranches.has(branch.id)) return null;
                return branch.nodes.map((node) => {
                  if (!node.children) return null;
                  return node.children.map((child) => {
                    if (!expandedNodes.has(child.id) || !child.children) return null;
                    const childLn = layoutNodes.find((n) => n.id === child.id);
                    if (!childLn) return null;
                    return child.children.map((leaf, li) => {
                      const leafLn = layoutNodes.find((n) => n.id === leaf.id);
                      if (!leafLn) return null;
                      const isHovered = hoveredNode === leaf.id;

                      return (
                        <motion.g
                          key={leaf.id}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.2, delay: 0.5 + li * 0.02 }}
                          onMouseEnter={(e) => {
                            setHoveredNode(leaf.id);
                            showTooltip(e.clientX, e.clientY, leaf.label, leaf.description, leaf.status);
                          }}
                          onMouseLeave={() => {
                            setHoveredNode(null);
                            hideTooltip();
                          }}
                          style={{ cursor: 'grab' }}
                          onMouseDown={(e) =>
                            handleDragStart(e as unknown as React.MouseEvent, leaf.id)
                          }
                          onMouseMove={(e) => handleDragMove(e as unknown as React.MouseEvent)}
                          onMouseUp={handleDragEnd}
                          onTouchStart={(e) =>
                            handleDragStart(e as unknown as React.TouchEvent, leaf.id)
                          }
                          onTouchMove={(e) => handleDragMove(e as unknown as React.TouchEvent)}
                          onTouchEnd={handleDragEnd}
                        >
                          {isHovered && (
                            <foreignObject x={leafLn.x - 16} y={leafLn.y - 16} width={10} height={10}>
                              <div className="flex items-center justify-center h-full">
                                <GripVertical size={7} className="text-white/20" />
                              </div>
                            </foreignObject>
                          )}
                          <circle
                            cx={leafLn.x}
                            cy={leafLn.y}
                            r={5}
                            fill={STATUS[leaf.status].color}
                            stroke="#1E293B"
                            strokeWidth={2}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected({ type: 'node', data: leaf, branch });
                            }}
                          />
                          <text
                            x={leafLn.x}
                            y={leafLn.y + 16}
                            textAnchor="middle"
                            fill="#94A3B8"
                            fontSize="6"
                            fontWeight="400"
                            style={{ pointerEvents: 'none' }}
                          >
                            {leaf.label.length > 18 ? leaf.label.slice(0, 18) + '…' : leaf.label}
                          </text>
                          {isHovered && (
                            <>
                              <foreignObject x={leafLn.x + 7} y={leafLn.y - 12} width={12} height={12}>
                                <button
                                  className="flex items-center justify-center w-full h-full rounded-full bg-[#1E293B] text-[#94A3B8] hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditNode(branch.id, leaf);
                                  }}
                                >
                                  <Pencil size={6} />
                                </button>
                              </foreignObject>
                              <foreignObject x={leafLn.x + 7} y={leafLn.y + 2} width={12} height={12}>
                                <button
                                  className="flex items-center justify-center w-full h-full rounded-full bg-[#1E293B] text-[#94A3B8] hover:text-[#EF4444]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteConfirm(branch.id, leaf.id);
                                  }}
                                >
                                  <Trash2 size={6} />
                                </button>
                              </foreignObject>
                            </>
                          )}
                        </motion.g>
                      );
                    });
                  });
                });
              })}

              {/* End zoom/pan group */}
            </g>
          </svg>
        </div>

        {/* ── Detail Panel (right side) ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={
              selected.type === 'center'
                ? 'center'
                : selected.type === 'branch'
                  ? (selected.data as Branch).id
                  : (selected.data as MindNode).id
            }
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 30, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-[340px] flex-shrink-0 border-l border-white/5 bg-[#0F172A] overflow-y-auto hidden lg:block"
          >
            {/* Center selected */}
            {selected.type === 'center' && (
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#2E5BFF] to-[#4A82FF]">
                    <Target size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{CENTER.label.replace('\n', ' ')}</h2>
                    <p className="text-xs text-[#94A3B8]">{CENTER.subtitle}</p>
                  </div>
                </div>

                {/* UGT 9 Goal */}
                <div className="mb-5 rounded-xl border border-[#2E5BFF]/20 bg-[#2E5BFF]/5 p-4">
                  <h3 className="text-sm font-semibold text-[#4A82FF] mb-2 flex items-center gap-2">
                    <TrendingUp size={14} />
                    {UGT9_GOAL.label}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mb-3">{UGT9_GOAL.description}</p>
                  <div className="space-y-2">
                    {UGT9_GOAL.milestones.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {statusDot(m.status)}
                        <span className="text-xs font-medium text-white min-w-[60px]">{m.ugt}</span>
                        <span className="text-xs text-[#94A3B8]">{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overview stats */}
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Layers size={14} className="text-[#94A3B8]" />
                  Обзор направлений ({branches.length} веток)
                </h3>
                <div className="space-y-2">
                  {branches.map((branch) => {
                    const counts = getBranchStatusCounts(branch);
                    const total = Object.values(counts).reduce((a, b) => a + b, 0);
                    const donePct = total > 0 ? Math.round((counts.done / total) * 100) : 0;
                    return (
                      <div
                        key={branch.id}
                        className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#1E293B] p-3 cursor-pointer hover:bg-[#1E293B]/80 transition-colors"
                        onClick={() => {
                          setExpandedBranches((prev) => new Set([...prev, branch.id]));
                          setSelected({ type: 'branch', data: branch, branch });
                        }}
                      >
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${branch.color}20` }}
                        >
                          {(() => {
                            const Ic = ICON_MAP[branch.icon] || Layers;
                            return <Ic size={16} style={{ color: branch.color }} />;
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-white truncate">{branch.label}</span>
                            <span className="text-xs text-[#94A3B8] ml-2">{donePct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-[#0F172A] overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: branch.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${donePct}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-white mb-2">Легенда статусов</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(STATUS) as [Status, typeof STATUS.done][]).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <span className="text-xs text-[#94A3B8]">{cfg.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hint about clicking branches */}
                <div className="mt-5 rounded-xl border border-[#2E5BFF]/10 bg-[#2E5BFF]/5 p-3">
                  <p className="text-[10px] text-[#94A3B8] flex items-center gap-1.5">
                    <ChevronDown size={10} className="text-[#4A82FF]" />
                    Нажмите на ветку, чтобы увидеть подробности. Нажмите на узел, чтобы раскрыть дочерние элементы.
                  </p>
                </div>
              </div>
            )}

            {/* Branch selected */}
            {selected.type === 'branch' && (
              <div className="p-5">
                {(() => {
                  const branch = selected.data as Branch;
                  const counts = getBranchStatusCounts(branch);
                  const total = Object.values(counts).reduce((a, b) => a + b, 0);
                  const IconComp = ICON_MAP[branch.icon] || Layers;
                  return (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0"
                          style={{ backgroundColor: `${branch.color}20` }}
                        >
                          <IconComp size={24} style={{ color: branch.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-base font-bold text-white truncate">{branch.label}</h2>
                          <p className="text-xs text-[#94A3B8] truncate">{branch.description}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditBranch(branch)}
                            className="text-[#94A3B8] hover:text-white h-7 w-7"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteConfirm(branch.id)}
                            className="text-[#94A3B8] hover:text-[#EF4444] h-7 w-7"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>

                      {/* Status distribution */}
                      <div className="mb-4 rounded-xl border border-white/5 bg-[#1E293B] p-3">
                        <h3 className="text-xs font-semibold text-[#94A3B8] mb-2">Распределение статусов</h3>
                        <div className="flex h-3 rounded-full overflow-hidden">
                          {(Object.entries(counts) as [Status, number][]).map(([status, count]) =>
                            count > 0 ? (
                              <div
                                key={status}
                                className="h-full"
                                style={{
                                  backgroundColor: STATUS[status].color,
                                  width: `${total > 0 ? (count / total) * 100 : 0}%`,
                                }}
                              />
                            ) : null
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                          {(Object.entries(counts) as [Status, number][]).map(([status, count]) => (
                            <div key={status} className="flex items-center gap-1.5">
                              {statusDot(status)}
                              <span className="text-[10px] text-[#94A3B8]">
                                {STATUS[status].label}: {count}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* KPI cards */}
                      <h3 className="text-sm font-semibold text-white mb-2">Ключевые показатели</h3>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="rounded-lg border border-white/5 bg-[#1E293B] p-3 text-center">
                          <div className="text-xl font-bold text-white">{branch.nodes.length}</div>
                          <div className="text-[10px] text-[#94A3B8]">Направлений</div>
                        </div>
                        <div className="rounded-lg border border-white/5 bg-[#1E293B] p-3 text-center">
                          <div className="text-xl font-bold text-white">{total}</div>
                          <div className="text-[10px] text-[#94A3B8]">Всего элементов</div>
                        </div>
                        <div className="rounded-lg border border-white/5 bg-[#1E293B] p-3 text-center">
                          <div className="text-xl font-bold" style={{ color: STATUS.progress.color }}>
                            {counts.progress}
                          </div>
                          <div className="text-[10px] text-[#94A3B8]">В работе</div>
                        </div>
                        <div className="rounded-lg border border-white/5 bg-[#1E293B] p-3 text-center">
                          <div className="text-xl font-bold" style={{ color: STATUS.done.color }}>
                            {counts.done}
                          </div>
                          <div className="text-[10px] text-[#94A3B8]">Готово</div>
                        </div>
                      </div>

                      {/* Node list */}
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white">Направления</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAddNode(branch.id)}
                          className="text-[#4A82FF] hover:bg-[#2E5BFF]/10 h-7 px-2 text-xs"
                        >
                          <Plus size={12} className="mr-1" />
                          Добавить
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {branch.nodes.map((node) => (
                          <div
                            key={node.id}
                            className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#1E293B] p-2.5 cursor-pointer hover:bg-white/5 transition-colors group"
                            onClick={() => {
                              toggleNode(node.id);
                              setSelected({ type: 'node', data: node, branch });
                            }}
                          >
                            {statusDot(node.status)}
                            <span className="text-xs text-white flex-1 min-w-0 truncate">{node.label}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="text-[#94A3B8] hover:text-white p-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditNode(branch.id, node);
                                }}
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                className="text-[#94A3B8] hover:text-[#EF4444] p-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteConfirm(branch.id, node.id);
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            {(node.children?.length ?? 0) > 0 && (
                              <span className="text-[10px] text-[#94A3B8] flex-shrink-0">
                                {node.children!.length}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Node selected */}
            {selected.type === 'node' && (
              <div className="p-5">
                {(() => {
                  const node = selected.data as MindNode;
                  const branch = selected.branch!;
                  return (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          {statusBadge(node.status)}
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ color: branch.color, backgroundColor: `${branch.color}15` }}
                          >
                            {branch.label}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-lg font-bold text-white mb-1 flex-1">{node.label}</h2>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditNode(branch.id, node)}
                              className="text-[#94A3B8] hover:text-white h-7 w-7"
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteConfirm(branch.id, node.id)}
                              className="text-[#94A3B8] hover:text-[#EF4444] h-7 w-7"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                        {node.description && <p className="text-sm text-[#94A3B8]">{node.description}</p>}
                      </div>

                      {/* Rationale */}
                      {node.rationale && (
                        <div className="mb-4 rounded-lg border border-[#E8ECF0] bg-[#F8FAFC] p-4">
                          <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                            <Info size={14} /> Почему это важно для нас
                          </span>
                          <p className="text-sm leading-relaxed text-[#475569]">{node.rationale}</p>
                        </div>
                      )}

                      {/* Actions */}
                      {node.actions && node.actions.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-[#4A82FF]" />
                            Действия
                          </h3>
                          <div className="space-y-1.5">
                            {node.actions.map((action, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 rounded-lg border border-white/5 bg-[#1E293B] p-2.5"
                              >
                                <ArrowRight size={12} className="text-[#94A3B8] mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-[#CBD5E1]">{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Children */}
                      {node.children && node.children.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                              <Layers size={14} className="text-[#94A3B8]" />
                              Подэлементы ({node.children.length})
                            </h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAddNode(branch.id, node.id)}
                              className="text-[#4A82FF] hover:bg-[#2E5BFF]/10 h-7 px-2 text-xs"
                            >
                              <Plus size={12} className="mr-1" />
                              Добавить
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            {node.children.map((child) => (
                              <div
                                key={child.id}
                                className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#1E293B] p-2 cursor-pointer hover:bg-white/5 transition-colors group"
                                onClick={() => setSelected({ type: 'node', data: child, branch })}
                              >
                                {statusDot(child.status)}
                                <span className="text-xs text-white flex-1 min-w-0 truncate">
                                  {child.label}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    className="text-[#94A3B8] hover:text-white p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditNode(branch.id, child);
                                    }}
                                  >
                                    <Pencil size={10} />
                                  </button>
                                  <button
                                    className="text-[#94A3B8] hover:text-[#EF4444] p-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteConfirm(branch.id, child.id);
                                    }}
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                                {child.children && (
                                  <span className="text-[10px] text-[#94A3B8] flex-shrink-0">
                                    {child.children.length}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Leaf grandchildren */}
                      {node.children?.some((c) => c.children && c.children.length > 0) && (
                        <div>
                          <h3 className="text-sm font-semibold text-white mb-2">Детализация</h3>
                          <div className="space-y-2">
                            {node.children
                              .filter((c) => c.children && c.children.length > 0)
                              .map((child) => (
                                <div key={child.id} className="rounded-lg border border-white/5 bg-[#1E293B] p-2.5">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    {statusDot(child.status)}
                                    <span className="text-xs font-medium text-white">{child.label}</span>
                                  </div>
                                  <div className="ml-4 space-y-1">
                                    {child.children!.map((leaf) => (
                                      <div
                                        key={leaf.id}
                                        className="flex items-center gap-1.5 group cursor-pointer"
                                        onClick={() => setSelected({ type: 'node', data: leaf, branch })}
                                      >
                                        <CircleDot size={10} style={{ color: STATUS[leaf.status].color }} />
                                        <span className="text-[11px] text-[#94A3B8] hover:text-white transition-colors flex-1">
                                          {leaf.label}
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            className="text-[#94A3B8] hover:text-white p-0.5"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditNode(branch.id, leaf);
                                            }}
                                          >
                                            <Pencil size={9} />
                                          </button>
                                          <button
                                            className="text-[#94A3B8] hover:text-[#EF4444] p-0.5"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openDeleteConfirm(branch.id, leaf.id);
                                            }}
                                          >
                                            <Trash2 size={9} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Timeline (bottom) ── */}
      <div className="border-t border-white/5 bg-[#0F172A] px-4 sm:px-6 py-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Rocket size={14} className="text-[#FF7A2E]" />
          План реализации
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {timeline.map((phase, i) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              className="flex items-stretch gap-3 flex-shrink-0"
            >
              <div className="w-[200px] rounded-xl border border-white/5 bg-[#1E293B] p-3 flex flex-col relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: STATUS[phase.status].color }}
                />
                <div className="flex items-center justify-between mb-1.5 mt-1">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                    {phase.phase}
                  </span>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      color: STATUS[phase.status].color,
                      backgroundColor: STATUS[phase.status].bg,
                    }}
                  >
                    {STATUS[phase.status].label}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{phase.label}</h4>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed flex-1">{phase.description}</p>
                {phase.date && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-[#64748B]">
                    <Circle size={10} />
                    {phase.date}
                  </div>
                )}
              </div>
              {i < timeline.length - 1 && (
                <div className="flex items-center flex-shrink-0">
                  <ArrowRight size={16} className="text-[#475569]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════ */}

      {/* ── Add/Edit Branch Modal ── */}
      <Dialog
        open={modalType === 'addBranch' || modalType === 'editBranch'}
        onOpenChange={() => setModalType(null)}
      >
        <DialogContent className="bg-[#1E293B] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {modalType === 'editBranch' ? 'Редактировать ветку' : 'Добавить ветку'}
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              {modalType === 'editBranch'
                ? 'Измените параметры ветки'
                : 'Создайте новую ветку на карте'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Название</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Например: Наука"
                className="bg-[#0F172A] border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Описание</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Краткое описание ветки"
                rows={2}
                className="w-full rounded-md border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-2 block">Цвет</label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={cx(
                      'w-8 h-8 rounded-full transition-all',
                      formColor === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-2 block">Иконка</label>
              <div className="grid grid-cols-7 gap-2">
                {ICON_NAMES.slice(0, 21).map((name) => {
                  const Ic = ICON_MAP[name] || Layers;
                  return (
                    <button
                      key={name}
                      onClick={() => setFormIcon(name)}
                      className={cx(
                        'flex items-center justify-center h-9 rounded-lg transition-all',
                        formIcon === name
                          ? 'bg-[#2E5BFF]/20 ring-1 ring-[#2E5BFF]'
                          : 'bg-[#0F172A] hover:bg-white/5'
                      )}
                      title={name}
                    >
                      <Ic size={16} className={formIcon === name ? 'text-[#4A82FF]' : 'text-[#94A3B8]'} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalType(null)} className="text-[#94A3B8]">
              Отмена
            </Button>
            <Button
              onClick={handleSaveBranch}
              disabled={!formName.trim()}
              className="bg-[#2E5BFF] hover:bg-[#2E5BFF]/80 text-white"
            >
              {modalType === 'editBranch' ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Node Modal ── */}
      <Dialog
        open={modalType === 'addNode' || modalType === 'editNode'}
        onOpenChange={() => setModalType(null)}
      >
        <DialogContent className="bg-[#1E293B] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {modalType === 'editNode' ? 'Редактировать узел' : 'Добавить узел'}
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              {modalData.nodeId
                ? 'Добавить дочерний узел'
                : modalType === 'editNode'
                  ? 'Измените параметры узла'
                  : 'Добавить новый узел в ветку'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Название узла</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Например: ВУЗы"
                className="bg-[#0F172A] border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Описание</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Краткое описание"
                rows={2}
                className="w-full rounded-md border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-2 block">Статус</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(STATUS) as [Status, typeof STATUS.done][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFormStatus(key)}
                    className={cx(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
                      formStatus === key
                        ? 'border-transparent'
                        : 'border-white/10 bg-[#0F172A] text-[#94A3B8] hover:bg-white/5'
                    )}
                    style={
                      formStatus === key
                        ? { color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.color + '40' }
                        : {}
                    }
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#94A3B8] mb-1 block">Действия (через запятую)</label>
              <textarea
                value={formActions}
                onChange={(e) => setFormActions(e.target.value)}
                placeholder="Например: Подписать соглашение, Привлечь магистрантов"
                rows={2}
                className="w-full rounded-md border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalType(null)} className="text-[#94A3B8]">
              Отмена
            </Button>
            <Button
              onClick={handleSaveNode}
              disabled={!formName.trim()}
              className="bg-[#2E5BFF] hover:bg-[#2E5BFF]/80 text-white"
            >
              {modalType === 'editNode' ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <Dialog open={modalType === 'deleteConfirm'} onOpenChange={() => setModalType(null)}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 size={16} className="text-[#EF4444]" />
              Подтвердите удаление
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              {modalData.nodeId
                ? 'Этот узел и все его дочерние элементы будут удалены. Это действие нельзя отменить.'
                : 'Эта ветка и все её узлы будут удалены. Это действие нельзя отменить.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalType(null)} className="text-[#94A3B8]">
              Отмена
            </Button>
            <Button onClick={handleDelete} className="bg-[#EF4444] hover:bg-[#EF4444]/80 text-white">
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fullscreen Node Popup ── */}
      <Dialog open={!!fullscreenNode} onOpenChange={() => setFullscreenNode(null)}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white sm:max-w-lg max-h-[80vh] overflow-y-auto">
          {fullscreenNode && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  {fullscreenNode.type === 'branch' ? (
                    <>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: (fullscreenNode.data as Branch).color }} />
                      {(fullscreenNode.data as Branch).label}
                    </>
                  ) : (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS[(fullscreenNode.data as MindNode).status].color }} />
                      {(fullscreenNode.data as MindNode).label}
                    </>
                  )}
                </DialogTitle>
                <DialogDescription className="text-[#94A3B8]">
                  {fullscreenNode.type === 'branch'
                    ? (fullscreenNode.data as Branch).description
                    : (fullscreenNode.data as MindNode).description}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {'rationale' in fullscreenNode.data && (fullscreenNode.data as MindNode).rationale && (
                  <div className="bg-[#0F172A] rounded-lg p-3">
                    <div className="text-[#94A3B8] text-xs mb-1">Почему это важно</div>
                    <div className="text-white">{(fullscreenNode.data as MindNode).rationale}</div>
                  </div>
                )}
                {'status' in fullscreenNode.data && (
                  <div className="flex items-center gap-2">
                    <span className="text-[#94A3B8] text-xs">Статус:</span>
                    {statusBadge((fullscreenNode.data as MindNode).status)}
                  </div>
                )}
                {'actions' in fullscreenNode.data && (fullscreenNode.data as MindNode).actions && (fullscreenNode.data as MindNode).actions!.length > 0 && (
                  <div>
                    <div className="text-[#94A3B8] text-xs mb-2">Действия</div>
                    {(fullscreenNode.data as MindNode).actions!.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-white mb-1">
                        <ArrowRight size={12} className="text-[#2E5BFF]" />
                        {a}
                      </div>
                    ))}
                  </div>
                )}
                {fullscreenNode.type === 'node' && 'children' in fullscreenNode.data && (fullscreenNode.data as MindNode).children && (fullscreenNode.data as MindNode).children!.length > 0 && (
                  <div>
                    <div className="text-[#94A3B8] text-xs mb-2">Подэлементы ({(fullscreenNode.data as MindNode).children!.length})</div>
                    {(fullscreenNode.data as MindNode).children!.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 mb-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS[c.status].color }} />
                        <span className="text-white text-xs">{c.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
