import type { PieceType } from '../game/pieces';

export interface PieceSkin {
  base: string;
  light: string;
  dark: string;
  glow: string;
}

/** Original palette: saturated but harmonised so long sessions stay readable. */
export const PIECE_SKINS: Record<PieceType, PieceSkin> = {
  I: { base: '#2fd4e0', light: '#8ff2f8', dark: '#0d8f9c', glow: 'rgba(47,212,224,0.55)' },
  J: { base: '#4a72f5', light: '#9db3ff', dark: '#1f3ea8', glow: 'rgba(74,114,245,0.55)' },
  L: { base: '#ff9d3d', light: '#ffd0a0', dark: '#b45f0f', glow: 'rgba(255,157,61,0.55)' },
  O: { base: '#f6cf4a', light: '#ffeaa1', dark: '#ab8b0d', glow: 'rgba(246,207,74,0.55)' },
  S: { base: '#39d67f', light: '#a2f2c4', dark: '#13894a', glow: 'rgba(57,214,127,0.55)' },
  T: { base: '#b45cff', light: '#dcb0ff', dark: '#6e21b3', glow: 'rgba(180,92,255,0.55)' },
  Z: { base: '#ff5f7e', light: '#ffb0be', dark: '#b0203c', glow: 'rgba(255,95,126,0.55)' },
};

export const GRID_LINE = 'rgba(148, 163, 208, 0.10)';
export const GRID_LINE_STRONG = 'rgba(148, 163, 208, 0.18)';
export const FIELD_TOP = '#0d1024';
export const FIELD_BOTTOM = '#141935';
