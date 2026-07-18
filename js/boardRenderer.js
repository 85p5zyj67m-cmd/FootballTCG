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

  const halfwayRow = Math.ceil(gameState.rows / 2);

  for (let row = 1; row <= gameState.rows; row++) {
    for (let col = 1; col <= gameState.cols; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (row === halfwayRow) {
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
  container.appendChild(goalBottom);
}

export function renderTurnIndicator(el, gameState) {
  const current = gameState.players.find((p) => p.id === gameState.currentPlayerId);
  const sideLabel = current.side === SIDE.BOTTOM ? "unten" : "oben";
  const youLabel = current.id === gameState.localPlayerId ? " (du)" : "";
  el.textContent = `Spieler ${current.id} (${sideLabel})${youLabel} ist am Zug`;
}
