import { registerGame, type GameDefinition } from '@roomjoy/game-sdk';

/** Snack Chase — registration stub only (out of scope for M1). */
export const snackChase: GameDefinition = {
  id: 'snack-chase',
  name: 'Snack Chase',
  minPlayers: 2,
  maxPlayers: 8,
};

registerGame(snackChase);
export default snackChase;
