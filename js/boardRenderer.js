// Spielseitenlayout: erzeugt und aktualisiert das DOM auf Basis des
// Spielzustands aus gameLogic.js. Enthaelt selbst keine Spielregeln.

import { SIDE, GOAL_COLUMN } from "./gameLogic.js";

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
  container.querySelectorAll(".cell.crowded").forEach((el) => el.classList.remove("crowded"));

  const piecesByCell = new Map();
  for (const piece of gameState.pieces) {
    const key = `${piece.row},${piece.col}`;
    if (!piecesByCell.has(key)) {
      piecesByCell.set(key, []);
    }
    piecesByCell.get(key).push(piece);
  }

  for (const [key, pieces] of piecesByCell) {
    const [row, col] = key.split(",");
    const cell = container.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) continue;

    if (pieces.length > 1) {
      cell.classList.add("crowded");
    }

    for (const piece of pieces) {
      const token = document.createElement("div");
      token.className = `piece team-${piece.side}`;
      token.dataset.pieceId = piece.id;
      token.textContent = piece.id.split("-")[1];
      cell.appendChild(token);
    }
  }
}

export function renderTurnIndicator(el, gameState) {
  const current = gameState.players.find((p) => p.id === gameState.currentPlayerId);
  const sideLabel = current.side === SIDE.BOTTOM ? "unten" : "oben";
  const youLabel = current.id === gameState.localPlayerId ? " (du)" : "";
  el.textContent = `Spieler ${current.id} (${sideLabel})${youLabel} ist am Zug`;
}
