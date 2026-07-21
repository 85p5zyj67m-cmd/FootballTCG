// Spielseitenlayout: erzeugt und aktualisiert das DOM auf Basis des
// Spielzustands aus gameLogic.js. Enthaelt selbst keine Spielregeln.

import { SIDE, GOAL_COLUMN, ACTIONS_PER_TURN, getCurrentPlayer } from "./gameLogic.js";

function addPitchMarking(container, className) {
  const marking = document.createElement("div");
  marking.className = `pitch-marking ${className}`;
  marking.setAttribute("aria-hidden", "true");
  container.appendChild(marking);
}

export function renderPitch(container, gameState) {
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${gameState.cols}, var(--cell-size))`;
  container.style.gridTemplateRows = `var(--goal-depth) repeat(${gameState.rows}, var(--cell-size)) var(--goal-depth)`;

  const goalTop = document.createElement("div");
  goalTop.className = "goal-zone top";
  goalTop.style.gridColumn = `${GOAL_COLUMN} / ${GOAL_COLUMN + 1}`;
  container.appendChild(goalTop);

  // Die Mittellinie liegt bei einer geraden Anzahl Reihen exakt zwischen
  // den beiden mittleren Reihen, also bei 14 Reihen zwischen 7 und 8.
  const firstRowBelowHalfway = Math.floor(gameState.rows / 2) + 1;

  for (let row = 1; row <= gameState.rows; row++) {
    for (let col = 1; col <= gameState.cols; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (row === firstRowBelowHalfway) {
        cell.classList.add("halfway-line");
      }
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.style.gridRow = row + 1;
      cell.style.gridColumn = col;
      container.appendChild(cell);
    }
  }

  // Reine Dekoration: Strafraeume, Torraeume, Punkte und Mittelkreis liegen
  // ueber dem Raster, nehmen aber keine Zeigerereignisse entgegen.
  [
    "penalty-area top",
    "penalty-area bottom",
    "goal-area top",
    "goal-area bottom",
    "penalty-spot top",
    "penalty-spot bottom",
    "penalty-arc top",
    "penalty-arc bottom",
    "center-circle",
    "center-spot",
  ].forEach((className) => addPitchMarking(container, className));

  const goalBottom = document.createElement("div");
  goalBottom.className = "goal-zone bottom";
  goalBottom.style.gridColumn = `${GOAL_COLUMN} / ${GOAL_COLUMN + 1}`;
  goalBottom.style.gridRow = `${gameState.rows + 2} / ${gameState.rows + 3}`;
  container.appendChild(goalBottom);
}

// Berechnet die groesstmoegliche Zellgroesse, mit der das komplette
// Spielfeld (inkl. beider Tor-Streifen) ohne Scrollen in den verfuegbaren
// Platz von wrapperEl passt, und setzt sie als CSS-Variable.
const GOAL_DEPTH_RATIO = 0.5;

export function fitPitchToViewport(wrapperEl, gameState) {
  const styles = getComputedStyle(wrapperEl);
  const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const borderWidth = 6; // 2 * 3px Pitch-Rahmen

  const availableWidth = wrapperEl.clientWidth - paddingX - borderWidth;
  const availableHeight = wrapperEl.clientHeight - paddingY - borderWidth;

  const rowUnits = gameState.rows + 2 * GOAL_DEPTH_RATIO;
  const cellFromWidth = availableWidth / gameState.cols;
  const cellFromHeight = availableHeight / rowUnits;

  const cellSize = Math.max(8, Math.floor(Math.min(cellFromWidth, cellFromHeight)));

  document.documentElement.style.setProperty("--cell-size", `${cellSize}px`);
  document.documentElement.style.setProperty("--goal-depth", `${cellSize * GOAL_DEPTH_RATIO}px`);
}

export function renderPieces(container, gameState) {
  container.querySelectorAll(".piece").forEach((el) => el.remove());

  for (const piece of gameState.pieces) {
    const cell = container.querySelector(
      `.cell[data-row="${piece.row}"][data-col="${piece.col}"]`,
    );
    if (!cell) continue;

    const token = document.createElement("div");
    token.className = `piece team-${piece.side} role-${piece.role}`;
    token.dataset.pieceId = piece.id;
    token.textContent = piece.id.split("-")[1];
    cell.appendChild(token);
  }
}

export function renderBall(container, gameState) {
  container.querySelectorAll(".ball").forEach((el) => el.remove());

  const { row, col } = gameState.ball;
  const cell = container.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  const ball = document.createElement("div");
  ball.className = "ball";
  cell.appendChild(ball);
}

export function renderTurnIndicator(el, gameState) {
  if (gameState.winner) {
    const winnerLabel = gameState.winner === SIDE.BOTTOM ? "Unten" : "Oben";
    el.textContent = `Spiel vorbei - Team ${winnerLabel} gewinnt!`;
    return;
  }

  const current = getCurrentPlayer(gameState);
  const sideLabel = current.side === SIDE.BOTTOM ? "unten" : "oben";
  const youLabel = current.isAI ? " (KI)" : current.id === gameState.localPlayerId ? " (du)" : "";
  el.textContent = `Spieler ${current.id} (${sideLabel})${youLabel} ist am Zug - Aktionen: ${gameState.actionsRemaining}/${ACTIONS_PER_TURN}`;
}

export function renderScore(el, gameState) {
  el.textContent = `Unten ${gameState.score[SIDE.BOTTOM]} : ${gameState.score[SIDE.TOP]} Oben`;
}

export function renderHand(handEl, opponentInfoEl, ownDeckInfoEl, gameState, humanSide, selectedInstanceId) {
  handEl.innerHTML = "";
  const pile = gameState.cardPiles[humanSide];
  const discardMode = gameState.pendingDiscard === humanSide;
  const current = getCurrentPlayer(gameState);
  const canPlay = !discardMode && !gameState.winner && !current.isAI;

  for (const card of pile.hand) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `card card-${card.category}`;
    if (card.instanceId === selectedInstanceId) tile.classList.add("card-selected");
    if (discardMode) tile.classList.add("card-discardable");
    tile.disabled = !discardMode && !canPlay;
    tile.dataset.instanceId = card.instanceId;

    const nameEl = document.createElement("span");
    nameEl.className = "card-name";
    nameEl.textContent = card.name;
    const descEl = document.createElement("span");
    descEl.className = "card-desc";
    descEl.textContent = card.description;
    tile.append(nameEl, descEl);

    handEl.appendChild(tile);
  }

  ownDeckInfoEl.textContent = `Dein Deck: ${pile.deck.length} Karten (${pile.discard.length} im Ablagestapel)`;

  const opponentSide = humanSide === SIDE.BOTTOM ? SIDE.TOP : SIDE.BOTTOM;
  const opponentPile = gameState.cardPiles[opponentSide];
  opponentInfoEl.textContent = `Gegner-Hand: ${opponentPile.hand.length} Karte(n), Deck: ${opponentPile.deck.length}`;
}
