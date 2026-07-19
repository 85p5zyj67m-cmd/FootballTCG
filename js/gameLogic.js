// Reine Spiellogik & Zustand - keine DOM-Zugriffe hier.

export const BOARD_COLS = 9;
export const BOARD_ROWS = 12;
export const GOAL_COLUMN = 5; // 1-indexiert, mittlere Spalte von 9

export const SIDE = {
  TOP: "top",
  BOTTOM: "bottom",
};

export const PIECES_PER_TEAM = 11;
export const MAX_PIECES_PER_CELL = 2;

// Klassische 4-4-2-Grundordnung: Torwart, Viererkette, Vierer-Mittelfeld
// und zwei Stuermer. Das obere Team wird vertikal gespiegelt, sodass beide
// Mannschaften in Richtung gegnerisches Tor ausgerichtet sind.
const FORMATION_4_4_2 = [
  { rowFromOwnGoal: 0, cols: [5] },
  { rowFromOwnGoal: 2, cols: [1, 3, 7, 9] },
  { rowFromOwnGoal: 4, cols: [1, 3, 7, 9] },
  { rowFromOwnGoal: 6, cols: [3, 7] },
];

function layoutTeam(side, rows) {
  const pieces = [];
  let number = 1;

  for (const line of FORMATION_4_4_2) {
    const row = side === SIDE.BOTTOM
      ? rows - line.rowFromOwnGoal
      : 1 + line.rowFromOwnGoal;

    for (const col of line.cols) {
      pieces.push({
        id: `${side}-${number}`,
        side,
        row,
        col,
      });
      number++;
    }
  }

  return pieces;
}

// Legt fest, wer welche Seite spielt. localPlayerId markiert, welcher
// Spieler auf diesem Client sitzt - Grundlage fuer den spaeteren
// Netzwerk-Sync im 1vs1-Multiplayer.
export function createGameState() {
  const cols = BOARD_COLS;
  const rows = BOARD_ROWS;

  return {
    cols,
    rows,
    players: [
      { id: 1, side: SIDE.BOTTOM },
      { id: 2, side: SIDE.TOP },
    ],
    localPlayerId: 1,
    currentPlayerId: 1,
    pieces: [
      ...layoutTeam(SIDE.BOTTOM, rows),
      ...layoutTeam(SIDE.TOP, rows),
    ],
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

// Bewegt eine Spielfigur, sofern die Zielzelle auf dem Feld liegt und dort
// noch nicht die maximale Anzahl an Figuren steht. Mutiert gameState direkt.
export function movePiece(gameState, pieceId, row, col) {
  if (!canPlacePieceAt(gameState, pieceId, row, col)) {
    return false;
  }
  const piece = gameState.pieces.find((p) => p.id === pieceId);
  if (!piece) {
    return false;
  }
  piece.row = row;
  piece.col = col;
  return true;
}
