// Reine Spiellogik & Zustand - keine DOM-Zugriffe hier.

export const BOARD_COLS = 9;
export const BOARD_ROWS = 14;
export const GOAL_COLUMN = 5; // 1-indexiert, mittlere Spalte von 9

export const SIDE = {
  TOP: "top",
  BOTTOM: "bottom",
};

export const PIECES_PER_TEAM = 11;
export const MAX_PIECES_PER_CELL = 2;

// Standardaufstellung entsprechend der Referenzgrafik. Die Nummern bleiben
// bewusst an ihren dort gezeigten Positionen und werden nicht automatisch
// zeilenweise vergeben.
const FORMATION_BY_SIDE = {
  [SIDE.TOP]: [
    { number: 1, row: 1, col: 5 },
    { number: 2, row: 3, col: 2 },
    { number: 3, row: 3, col: 4 },
    { number: 5, row: 3, col: 6 },
    { number: 4, row: 3, col: 8 },
    { number: 6, row: 5, col: 2 },
    { number: 7, row: 5, col: 4 },
    { number: 11, row: 5, col: 6 },
    { number: 9, row: 5, col: 8 },
    { number: 8, row: 7, col: 4 },
    { number: 10, row: 7, col: 6 },
  ],
  [SIDE.BOTTOM]: [
    { number: 10, row: 8, col: 4 },
    { number: 11, row: 8, col: 6 },
    { number: 6, row: 10, col: 2 },
    { number: 7, row: 10, col: 4 },
    { number: 8, row: 10, col: 6 },
    { number: 9, row: 10, col: 8 },
    { number: 2, row: 12, col: 2 },
    { number: 3, row: 12, col: 4 },
    { number: 4, row: 12, col: 6 },
    { number: 5, row: 12, col: 8 },
    { number: 1, row: 14, col: 5 },
  ],
};

function layoutTeam(side) {
  return FORMATION_BY_SIDE[side].map(({ number, row, col }) => ({
    id: `${side}-${number}`,
    side,
    row,
    col,
  }));
}

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
    pieces: [
      ...layoutTeam(SIDE.BOTTOM),
      ...layoutTeam(SIDE.TOP),
    ],
    // Der Ball startet beim unteren Spieler 10. Seine Position wird zusaetzlich
    // gespeichert, damit er nach einem Pass auch frei auf einem Feld liegen kann.
    ball: {
      row: 8,
      col: 4,
      possessorId: "bottom-10",
    },
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

export function getPiecesAtCell(gameState, row, col) {
  return gameState.pieces.filter((p) => p.row === row && p.col === col);
}

export function canPlacePieceAt(gameState, pieceId, row, col) {
  if (!isCellOnBoard(row, col, gameState)) {
    return false;
  }
  const occupants = getPiecesAtCell(gameState, row, col).filter((p) => p.id !== pieceId);
  return occupants.length < MAX_PIECES_PER_CELL;
}

function updatePossessionForCell(gameState, row, col, preferredPieceId = null) {
  const occupants = getPiecesAtCell(gameState, row, col);
  const preferred = occupants.find((piece) => piece.id === preferredPieceId);
  gameState.ball.possessorId = preferred?.id ?? occupants[0]?.id ?? null;
}

// Bewegt eine Spielfigur. Hat sie den Ball, folgt dieser automatisch. Bewegt
// sie sich auf den freien Ball, uebernimmt sie den Ballbesitz.
export function movePiece(gameState, pieceId, row, col) {
  if (!canPlacePieceAt(gameState, pieceId, row, col)) {
    return false;
  }

  const piece = gameState.pieces.find((p) => p.id === pieceId);
  if (!piece) {
    return false;
  }

  const carriedBall = gameState.ball.possessorId === pieceId;
  piece.row = row;
  piece.col = col;

  if (carriedBall) {
    gameState.ball.row = row;
    gameState.ball.col = col;
  } else if (
    gameState.ball.possessorId === null
    && gameState.ball.row === row
    && gameState.ball.col === col
  ) {
    gameState.ball.possessorId = pieceId;
  }

  return true;
}

// Der Ball darf auf jedes Feld gespielt werden. Liegt dort mindestens eine
// Figur, geht der Ballbesitz an eine Figur auf diesem Feld; sonst bleibt der
// Ball frei liegen.
export function moveBall(gameState, row, col) {
  if (!isCellOnBoard(row, col, gameState)) {
    return false;
  }

  gameState.ball.row = row;
  gameState.ball.col = col;
  updatePossessionForCell(gameState, row, col);
  return true;
}
