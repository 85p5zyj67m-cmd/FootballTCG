// Reine Spiellogik & Zustand - keine DOM-Zugriffe hier.

export const BOARD_COLS = 5;
export const BOARD_ROWS = 9;
export const GOAL_COLUMN = 3; // 1-indexiert, mittlere Spalte von 5

export const SIDE = {
  TOP: "top",
  BOTTOM: "bottom",
};

// Legt fest, wer welche Seite spielt. localPlayerId markiert, welcher
// Spieler auf diesem Client sitzt - Grundlage fuer den spaeteren
// Netzwerk-Sync im 1vs1-Multiplayer.
export function createGameState() {
  return {
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    players: [
      { id: 1, side: SIDE.BOTTOM },
      { id: 2, side: SIDE.TOP },
    ],
    localPlayerId: 1,
    currentPlayerId: 1,
  };
}

export function getPlayerBySide(gameState, side) {
  return gameState.players.find((p) => p.side === side);
}

export function getOpponent(gameState, playerId) {
  return gameState.players.find((p) => p.id !== playerId);
}

export function isCurrentPlayer(gameState, playerId) {
  return gameState.currentPlayerId === playerId;
}

export function isCellOnBoard(row, col, gameState) {
  return row >= 1 && row <= gameState.rows && col >= 1 && col <= gameState.cols;
}
