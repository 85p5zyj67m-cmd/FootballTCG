import { createGameState, movePiece } from "./gameLogic.js";
import {
  renderPitch,
  renderPieces,
  renderTurnIndicator,
  fitPitchToViewport,
} from "./boardRenderer.js";

const gameState = createGameState();

const pitchEl = document.getElementById("pitch");
const turnIndicatorEl = document.getElementById("turn-indicator");
const boardWrapperEl = document.querySelector(".board-wrapper");

renderPitch(pitchEl, gameState);
renderPieces(pitchEl, gameState);
renderTurnIndicator(turnIndicatorEl, gameState);
fitPitchToViewport(boardWrapperEl, gameState);

window.addEventListener("resize", () => fitPitchToViewport(boardWrapperEl, gameState));

// Verschieben per Pointer-Events (mousedown -> mousemove -> mouseup) statt
// natives HTML5-Drag&Drop, da sich Letzteres unzuverlaessig ansteuern laesst.
let draggedPieceId = null;
let ghostEl = null;
let hoveredCell = null;

function startDrag(pieceId, token, pointerX, pointerY) {
  draggedPieceId = pieceId;

  const rect = token.getBoundingClientRect();
  ghostEl = token.cloneNode(true);
  ghostEl.classList.add("piece-ghost");
  ghostEl.style.width = `${rect.width}px`;
  ghostEl.style.height = `${rect.height}px`;
  document.body.appendChild(ghostEl);
  moveGhostTo(pointerX, pointerY);

  token.classList.add("piece-dragging");
}

function moveGhostTo(pointerX, pointerY) {
  if (!ghostEl) return;
  ghostEl.style.left = `${pointerX}px`;
  ghostEl.style.top = `${pointerY}px`;
}

function setHoveredCell(cell) {
  if (hoveredCell === cell) return;
  if (hoveredCell) hoveredCell.classList.remove("drag-over");
  hoveredCell = cell;
  if (hoveredCell) hoveredCell.classList.add("drag-over");
}

function endDrag(pointerX, pointerY) {
  if (hoveredCell) hoveredCell.classList.remove("drag-over");
  hoveredCell = null;

  if (ghostEl) {
    ghostEl.remove();
    ghostEl = null;
  }

  const dropTarget = document.elementFromPoint(pointerX, pointerY);
  const cell = dropTarget ? dropTarget.closest(".cell") : null;
  if (cell) {
    movePiece(gameState, draggedPieceId, Number(cell.dataset.row), Number(cell.dataset.col));
  }

  draggedPieceId = null;
  renderPieces(pitchEl, gameState);
}

pitchEl.addEventListener("mousedown", (event) => {
  const token = event.target.closest(".piece");
  if (!token) return;
  event.preventDefault();
  startDrag(token.dataset.pieceId, token, event.clientX, event.clientY);
});

window.addEventListener("mousemove", (event) => {
  if (!draggedPieceId) return;
  moveGhostTo(event.clientX, event.clientY);

  const target = document.elementFromPoint(event.clientX, event.clientY);
  setHoveredCell(target ? target.closest(".cell") : null);
});

window.addEventListener("mouseup", (event) => {
  if (!draggedPieceId) return;
  endDrag(event.clientX, event.clientY);
});
