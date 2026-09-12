import { registerGame, type GameDefinition } from '@roomjoy/game-sdk';

/** Mixed Signals — registration stub only (out of scope for M1). */
export const mixedSignals: GameDefinition = {
  id: 'mixed-signals',
  name: 'Mixed Signals',
  minPlayers: 2,
  maxPlayers: 8,
};

registerGame(mixedSignals);
export default mixedSignals;
