/**
 * RoomJoy Game SDK — stub for Milestone 1.
 * Future games register via GameDefinition and receive authoritative room hooks.
 */
import type { Direction, RoomPhase } from '@roomjoy/protocol';

export interface GamePlayer {
  id: string;
  nickname: string;
  avatarId: string;
}

export interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Called when host starts this game (M2+) */
  onStart?(ctx: GameContext): void;
  onTick?(ctx: GameContext, dt: number): void;
  onInput?(ctx: GameContext, playerId: string, direction: Direction): void;
  onEnd?(ctx: GameContext): void;
}

export interface GameContext {
  phase: RoomPhase;
  players: GamePlayer[];
  broadcast(event: string, payload: unknown): void;
}

const registry = new Map<string, GameDefinition>();

export function registerGame(def: GameDefinition): void {
  registry.set(def.id, def);
}

export function getGame(id: string): GameDefinition | undefined {
  return registry.get(id);
}

export function listGames(): GameDefinition[] {
  return [...registry.values()];
}
