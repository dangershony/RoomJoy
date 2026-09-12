import { registerGame, type GameDefinition } from '@roomjoy/game-sdk';

/** Confidence Club — registration stub only (out of scope for M1). */
export const confidenceClub: GameDefinition = {
  id: 'confidence-club',
  name: 'Confidence Club',
  minPlayers: 3,
  maxPlayers: 8,
};

registerGame(confidenceClub);
export default confidenceClub;
