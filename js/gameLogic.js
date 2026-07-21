// Reine Spiellogik & Zustand - keine DOM-Zugriffe hier.
// Regeln entsprechend "Football TCG - Prototyp Regeln v0.1".

export const BOARD_COLS = 9;
export const BOARD_ROWS = 14;
export const GOAL_COLUMN = 5; // 1-indexiert, mittlere Spalte von 9

export const SIDE = {
  TOP: "top",
  BOTTOM: "bottom",
};

export const ROLE = {
  GOALKEEPER: "gk",
  FIELD: "field",
};

export const PIECES_PER_TEAM = 11;
export const MAX_PIECES_PER_CELL = 1; // "Zwei Spieler duerfen niemals auf demselben Feld stehen."
export const ACTIONS_PER_TURN = 2;
export const MOVE_MAX_DISTANCE = 2;
export const PASS_MAX_DISTANCE = 4;
export const SHOOT_MAX_DISTANCE = 3;
export const WINNING_SCORE = 3;

// Benoetigter W6-Wurf je Entfernung zum Tor (Index = Feld-Entfernung).
const SHOOT_THRESHOLDS = { 1: 3, 2: 4, 3: 5 };

// Standardaufstellung entsprechend der Referenzgrafik. Die Nummern bleiben
// bewusst an ihren dort gezeigten Positionen und werden nicht automatisch
// zeilenweise vergeben. Nummer 1 ist jeweils der Torwart.
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
    role: number === 1 ? ROLE.GOALKEEPER : ROLE.FIELD,
  }));
}

function chebyshevDistance(row1, col1, row2, col2) {
  return Math.max(Math.abs(row1 - row2), Math.abs(col1 - col2));
}

// Bresenham-Linie inkl. beider Endpunkte - fuer die Schusslinie, die nicht
// zwingend einer der 8 Kompassrichtungen folgen muss.
function getLineCells(row0, col0, row1, col1) {
  const cells = [];
  const dr = Math.abs(row1 - row0);
  const dc = Math.abs(col1 - col0);
  const sr = row0 < row1 ? 1 : -1;
  const sc = col0 < col1 ? 1 : -1;
  let err = dr - dc;
  let row = row0;
  let col = col0;

  while (true) {
    cells.push({ row, col });
    if (row === row1 && col === col1) break;
    const e2 = 2 * err;
    if (e2 > -dc) {
      err -= dc;
      row += sr;
    }
    if (e2 < dr) {
      err += dr;
      col += sc;
    }
  }
  return cells;
}

// Prueft, ob (row1,col1) -> (row2,col2) horizontal, vertikal oder diagonal
// liegt (wie von Bewegung und Passen gefordert). Liefert null, falls nicht.
function getStraightDirection(row1, col1, row2, col2) {
  const dr = row2 - row1;
  const dc = col2 - col1;
  if (dr === 0 && dc === 0) return null;

  const isHorizontal = dr === 0;
  const isVertical = dc === 0;
  const isDiagonal = Math.abs(dr) === Math.abs(dc);
  if (!isHorizontal && !isVertical && !isDiagonal) return null;

  const distance = Math.max(Math.abs(dr), Math.abs(dc));
  const stepRow = Math.sign(dr);
  const stepCol = Math.sign(dc);
  const intermediates = [];
  for (let i = 1; i < distance; i++) {
    intermediates.push({ row: row1 + stepRow * i, col: col1 + stepCol * i });
  }
  return { distance, intermediates };
}

function getGoalCell(side, gameState) {
  return side === SIDE.TOP
    ? { row: 1, col: GOAL_COLUMN }
    : { row: gameState.rows, col: GOAL_COLUMN };
}

function opponentOf(side) {
  return side === SIDE.BOTTOM ? SIDE.TOP : SIDE.BOTTOM;
}

// Setzt die Mannschaften an ihre Anfangsformation und gibt einer Mannschaft
// den Anstoss: Ball in die Feldmitte, Ballbesitz beim naechststehenden
// Feldspieler dieser Seite (der GK bleibt im Tor).
function placeKickoff(gameState, kickoffSide) {
  const centerRow = Math.floor(gameState.rows / 2);
  const centerCol = GOAL_COLUMN;

  const candidates = gameState.pieces.filter(
    (p) => p.side === kickoffSide && p.role !== ROLE.GOALKEEPER,
  );
  let closest = candidates[0];
  let bestDistance = Infinity;
  for (const piece of candidates) {
    const distance = chebyshevDistance(piece.row, piece.col, centerRow, centerCol);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = piece;
    }
  }

  closest.row = centerRow;
  closest.col = centerCol;
  gameState.ball.row = centerRow;
  gameState.ball.col = centerCol;
  gameState.ball.possessorId = closest.id;
}

function resetFormationsAndKickoff(gameState, kickoffSide) {
  gameState.pieces = [...layoutTeam(SIDE.BOTTOM), ...layoutTeam(SIDE.TOP)];
  placeKickoff(gameState, kickoffSide);
}

export function createGameState() {
  const gameState = {
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    players: [
      { id: 1, side: SIDE.BOTTOM, isAI: false },
      { id: 2, side: SIDE.TOP, isAI: true },
    ],
    localPlayerId: 1,
    currentPlayerId: 1,
    actionsRemaining: ACTIONS_PER_TURN,
    score: { [SIDE.BOTTOM]: 0, [SIDE.TOP]: 0 },
    winner: null,
    pieces: [...layoutTeam(SIDE.BOTTOM), ...layoutTeam(SIDE.TOP)],
    ball: { row: 0, col: 0, possessorId: null },
  };
  placeKickoff(gameState, SIDE.BOTTOM);
  return gameState;
}

export function getCurrentPlayer(gameState) {
  return gameState.players.find((p) => p.id === gameState.currentPlayerId);
}

export function getPieceById(gameState, pieceId) {
  return gameState.pieces.find((p) => p.id === pieceId);
}

export function isCellOnBoard(row, col, gameState) {
  return row >= 1 && row <= gameState.rows && col >= 1 && col <= gameState.cols;
}

export function getPiecesAtCell(gameState, row, col) {
  return gameState.pieces.filter((p) => p.row === row && p.col === col);
}

function canAct(gameState, pieceId) {
  if (gameState.winner) return { ok: false, reason: "game_over" };
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return { ok: false, reason: "not_found" };
  const currentPlayer = getCurrentPlayer(gameState);
  if (piece.side !== currentPlayer.side) return { ok: false, reason: "not_your_turn" };
  if (gameState.actionsRemaining <= 0) return { ok: false, reason: "no_actions_left" };
  return { ok: true, piece };
}

function finishAction(gameState) {
  gameState.actionsRemaining -= 1;
  if (gameState.actionsRemaining <= 0 && !gameState.winner) {
    gameState.currentPlayerId = gameState.currentPlayerId === 1 ? 2 : 1;
    gameState.actionsRemaining = ACTIONS_PER_TURN;
  }
}

// Beendet den aktuellen Zug sofort, auch wenn noch Aktionen uebrig sind
// (z.B. "Zug beenden"-Button oder eine KI, die keinen Zug mehr findet).
export function endTurnNow(gameState) {
  if (gameState.winner) return;
  gameState.currentPlayerId = gameState.currentPlayerId === 1 ? 2 : 1;
  gameState.actionsRemaining = ACTIONS_PER_TURN;
}

function giveBallToGoalkeeper(gameState, side) {
  const keeper = gameState.pieces.find((p) => p.side === side && p.role === ROLE.GOALKEEPER);
  gameState.ball.possessorId = keeper.id;
  gameState.ball.row = keeper.row;
  gameState.ball.col = keeper.col;
}

function scoreGoal(gameState, scoringSide) {
  gameState.score[scoringSide] += 1;
  if (gameState.score[scoringSide] >= WINNING_SCORE) {
    gameState.winner = scoringSide;
  }
  resetFormationsAndKickoff(gameState, opponentOf(scoringSide));
}

// --- Abfragen (rein lesend, fuer UI-Hervorhebung und KI-Entscheidungen) ---

export function getLegalMoveCells(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return [];

  const results = [];
  for (let row = piece.row - MOVE_MAX_DISTANCE; row <= piece.row + MOVE_MAX_DISTANCE; row++) {
    for (let col = piece.col - MOVE_MAX_DISTANCE; col <= piece.col + MOVE_MAX_DISTANCE; col++) {
      if (row === piece.row && col === piece.col) continue;
      if (!isCellOnBoard(row, col, gameState)) continue;

      const direction = getStraightDirection(piece.row, piece.col, row, col);
      if (!direction || direction.distance > MOVE_MAX_DISTANCE) continue;
      if (getPiecesAtCell(gameState, row, col).length >= MAX_PIECES_PER_CELL) continue;
      const blocked = direction.intermediates.some(
        (c) => getPiecesAtCell(gameState, c.row, c.col).length > 0,
      );
      if (blocked) continue;

      results.push({ row, col });
    }
  }
  return results;
}

export function getLegalPassTargets(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece || gameState.ball.possessorId !== pieceId) return [];

  const teammates = gameState.pieces.filter((p) => p.side === piece.side && p.id !== pieceId);
  const results = [];
  for (const mate of teammates) {
    const direction = getStraightDirection(piece.row, piece.col, mate.row, mate.col);
    if (!direction || direction.distance > PASS_MAX_DISTANCE) continue;
    const blockedByOpponent = direction.intermediates.some((c) =>
      getPiecesAtCell(gameState, c.row, c.col).some((p) => p.side !== piece.side),
    );
    if (blockedByOpponent) continue;
    results.push(mate.id);
  }
  return results;
}

export function getLegalTackleTarget(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return null;
  const carrierId = gameState.ball.possessorId;
  if (!carrierId) return null;
  const carrier = getPieceById(gameState, carrierId);
  if (!carrier || carrier.side === piece.side) return null;
  if (chebyshevDistance(piece.row, piece.col, carrier.row, carrier.col) !== 1) return null;
  return carrier.id;
}

export function getShotInfo(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece || gameState.ball.possessorId !== pieceId) return { legal: false };

  const opponentSide = opponentOf(piece.side);
  const goalCell = getGoalCell(opponentSide, gameState);
  const distance = chebyshevDistance(piece.row, piece.col, goalCell.row, goalCell.col);
  if (distance > SHOOT_MAX_DISTANCE) return { legal: false, distance };

  const line = getLineCells(piece.row, piece.col, goalCell.row, goalCell.col).slice(1, -1);
  const blocked = line.some((c) => getPiecesAtCell(gameState, c.row, c.col).length > 0);
  if (blocked) return { legal: false, distance, blocked: true };

  return { legal: true, distance, needed: SHOOT_THRESHOLDS[distance] };
}

// --- Aktionen (mutieren gameState, pruefen Zug/Aktionen-Berechtigung) ---

export function executeMove(gameState, pieceId, row, col) {
  const guard = canAct(gameState, pieceId);
  if (!guard.ok) return guard;
  const piece = guard.piece;

  const legalCells = getLegalMoveCells(gameState, pieceId);
  if (!legalCells.some((c) => c.row === row && c.col === col)) {
    return { ok: false, reason: "illegal_move" };
  }

  const carriedBall = gameState.ball.possessorId === pieceId;
  piece.row = row;
  piece.col = col;

  if (carriedBall) {
    gameState.ball.row = row;
    gameState.ball.col = col;
  } else if (
    gameState.ball.possessorId === null &&
    gameState.ball.row === row &&
    gameState.ball.col === col
  ) {
    gameState.ball.possessorId = pieceId;
  }

  finishAction(gameState);
  return { ok: true };
}

export function executePass(gameState, fromPieceId, toPieceId) {
  const guard = canAct(gameState, fromPieceId);
  if (!guard.ok) return guard;

  const legalTargets = getLegalPassTargets(gameState, fromPieceId);
  if (!legalTargets.includes(toPieceId)) {
    return { ok: false, reason: "illegal_pass" };
  }

  const target = getPieceById(gameState, toPieceId);
  gameState.ball.possessorId = toPieceId;
  gameState.ball.row = target.row;
  gameState.ball.col = target.col;

  finishAction(gameState);
  return { ok: true };
}

export function executeTackle(gameState, tacklerId) {
  const guard = canAct(gameState, tacklerId);
  if (!guard.ok) return guard;

  const target = getLegalTackleTarget(gameState, tacklerId);
  if (!target) {
    return { ok: false, reason: "illegal_tackle" };
  }

  const ballRow = gameState.ball.row;
  const ballCol = gameState.ball.col;
  const freeNeighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = ballRow + dr;
      const col = ballCol + dc;
      if (!isCellOnBoard(row, col, gameState)) continue;
      if (getPiecesAtCell(gameState, row, col).length >= MAX_PIECES_PER_CELL) continue;
      freeNeighbors.push({ row, col });
    }
  }

  if (freeNeighbors.length > 0) {
    const pick = freeNeighbors[Math.floor(Math.random() * freeNeighbors.length)];
    gameState.ball.row = pick.row;
    gameState.ball.col = pick.col;
  }
  gameState.ball.possessorId = null;

  finishAction(gameState);
  return { ok: true };
}

export function executeShoot(gameState, pieceId) {
  const guard = canAct(gameState, pieceId);
  if (!guard.ok) return guard;
  const piece = guard.piece;

  const info = getShotInfo(gameState, pieceId);
  if (!info.legal) {
    return { ok: false, reason: info.blocked ? "line_blocked" : "out_of_range" };
  }

  const opponentSide = opponentOf(piece.side);
  const goalCell = getGoalCell(opponentSide, gameState);

  const roll = 1 + Math.floor(Math.random() * 6);
  let modifier = 0;

  const keeper = gameState.pieces.find((p) => p.side === opponentSide && p.role === ROLE.GOALKEEPER);
  if (keeper && keeper.row === goalCell.row && keeper.col === goalCell.col) {
    modifier -= 1;
  }
  const opponentAdjacent = gameState.pieces.some(
    (p) => p.side !== piece.side && chebyshevDistance(p.row, p.col, piece.row, piece.col) === 1,
  );
  if (opponentAdjacent) {
    modifier -= 1;
  }

  let isGoal;
  if (roll === 6) {
    isGoal = true;
  } else if (roll === 1) {
    isGoal = false;
  } else {
    isGoal = roll + modifier >= info.needed;
  }

  if (isGoal) {
    scoreGoal(gameState, piece.side);
  } else {
    giveBallToGoalkeeper(gameState, opponentSide);
  }

  finishAction(gameState);
  return {
    ok: true,
    roll,
    modifier,
    needed: info.needed,
    distance: info.distance,
    outcome: isGoal ? "goal" : "miss",
  };
}

export { chebyshevDistance, getGoalCell };
