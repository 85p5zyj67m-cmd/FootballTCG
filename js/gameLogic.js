// Reine Spiellogik & Zustand - keine DOM-Zugriffe hier.
// Regeln entsprechend "Football TCG - Prototyp Regeln v0.1" + Aktionskarten.

import { buildDeck, shuffle, CARD_DEFINITIONS } from "./cards.js";

const CARD_BY_ID = Object.fromEntries(CARD_DEFINITIONS.map((def) => [def.cardId, def]));

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
export const MOVE_MAX_DISTANCE = 4; // kreisfoermiger Radius (Luftlinie), wie beim Passen
export const PASS_MAX_DISTANCE = 4; // quadratischer Bereich (Chebyshev-Distanz): 4 Felder in jede der 8 Richtungen
export const SHOOT_MAX_DISTANCE = 3;
export const WINNING_SCORE = 3;
export const STARTING_HAND_SIZE = 4;
export const MAX_HAND_SIZE = 8;

// Benoetigter W6-Wurf je Entfernung zum Tor (Index = Feld-Entfernung).
// Eintrag 4 existiert nur wegen der Karte "Fernschuss" (Basisregeln decken
// nur 1-3 ab) und setzt das Muster distanz+2 einfach fort.
const SHOOT_THRESHOLDS = { 1: 3, 2: 4, 3: 5, 4: 6 };

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

// Positions-Tag je Reihen-Linie - wird von den "Nudge"-Karten (Abwehrblock,
// Sturmlauf, Mittelfeldwechsel, Torwartsprung) genutzt, um die passende
// Zielposition (DEF/MID/FWD/GK) zu erkennen, sonst ungenutzt.
function positionForRow(side, row) {
  if (side === SIDE.TOP) {
    if (row === 1) return "GK";
    if (row === 3) return "DEF";
    if (row === 5) return "MID";
    return "FWD";
  }
  if (row === 14) return "GK";
  if (row === 12) return "DEF";
  if (row === 10) return "MID";
  return "FWD";
}

function layoutTeam(side) {
  return FORMATION_BY_SIDE[side].map(({ number, row, col }) => ({
    id: `${side}-${number}`,
    side,
    row,
    col,
    role: number === 1 ? ROLE.GOALKEEPER : ROLE.FIELD,
    position: positionForRow(side, row),
  }));
}

function chebyshevDistance(row1, col1, row2, col2) {
  return Math.max(Math.abs(row1 - row2), Math.abs(col1 - col2));
}

// Echte Luftlinie (kreisfoermiger Radius) - fuer Passen, das an keine der 8
// Kompassrichtungen gebunden sein soll.
function circularDistance(row1, col1, row2, col2) {
  return Math.hypot(row1 - row2, col1 - col2);
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

function getGoalCell(side, gameState) {
  return side === SIDE.TOP
    ? { row: 1, col: GOAL_COLUMN }
    : { row: gameState.rows, col: GOAL_COLUMN };
}

function opponentOf(side) {
  return side === SIDE.BOTTOM ? SIDE.TOP : SIDE.BOTTOM;
}

// Wie weit eine Reihe in Angriffsrichtung dieser Seite fortgeschritten ist
// (hoeher = naeher am gegnerischen Tor). Fuer beide Seiten einheitlich
// vergleichbar, da nur relativ zur eigenen Angriffsrichtung verwendet.
function attackProgress(side, row, rows) {
  return side === SIDE.BOTTOM ? rows - row : row - 1;
}

// Normale Abseitsregel: Der Empfaenger eines Passes darf nicht naeher am
// gegnerischen Tor stehen als sowohl der Ball (= Position des Passgebers)
// als auch der vorletzte Gegenspieler (hier vereinfacht: der am tiefsten
// stehende gegnerische Feldspieler, der Torwart zaehlt nicht mit). In der
// eigenen Haelfte kann man nie im Abseits stehen; Gleichstand zaehlt nicht
// als Abseits (Vorteil fuer den Angreifer).
function isPassOffside(gameState, passer, receiver) {
  const side = passer.side;
  const halfwayRow = Math.floor(gameState.rows / 2);
  const inOwnHalf = side === SIDE.BOTTOM ? receiver.row > halfwayRow : receiver.row <= halfwayRow;
  if (inOwnHalf) return false;

  const opponentSide = opponentOf(side);
  const defenders = gameState.pieces.filter(
    (p) => p.side === opponentSide && p.role !== ROLE.GOALKEEPER,
  );
  if (defenders.length === 0) return false;

  const progress = (row) => attackProgress(side, row, gameState.rows);
  const receiverProgress = progress(receiver.row);
  const ballProgress = progress(passer.row);
  const defenderLineProgress = Math.max(...defenders.map((d) => progress(d.row)));

  return receiverProgress > ballProgress && receiverProgress > defenderLineProgress;
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

// Tackling ist nur erlaubt, wenn der Verteidiger schon VOR seiner eigenen
// Bewegung in diesem Zug neben dem gegnerischen Ballfuehrer stand - diese
// Momentaufnahme wird bei Zugbeginn (und nach einem Tor-Reset) erstellt und
// verliert eine Figur, sobald sie sich in diesem Zug bewegt (siehe
// executeMove/executePieceNudge). Graetsche hebt die Einschraenkung auf.
function computeTackleEligiblePieceIds(gameState, side) {
  const carrierId = gameState.ball.possessorId;
  if (!carrierId) return [];
  const carrier = getPieceById(gameState, carrierId);
  if (!carrier || carrier.side === side) return [];
  return gameState.pieces
    .filter((p) => p.side === side && chebyshevDistance(p.row, p.col, carrier.row, carrier.col) <= 1)
    .map((p) => p.id);
}

// --- Karten: Deck/Hand-Verwaltung ---

function drawCardsForSide(gameState, side, count) {
  const pile = gameState.cardPiles[side];
  for (let i = 0; i < count; i++) {
    if (pile.hand.length >= MAX_HAND_SIZE) break;
    if (pile.deck.length === 0) {
      if (pile.discard.length === 0) break;
      pile.deck = shuffle(pile.discard);
      pile.discard = [];
    }
    pile.hand.push(pile.deck.pop());
  }
}

function emptyEffects() {
  return {
    extraMovementPieceIds: [], // Sprint - Array, da beliebig viele Karten/Zug erlaubt sind
    extraRangePieceIds: [], // Fernschuss - Array, aus demselben Grund
    doppelpassArmed: false,
    steilpassArmed: false,
    seitenwechselArmed: false,
    graetscheArmed: false,
    konterArmed: false,
    pressedPieceIds: [], // Pressing - ueberdauert Zugwechsel bewusst
    keeperBoostSide: null, // Torwartparade - ueberdauert Zugwechsel bewusst
  };
}

// Setzt alle "nur fuer diesen Zug" gueltigen Karteneffekte zurueck.
// pressedPieceIds/keeperBoostSide sind bewusst NICHT enthalten, da sie
// ueber Zugwechsel hinweg bestehen bleiben sollen (siehe switchTurn).
function clearThisTurnEffects(gameState) {
  gameState.effects.extraMovementPieceIds = [];
  gameState.effects.extraRangePieceIds = [];
  gameState.effects.doppelpassArmed = false;
  gameState.effects.steilpassArmed = false;
  gameState.effects.seitenwechselArmed = false;
  gameState.effects.graetscheArmed = false;
  gameState.effects.konterArmed = false;
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
    cardPiles: {
      [SIDE.BOTTOM]: { deck: buildDeck(), hand: [], discard: [] },
      [SIDE.TOP]: { deck: buildDeck(), hand: [], discard: [] },
    },
    pendingDiscard: null,
    effects: emptyEffects(),
    bonusActions: [],
    tackleEligiblePieceIds: [],
  };
  placeKickoff(gameState, SIDE.BOTTOM);
  drawCardsForSide(gameState, SIDE.BOTTOM, STARTING_HAND_SIZE);
  drawCardsForSide(gameState, SIDE.TOP, STARTING_HAND_SIZE);
  gameState.tackleEligiblePieceIds = computeTackleEligiblePieceIds(gameState, SIDE.BOTTOM);
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

function canAct(gameState, pieceId, actionType) {
  if (gameState.winner) return { ok: false, reason: "game_over" };
  if (gameState.pendingDiscard) return { ok: false, reason: "pending_discard" };
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return { ok: false, reason: "not_found" };
  const currentPlayer = getCurrentPlayer(gameState);
  if (piece.side !== currentPlayer.side) return { ok: false, reason: "not_your_turn" };
  const hasBonus = gameState.bonusActions.some((b) => b.type === "any" || b.type === actionType);
  if (gameState.actionsRemaining <= 0 && !hasBonus) return { ok: false, reason: "no_actions_left" };
  return { ok: true, piece };
}

// Verbraucht eine Bonus-Aktion falls vorhanden, sonst eine reguraere Aktion.
// Der Zug wechselt erst, wenn sowohl die regulaeren als auch alle Bonus-
// Aktionen aufgebraucht sind.
function finishAction(gameState, actionType) {
  const bonusIndex = gameState.bonusActions.findIndex(
    (b) => b.type === "any" || b.type === actionType,
  );
  if (bonusIndex !== -1) {
    gameState.bonusActions.splice(bonusIndex, 1);
  } else {
    gameState.actionsRemaining -= 1;
  }
  if (gameState.actionsRemaining <= 0 && gameState.bonusActions.length === 0 && !gameState.winner) {
    switchTurn(gameState);
  }
}

function switchTurn(gameState) {
  const endingSide = getCurrentPlayer(gameState).side;
  gameState.currentPlayerId = gameState.currentPlayerId === 1 ? 2 : 1;
  gameState.actionsRemaining = ACTIONS_PER_TURN;
  gameState.bonusActions = [];
  clearThisTurnEffects(gameState);
  // Pressing gilt nur fuer den naechsten Zug der betroffenen Seite - laeuft
  // jetzt ab, egal ob die Figur bewegt wurde oder nicht.
  gameState.effects.pressedPieceIds = gameState.effects.pressedPieceIds.filter((id) => {
    const piece = getPieceById(gameState, id);
    return piece && piece.side !== endingSide;
  });

  const newSide = getCurrentPlayer(gameState).side;
  drawCardsForSide(gameState, newSide, 1);
  gameState.tackleEligiblePieceIds = computeTackleEligiblePieceIds(gameState, newSide);
}

// Beendet den aktuellen Zug sofort (z.B. "Zug beenden"-Button oder eine KI,
// die keinen Zug mehr findet) - verwirft dabei auch ungenutzte Bonus-Aktionen.
export function endTurnNow(gameState) {
  if (gameState.winner || gameState.pendingDiscard) return;
  switchTurn(gameState);
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
  // Der Zug laeuft nach einem Tor weiter (siehe finishAction) - die
  // Momentaufnahme fuer Tackling muss auf Basis der frischen Formation neu
  // berechnet werden, sonst zaehlen alte (jetzt bedeutungslose) Positionen.
  gameState.tackleEligiblePieceIds = computeTackleEligiblePieceIds(gameState, scoringSide);
}

// --- Abfragen (rein lesend, fuer UI-Hervorhebung und KI-Entscheidungen) ---

// Bewegung ist wie Passen an keine der 8 Kompassrichtungen gebunden: jedes
// Feld innerhalb eines kreisfoermigen Radius (Luftlinie) ist erreichbar,
// sofern kein anderer Spieler auf der direkten Sichtlinie steht.
export function getLegalMoveCells(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return [];

  const isPressed = gameState.effects.pressedPieceIds.includes(pieceId);
  const isSprinting = gameState.effects.extraMovementPieceIds.includes(pieceId);
  const maxDistance = isPressed ? 1 : isSprinting ? MOVE_MAX_DISTANCE + 2 : MOVE_MAX_DISTANCE;

  const results = [];
  const range = Math.ceil(maxDistance);
  for (let row = piece.row - range; row <= piece.row + range; row++) {
    for (let col = piece.col - range; col <= piece.col + range; col++) {
      if (row === piece.row && col === piece.col) continue;
      if (!isCellOnBoard(row, col, gameState)) continue;

      const distance = circularDistance(piece.row, piece.col, row, col);
      if (distance > maxDistance) continue;
      if (getPiecesAtCell(gameState, row, col).length >= MAX_PIECES_PER_CELL) continue;

      const line = getLineCells(piece.row, piece.col, row, col).slice(1, -1);
      const blocked = line.some((c) => getPiecesAtCell(gameState, c.row, c.col).length > 0);
      if (blocked) continue;

      results.push({ row, col });
    }
  }
  return results;
}

// Passen ist an keine der 8 Kompassrichtungen gebunden: jeder Mitspieler
// innerhalb eines kreisfoermigen Radius von PASS_MAX_DISTANCE Feldern
// (Luftlinie) ist anspielbar, sofern die Sichtlinie frei ist.
export function getLegalPassTargets(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece || gameState.ball.possessorId !== pieceId) return [];

  const unlimitedRange = gameState.effects.seitenwechselArmed;
  const anyPieceBlocks = gameState.effects.seitenwechselArmed;
  const allowedOpponentBlockers = gameState.effects.steilpassArmed ? 1 : 0;
  const maxDistance = unlimitedRange ? Infinity : PASS_MAX_DISTANCE;

  const teammates = gameState.pieces.filter((p) => p.side === piece.side && p.id !== pieceId);
  const results = [];
  for (const mate of teammates) {
    // Quadratischer Bereich: 4 Felder in jede der 8 Richtungen definieren die
    // Eckpunkte eines Quadrats um den Passgeber - Chebyshev-Distanz, nicht
    // Luftlinie, sonst waeren die diagonalen Ecken (z.B. 4 rechts + 4 hoch)
    // ausserhalb der Reichweite.
    const distance = chebyshevDistance(piece.row, piece.col, mate.row, mate.col);
    if (distance > maxDistance) continue;

    const line = getLineCells(piece.row, piece.col, mate.row, mate.col).slice(1, -1);
    let blockingCount = 0;
    for (const c of line) {
      const occupants = getPiecesAtCell(gameState, c.row, c.col);
      blockingCount += anyPieceBlocks
        ? occupants.length
        : occupants.filter((p) => p.side !== piece.side).length;
    }
    if (blockingCount > allowedOpponentBlockers) continue;
    if (isPassOffside(gameState, piece, mate)) continue;

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

  // Nur erlaubt, wenn die Figur schon VOR ihrer eigenen Bewegung in diesem
  // Zug neben dem Ballfuehrer stand - Graetsche hebt das auf.
  if (!gameState.effects.graetscheArmed && !gameState.tackleEligiblePieceIds.includes(pieceId)) {
    return null;
  }

  const maxDistance = gameState.effects.graetscheArmed ? 2 : 1;
  if (chebyshevDistance(piece.row, piece.col, carrier.row, carrier.col) > maxDistance) return null;
  return carrier.id;
}

export function getShotInfo(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece || gameState.ball.possessorId !== pieceId) return { legal: false };

  const opponentSide = opponentOf(piece.side);
  const goalCell = getGoalCell(opponentSide, gameState);
  const extendedRange = gameState.effects.extraRangePieceIds.includes(pieceId);
  const maxDistance = extendedRange ? SHOOT_MAX_DISTANCE + 1 : SHOOT_MAX_DISTANCE;
  const distance = chebyshevDistance(piece.row, piece.col, goalCell.row, goalCell.col);
  if (distance > maxDistance) return { legal: false, distance };

  const line = getLineCells(piece.row, piece.col, goalCell.row, goalCell.col).slice(1, -1);
  const blocked = line.some((c) => getPiecesAtCell(gameState, c.row, c.col).length > 0);
  if (blocked) return { legal: false, distance, blocked: true };

  return { legal: true, distance, needed: SHOOT_THRESHOLDS[distance] };
}

// Ermittelt Schwelle und Modifikatoren fuer einen Schuss - geteilt zwischen
// der Vorschau (getShotOdds) und der eigentlichen Ausfuehrung (executeShoot),
// damit beide garantiert dieselbe Rechnung verwenden.
function computeShotModifiers(gameState, piece, opponentSide, info) {
  const goalCell = getGoalCell(opponentSide, gameState);
  const keeper = gameState.pieces.find((p) => p.side === opponentSide && p.role === ROLE.GOALKEEPER);
  const keeperOnGoal = Boolean(keeper && keeper.row === goalCell.row && keeper.col === goalCell.col);
  const needed = keeperOnGoal ? info.needed : 2;

  let modifier = 0;
  const opponentAdjacent = gameState.pieces.some(
    (p) => p.side !== piece.side && chebyshevDistance(p.row, p.col, piece.row, piece.col) === 1,
  );
  if (opponentAdjacent) modifier -= 1;

  const keeperBoosted = gameState.effects.keeperBoostSide === opponentSide;
  if (keeperBoosted) modifier -= 2;

  return { needed, modifier, keeperOnGoal, opponentAdjacent, keeperBoosted };
}

// Trefferwahrscheinlichkeit fuer die aktuelle Situation, ohne zu wuerfeln -
// fuer eine Vorschau in der UI, bevor tatsaechlich geschossen wird.
export function getShotOdds(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  const info = getShotInfo(gameState, pieceId);
  if (!info.legal) return { legal: false, blocked: info.blocked };

  const opponentSide = opponentOf(piece.side);
  const { needed, modifier, keeperOnGoal, opponentAdjacent, keeperBoosted } = computeShotModifiers(
    gameState,
    piece,
    opponentSide,
    info,
  );

  let successCount = 1; // natuerliche 6 trifft immer
  for (let roll = 2; roll <= 5; roll++) {
    if (roll + modifier >= needed) successCount++;
  }

  return {
    legal: true,
    distance: info.distance,
    needed,
    modifier,
    keeperOnGoal,
    opponentAdjacent,
    keeperBoosted,
    probability: successCount / 6,
  };
}

// Verallgemeinerte Version des "Abwehrblock"-Bewegungsmusters: jede Karte,
// die eine Figur sofort und kostenlos um `radius` Felder bewegt (Abwehrblock,
// Sturmlauf, Mittelfeldwechsel, Torwartsprung, Freilaufen), nutzt dieselbe
// Zellauswahl - nur der Radius unterscheidet sich.
export function getLegalNudgeCells(gameState, pieceId, radius = 1) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return [];

  const results = [];
  for (let row = piece.row - radius; row <= piece.row + radius; row++) {
    for (let col = piece.col - radius; col <= piece.col + radius; col++) {
      if (row === piece.row && col === piece.col) continue;
      if (!isCellOnBoard(row, col, gameState)) continue;
      if (chebyshevDistance(piece.row, piece.col, row, col) > radius) continue;
      if (getPiecesAtCell(gameState, row, col).length >= MAX_PIECES_PER_CELL) continue;

      const line = getLineCells(piece.row, piece.col, row, col).slice(1, -1);
      const blocked = line.some((c) => getPiecesAtCell(gameState, c.row, c.col).length > 0);
      if (blocked) continue;

      results.push({ row, col });
    }
  }
  return results;
}

// --- Aktionen (mutieren gameState, pruefen Zug/Aktionen-Berechtigung) ---

export function executeMove(gameState, pieceId, row, col) {
  const guard = canAct(gameState, pieceId, "move");
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

  gameState.effects.pressedPieceIds = gameState.effects.pressedPieceIds.filter((id) => id !== pieceId);
  gameState.tackleEligiblePieceIds = gameState.tackleEligiblePieceIds.filter((id) => id !== pieceId);

  finishAction(gameState, "move");
  return { ok: true };
}

export function executePass(gameState, fromPieceId, toPieceId) {
  const guard = canAct(gameState, fromPieceId, "pass");
  if (!guard.ok) return guard;

  const legalTargets = getLegalPassTargets(gameState, fromPieceId);
  if (!legalTargets.includes(toPieceId)) {
    return { ok: false, reason: "illegal_pass" };
  }

  const target = getPieceById(gameState, toPieceId);
  gameState.ball.possessorId = toPieceId;
  gameState.ball.row = target.row;
  gameState.ball.col = target.col;

  gameState.effects.steilpassArmed = false;
  gameState.effects.seitenwechselArmed = false;
  const grantDoppelpass = gameState.effects.doppelpassArmed;
  gameState.effects.doppelpassArmed = false;

  finishAction(gameState, "pass");
  if (grantDoppelpass) {
    gameState.bonusActions.push({ type: "pass" });
  }
  return { ok: true };
}

export function executeTackle(gameState, tacklerId) {
  const guard = canAct(gameState, tacklerId, "tackle");
  if (!guard.ok) return guard;

  const target = getLegalTackleTarget(gameState, tacklerId);
  if (!target) {
    return { ok: false, reason: "illegal_tackle" };
  }

  const tackler = getPieceById(gameState, tacklerId);
  const ballRow = gameState.ball.row;
  const ballCol = gameState.ball.col;

  // Der Ball springt deterministisch in der Verlaengerung der Tackling-
  // Richtung weg vom Tackler (Tackler links vom Ballfuehrer -> Ball rechts
  // davon). Nur wenn das Spielfeldende erreicht ist, entscheidet der
  // Zufall unter den verbleibenden Nachbarfeldern. Der Ball darf dabei auf
  // einem besetzten Feld landen - die dortige Figur bekommt ihn dann sofort.
  const dirRow = Math.sign(ballRow - tackler.row);
  const dirCol = Math.sign(ballCol - tackler.col);
  const preferredRow = ballRow + dirRow;
  const preferredCol = ballCol + dirCol;

  let landing;
  if (isCellOnBoard(preferredRow, preferredCol, gameState)) {
    landing = { row: preferredRow, col: preferredCol };
  } else {
    const onBoardNeighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const row = ballRow + dr;
        const col = ballCol + dc;
        if (isCellOnBoard(row, col, gameState)) onBoardNeighbors.push({ row, col });
      }
    }
    landing =
      onBoardNeighbors.length > 0
        ? onBoardNeighbors[Math.floor(Math.random() * onBoardNeighbors.length)]
        : { row: ballRow, col: ballCol };
  }

  gameState.ball.row = landing.row;
  gameState.ball.col = landing.col;
  const landingOccupants = getPiecesAtCell(gameState, landing.row, landing.col);
  gameState.ball.possessorId = landingOccupants.length > 0 ? landingOccupants[0].id : null;

  gameState.effects.graetscheArmed = false;
  const grantKonter = gameState.effects.konterArmed;
  gameState.effects.konterArmed = false;

  finishAction(gameState, "tackle");
  if (grantKonter) {
    gameState.bonusActions.push({ type: "any" });
  }
  return { ok: true };
}

export function executeShoot(gameState, pieceId) {
  const guard = canAct(gameState, pieceId, "shoot");
  if (!guard.ok) return guard;
  const piece = guard.piece;

  const info = getShotInfo(gameState, pieceId);
  if (!info.legal) {
    return { ok: false, reason: info.blocked ? "line_blocked" : "out_of_range" };
  }

  const opponentSide = opponentOf(piece.side);
  const roll = 1 + Math.floor(Math.random() * 6);
  const { needed, modifier, keeperOnGoal, keeperBoosted } = computeShotModifiers(
    gameState,
    piece,
    opponentSide,
    info,
  );

  let isGoal;
  if (roll === 6) {
    isGoal = true;
  } else if (roll === 1) {
    isGoal = false;
  } else {
    isGoal = roll + modifier >= needed;
  }

  if (isGoal) {
    scoreGoal(gameState, piece.side);
  } else {
    giveBallToGoalkeeper(gameState, opponentSide);
  }

  if (keeperBoosted) {
    gameState.effects.keeperBoostSide = null;
  }

  finishAction(gameState, "shoot");
  return {
    ok: true,
    roll,
    modifier,
    needed,
    keeperOnGoal,
    distance: info.distance,
    outcome: isGoal ? "goal" : "miss",
  };
}

// Bewegt eine Figur sofort um bis zu `radius` Felder, komplett kostenlos
// (zaehlt weder als reguraere noch als Bonus-Aktion) - Basis fuer alle
// "Nudge"-Karten (Abwehrblock, Sturmlauf, Mittelfeldwechsel, Torwartsprung,
// Freilaufen). `allowedPosition` (DEF/MID/FWD/GK) schraenkt optional ein,
// welche Position die Zielfigur haben muss; null erlaubt jede Position.
export function executePieceNudge(gameState, pieceId, row, col, { radius = 1, allowedPosition = null } = {}) {
  if (gameState.winner) return { ok: false, reason: "game_over" };
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return { ok: false, reason: "not_found" };
  if (piece.side !== getCurrentPlayer(gameState).side) return { ok: false, reason: "not_your_turn" };
  if (allowedPosition && piece.position !== allowedPosition) {
    return { ok: false, reason: "invalid_position" };
  }

  const legalCells = getLegalNudgeCells(gameState, pieceId, radius);
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
  gameState.tackleEligiblePieceIds = gameState.tackleEligiblePieceIds.filter((id) => id !== pieceId);
  return { ok: true };
}

// --- Karten spielen ---

function applyCardEffect(gameState, side, card, target) {
  if (card.targetType === "ownPieceNudge") {
    if (!target || target.row == null || target.col == null) {
      return { ok: false, reason: "invalid_target" };
    }
    const piece = getPieceById(gameState, target.pieceId);
    if (!piece || piece.side !== side) {
      return { ok: false, reason: "invalid_target" };
    }
    return executePieceNudge(gameState, piece.id, target.row, target.col, {
      radius: card.nudgeRadius ?? 1,
      allowedPosition: card.nudgePosition ?? null,
    });
  }

  switch (card.cardId) {
    case "sprint": {
      const piece = target && getPieceById(gameState, target.pieceId);
      if (!piece || piece.side !== side) return { ok: false, reason: "invalid_target" };
      if (!gameState.effects.extraMovementPieceIds.includes(piece.id)) {
        gameState.effects.extraMovementPieceIds.push(piece.id);
      }
      return { ok: true };
    }
    case "fernschuss": {
      const piece = target && getPieceById(gameState, target.pieceId);
      if (!piece || piece.side !== side) return { ok: false, reason: "invalid_target" };
      if (!gameState.effects.extraRangePieceIds.includes(piece.id)) {
        gameState.effects.extraRangePieceIds.push(piece.id);
      }
      return { ok: true };
    }
    case "pressing": {
      const piece = target && getPieceById(gameState, target.pieceId);
      if (!piece || piece.side === side) return { ok: false, reason: "invalid_target" };
      gameState.effects.pressedPieceIds.push(piece.id);
      return { ok: true };
    }
    case "doppelpass":
      gameState.effects.doppelpassArmed = true;
      return { ok: true };
    case "steilpass":
      gameState.effects.steilpassArmed = true;
      return { ok: true };
    case "seitenwechsel":
      gameState.effects.seitenwechselArmed = true;
      return { ok: true };
    case "graetsche":
      gameState.effects.graetscheArmed = true;
      return { ok: true };
    case "konter":
      gameState.effects.konterArmed = true;
      return { ok: true };
    case "torwartparade":
      gameState.effects.keeperBoostSide = side;
      return { ok: true };
    case "teamwork":
      gameState.bonusActions.push({ type: "any" });
      return { ok: true };
    case "auszeit":
      drawCardsForSide(gameState, side, 2);
      gameState.pendingDiscard = side;
      return { ok: true };
    default:
      return { ok: false, reason: "unknown_card" };
  }
}

// target-Form je nach Karte: null | {pieceId} | {pieceId, row, col}
export function playCard(gameState, side, instanceId, target) {
  if (gameState.winner) return { ok: false, reason: "game_over" };
  if (gameState.pendingDiscard) return { ok: false, reason: "pending_discard" };
  if (getCurrentPlayer(gameState).side !== side) return { ok: false, reason: "not_your_turn" };

  const pile = gameState.cardPiles[side];
  const handIndex = pile.hand.findIndex((c) => c.instanceId === instanceId);
  if (handIndex === -1) return { ok: false, reason: "card_not_in_hand" };
  const card = pile.hand[handIndex];

  const result = applyCardEffect(gameState, side, card, target);
  if (!result.ok) return result;

  pile.hand.splice(handIndex, 1);
  pile.discard.push(card);
  return { ok: true, cardName: card.name, ...result };
}

export function resolveAuszeitDiscard(gameState, side, instanceId) {
  if (gameState.pendingDiscard !== side) return { ok: false, reason: "no_pending_discard" };
  const pile = gameState.cardPiles[side];
  const idx = pile.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx === -1) return { ok: false, reason: "card_not_in_hand" };
  const [discarded] = pile.hand.splice(idx, 1);
  pile.discard.push(discarded);
  gameState.pendingDiscard = null;
  return { ok: true };
}

// Liefert eine fuer die UI lesbare Liste aller aktuell aktiven Karteneffekte
// (beider Seiten) - rein lesend, fuer eine "was wirkt gerade"-Anzeige.
export function getActiveEffects(gameState) {
  const effects = gameState.effects;
  const currentSideLabel = sideLabel(getCurrentPlayer(gameState).side);
  const list = [];

  for (const id of effects.extraMovementPieceIds) {
    list.push(`${CARD_BY_ID.sprint.icon} Sprint auf ${pieceLabel(gameState, id)}: +2 Bewegung diesen Zug`);
  }
  for (const id of effects.extraRangePieceIds) {
    list.push(`${CARD_BY_ID.fernschuss.icon} Fernschuss auf ${pieceLabel(gameState, id)}: Schussreichweite +1`);
  }
  if (effects.doppelpassArmed) {
    list.push(`${CARD_BY_ID.doppelpass.icon} Doppelpass (${currentSideLabel}): naechster Pass gewaehrt sofort einen weiteren`);
  }
  if (effects.steilpassArmed) {
    list.push(`${CARD_BY_ID.steilpass.icon} Steilpass (${currentSideLabel}): naechster Pass ignoriert 1 Gegner auf der Linie`);
  }
  if (effects.seitenwechselArmed) {
    list.push(`${CARD_BY_ID.seitenwechsel.icon} Seitenwechsel (${currentSideLabel}): naechster Pass ohne Reichweitenlimit`);
  }
  if (effects.graetscheArmed) {
    list.push(`${CARD_BY_ID.graetsche.icon} Graetsche (${currentSideLabel}): naechstes Tackling aus bis zu 2 Feldern`);
  }
  if (effects.konterArmed) {
    list.push(`${CARD_BY_ID.konter.icon} Konter (${currentSideLabel}): Extra-Aktion nach naechstem erfolgreichen Tackling`);
  }
  for (const id of effects.pressedPieceIds) {
    list.push(`${CARD_BY_ID.pressing.icon} Pressing auf ${pieceLabel(gameState, id)}: naechster Zug nur 1 Feld Bewegung`);
  }
  if (effects.keeperBoostSide) {
    list.push(
      `${CARD_BY_ID.torwartparade.icon} Torwartparade (${sideLabel(effects.keeperBoostSide)}): Torwart +2 Schussabwehr beim naechsten Schuss`,
    );
  }

  return list;
}

function sideLabel(side) {
  return side === SIDE.BOTTOM ? "Unten" : "Oben";
}

function pieceLabel(gameState, pieceId) {
  const piece = getPieceById(gameState, pieceId);
  if (!piece) return "?";
  return `${sideLabel(piece.side)} #${piece.id.split("-")[1]}`;
}

export { chebyshevDistance, getGoalCell };
