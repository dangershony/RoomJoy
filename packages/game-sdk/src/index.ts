/**
 * RoomJoy Game SDK — registration + lifecycle hooks.
 * Games register metadata and rules; the platform owns room membership.
 */
import type {
  ContentMode,
  Direction,
  GameCatalogEntry,
  RoomPhase,
} from '@roomjoy/protocol';

export interface GamePlayer {
  id: string;
  nickname: string;
  avatarId: string;
  isHost: boolean;
}

export interface GameSettingsSchemaField {
  key: string;
  label: string;
  type: 'toggle' | 'enum';
  options?: string[];
  defaultValue: string | boolean;
}

export interface GameDefinition {
  id: string;
  title: string;
  description: string;
  /** Placeholder thumbnail (emoji or path) */
  thumbnail: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedDurationMinutes: number;
  settingsSchema: GameSettingsSchemaField[];

  /** Server: create opaque game state when selected / round starts */
  createInitialState?(contentMode: ContentMode): unknown;
  onTutorialStart?(ctx: GameContext): void;
  onRoundStart?(ctx: GameContext): void;
  /** Called each tick while PLAYING and not paused */
  onTick?(ctx: GameContext, dtMs: number): void;
  onInput?(ctx: GameContext, playerId: string, direction: Direction): void;
  /** Game-specific validated actions (answers, tutorial advance, etc.) */
  onAction?(
    ctx: GameContext,
    playerId: string,
    action: string,
    payload: unknown,
  ): { ok: boolean; error?: string };
  onPause?(ctx: GameContext): void;
  onResume?(ctx: GameContext): void;
  /** Produce RESULTS summary; platform transitions to RESULTS */
  onEnd?(ctx: GameContext): { summary: string };
  cleanup?(ctx: GameContext): void;
  /**
   * Per-player private payload. Must never include other players' secrets.
   * Platform delivers only to that player (not TV, not other phones, not host-as-others).
   */
  getPrivateState?(ctx: GameContext, playerId: string): unknown;
  /** Public game snapshot safe for TV + all phones (no unrevealed answers) */
  getPublicState?(ctx: GameContext): unknown;
  /** Optional PLAYING / TUTORIAL substate label for UI */
  getSubstate?(ctx: GameContext): string | null;
}

export interface GameContext {
  phase: RoomPhase;
  contentMode: ContentMode;
  players: GamePlayer[];
  gameState: unknown;
  /** Wall-clock ms for timers */
  now: number;
  setGameState(next: unknown): void;
  setSubstate(label: string | null): void;
  broadcast(event: string, payload: unknown): void;
  /** Transition room to RESULTS with summary (e.g. after last question) */
  requestEnd(summary: string): void;
}

const registry = new Map<string, GameDefinition>();

export function registerGame(def: GameDefinition): void {
  if (registry.has(def.id)) {
    // Idempotent re-register (HMR / double import)
    registry.set(def.id, def);
    return;
  }
  registry.set(def.id, def);
}

export function getGame(id: string): GameDefinition | undefined {
  return registry.get(id);
}

export function listGames(): GameDefinition[] {
  return [...registry.values()];
}

export function listGameCatalog(): GameCatalogEntry[] {
  return listGames().map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    thumbnail: g.thumbnail,
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    estimatedDurationMinutes: g.estimatedDurationMinutes,
  }));
}

export function requireGame(id: string): GameDefinition {
  const g = getGame(id);
  if (!g) throw new Error(`Unknown game: ${id}`);
  return g;
}

/** Build a GameContext helper bound to mutable holders. */
export function makeGameContext(opts: {
  phase: RoomPhase;
  contentMode: ContentMode;
  players: GamePlayer[];
  getState: () => unknown;
  setState: (s: unknown) => void;
  setSubstate: (s: string | null) => void;
  broadcast?: (event: string, payload: unknown) => void;
  requestEnd?: (summary: string) => void;
  now?: number;
}): GameContext {
  return {
    phase: opts.phase,
    contentMode: opts.contentMode,
    players: opts.players,
    now: opts.now ?? Date.now(),
    get gameState() {
      return opts.getState();
    },
    setGameState(next) {
      opts.setState(next);
    },
    setSubstate(label) {
      opts.setSubstate(label);
    },
    broadcast(event, payload) {
      opts.broadcast?.(event, payload);
    },
    requestEnd(summary) {
      opts.requestEnd?.(summary);
    },
  };
}
