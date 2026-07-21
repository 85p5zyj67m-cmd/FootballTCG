// Einfache, regelbasierte KI-Gegnerlogik. Nutzt ausschliesslich die
// oeffentlichen Abfrage-/Aktionsfunktionen aus gameLogic.js - die KI hat also
// keine Sonderrechte und muss sich an dieselben Regeln halten wie der Mensch.

import {
  SIDE,
  getPieceById,
  getLegalMoveCells,
  getLegalPassTargets,
  getLegalTackleTarget,
  getShotInfo,
  getGoalCell,
  chebyshevDistance,
  executeMove,
  executePass,
  executeTackle,
  executeShoot,
  playCard,
  resolveAuszeitDiscard,
} from "./gameLogic.js";

function opponentOf(side) {
  return side === SIDE.BOTTOM ? SIDE.TOP : SIDE.BOTTOM;
}

function closestCellTo(cells, targetRow, targetCol) {
  let best = null;
  let bestDistance = Infinity;
  for (const cell of cells) {
    const distance = chebyshevDistance(cell.row, cell.col, targetRow, targetCol);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  }
  return best;
}

// Sehr einfache Kartenwahl - deckt nicht jede Karte ab, sondern nur die
// Faelle, in denen der Nutzen fuer die KI offensichtlich/eindeutig ist:
// - Torwartparade proaktiv, solange noch nicht aktiv und der Gegner den
//   Ball hat (bereitet den naechsten gegnerischen Schuss vor).
// - Teamwork, wenn die KI selbst den Ball haelt (mehr Handlungsspielraum).
// - Sprint auf den eigenen Ballfuehrer, um schneller Richtung Tor zu kommen.
// Alle anderen Karten haelt die KI zurueck bzw. spielt sie gar nicht aus.
function tryPlayCard(gameState, aiSide) {
  const hand = gameState.cardPiles[aiSide].hand;
  if (hand.length === 0) return null;

  const carrierId = gameState.ball.possessorId;
  const carrier = carrierId ? getPieceById(gameState, carrierId) : null;
  const iHaveBall = Boolean(carrier && carrier.side === aiSide);

  const torwartparade = hand.find((c) => c.cardId === "torwartparade");
  if (torwartparade && !iHaveBall && gameState.effects.keeperBoostSide !== aiSide) {
    return { instanceId: torwartparade.instanceId, target: null };
  }

  const teamwork = hand.find((c) => c.cardId === "teamwork");
  if (teamwork && iHaveBall) {
    return { instanceId: teamwork.instanceId, target: null };
  }

  const sprint = hand.find((c) => c.cardId === "sprint");
  if (sprint && iHaveBall) {
    return { instanceId: sprint.instanceId, target: { pieceId: carrier.id } };
  }

  return null;
}

// Spielt hoechstens 1 Karte (Regel: 1 Karte pro Zug) und loest eine dadurch
// noetige Auszeit-Abwurfwahl direkt mit auf (einfachste verfuegbare Karte).
export function maybePlayAiCard(gameState, aiSide) {
  if (gameState.cardPlayedThisTurn) return null;
  const choice = tryPlayCard(gameState, aiSide);
  if (!choice) return null;

  const result = playCard(gameState, aiSide, choice.instanceId, choice.target);
  if (result.ok && gameState.pendingDiscard === aiSide) {
    const hand = gameState.cardPiles[aiSide].hand;
    if (hand.length > 0) {
      resolveAuszeitDiscard(gameState, aiSide, hand[0].instanceId);
    }
  }
  return result.ok ? { ...result, type: "card" } : null;
}

// Entscheidet eine einzelne Aktion fuer die KI-Seite. Prioritaet:
// 1. Schuss, falls moeglich. 2. Pass Richtung Tor. 3. Tackling, falls in
// Ballnaehe des Gegners. 4. Sonst Bewegung Richtung Ball/Tor.
function pickAction(gameState, aiSide) {
  const opponentSide = opponentOf(aiSide);
  const goalCell = getGoalCell(opponentSide, gameState);

  const carrierId = gameState.ball.possessorId;
  const carrier = carrierId ? getPieceById(gameState, carrierId) : null;
  const iHaveBall = carrier && carrier.side === aiSide;

  if (iHaveBall) {
    const shotInfo = getShotInfo(gameState, carrier.id);
    if (shotInfo.legal) {
      return { type: "shoot", pieceId: carrier.id };
    }

    const passTargets = getLegalPassTargets(gameState, carrier.id);
    if (passTargets.length > 0) {
      let bestId = null;
      let bestDistance = Infinity;
      for (const id of passTargets) {
        const mate = getPieceById(gameState, id);
        const distance = chebyshevDistance(mate.row, mate.col, goalCell.row, goalCell.col);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = id;
        }
      }
      return { type: "pass", fromId: carrier.id, toId: bestId };
    }

    const moveCells = getLegalMoveCells(gameState, carrier.id);
    const bestCell = closestCellTo(moveCells, goalCell.row, goalCell.col);
    if (bestCell) {
      return { type: "move", pieceId: carrier.id, row: bestCell.row, col: bestCell.col };
    }
    return null;
  }

  const myPieces = gameState.pieces.filter((p) => p.side === aiSide);
  for (const piece of myPieces) {
    if (getLegalTackleTarget(gameState, piece.id)) {
      return { type: "tackle", pieceId: piece.id };
    }
  }

  let closestPiece = null;
  let closestDistance = Infinity;
  for (const piece of myPieces) {
    const distance = chebyshevDistance(piece.row, piece.col, gameState.ball.row, gameState.ball.col);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPiece = piece;
    }
  }
  if (!closestPiece) return null;

  const moveCells = getLegalMoveCells(gameState, closestPiece.id);
  const bestCell = closestCellTo(moveCells, gameState.ball.row, gameState.ball.col);
  if (!bestCell) return null;
  return { type: "move", pieceId: closestPiece.id, row: bestCell.row, col: bestCell.col };
}

// Fuehrt genau eine KI-Aktion aus und gibt das Ergebnis (inkl. Aktionstyp)
// zurueck, damit der Aufrufer eine Nachricht anzeigen und neu rendern kann.
export function performAiAction(gameState, aiSide) {
  const action = pickAction(gameState, aiSide);
  if (!action) return { ok: false, type: null };

  switch (action.type) {
    case "shoot":
      return { ...executeShoot(gameState, action.pieceId), type: "shoot" };
    case "pass":
      return { ...executePass(gameState, action.fromId, action.toId), type: "pass" };
    case "tackle":
      return { ...executeTackle(gameState, action.pieceId), type: "tackle" };
    case "move":
      return { ...executeMove(gameState, action.pieceId, action.row, action.col), type: "move" };
    default:
      return { ok: false, type: null };
  }
}
