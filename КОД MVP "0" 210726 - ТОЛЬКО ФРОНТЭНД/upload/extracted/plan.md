# Plan: Fix Mind Map Layout — Eliminate Node Overlaps

## Problem Analysis
- Canvas: 5000×4000, center (2500, 2000)
- 6 branches, each with ~16-18 sub-nodes (100 concepts total)
- Sub-nodes at radius 950px in 60° sectors
- Sub-node size: 84×24px
- Arc spacing at R=950: ~58px < node width 84px = OVERLAP

## Solution: Mathematical Layout Fix
1. **Increase sub-node radius**: 950 → 1600px
2. **Reduce sub-node size**: 84×24 → 64×18px  
3. **Reduce sub-node font**: → 7px
4. **Reduce branch circle**: r=38 → r=32
5. **Verify**: At R=1600, arc spacing = 1600 × (55°/17 × π/180) ≈ 90px > 64px = OK

## Stage 1: Edit MindMapPage.tsx
- Change LEVEL_RADIUS
- Change node rendering dimensions
- Adjust font sizes
- Verify build and deploy

## Stage 2: Deploy and verify
