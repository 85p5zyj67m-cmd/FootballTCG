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

// Auf Touchgeraeten kann eine Figur per Tippen ausgewaehlt und anschliessend
// durch Tippen auf ein Zielfeld bewegt werden. Die Maussteuerung per Ziehen
// bleibt fuer Desktop-Nutzer erhalten.
let selectedPieceId = null;
let draggedPieceId = null;
let ghostEl = null;
let hoveredCell = null;
let dragStartX = 0;
let dragStartY = 0;
let didDrag = false;

function renderGame() {
  renderPieces(pitchEl, gameState);
  renderTurnIndicator(turnIndicatorEl, gameState);
  applySelection();
}

function applySelection() {
  pitchEl.querySelectorAll(".piece.selected").forEach((piece) => {
    piece.classList.remove("selected");
  });

  if (!selectedPieceId) return;
  const selectedPiece = pitchEl.querySelector(
    `.piece[data-piece-id="${selectedPieceId}"]`,
  );
  if (selectedPiece) selectedPiece.classList.add("selected");
}

function selectPiece(pieceId) {
  selectedPieceId = selectedPieceId === pieceId ? null : pieceId;
  applySelection();
}

function moveSelectedPiece(cell) {
  if (!selectedPieceId || !cell) return;

  movePiece(
    gameState,
    selectedPieceId,
    Number(cell.dataset.row),
    Number(cell.dataset.col),
  );
  selectedPieceId = null;
  renderGame();
}

function startDrag(pieceId, token, pointerX, pointerY) {
  draggedPieceId = pieceId;
  dragStartX = pointerX;
  dragStartY = pointerY;
  didDrag = false;

  const rect = token.getBoundingClientRect();
  ghostEl = token.cloneNode(true);
  ghostEl.classList.remove("selected");
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

  if (didDrag) {
    const dropTarget = document.elementFromPoint(pointerX, pointerY);
    const cell = dropTarget ? dropTarget.closest(".cell") : null;
    if (cell) {
      movePiece(
        gameState,
        draggedPieceId,
        Number(cell.dataset.row),
        Number(cell.dataset.col),
      );
      selectedPieceId = null;
    }
  } else {
    selectPiece(draggedPieceId);
  }

  draggedPieceId = null;
  renderGame();
}

pitchEl.addEventListener("pointerdown", (event) => {
  const token = event.target.closest(".piece");
  if (!token) return;

  event.preventDefault();
  startDrag(token.dataset.pieceId, token, event.clientX, event.clientY);
});

window.addEventListener("pointermove", (event) => {
  if (!draggedPieceId) return;

  const distance = Math.hypot(
    event.clientX - dragStartX,
    event.clientY - dragStartY,
  );
  if (distance > 8) didDrag = true;
  if (!didDrag) return;

  moveGhostTo(event.clientX, event.clientY);
  const target = document.elementFromPoint(event.clientX, event.clientY);
  setHoveredCell(target ? target.closest(".cell") : null);
});

window.addEventListener("pointerup", (event) => {
  if (!draggedPieceId) return;
  endDrag(event.clientX, event.clientY);
});

window.addEventListener("pointercancel", () => {
  if (!draggedPieceId) return;
  endDrag(dragStartX, dragStartY);
});

pitchEl.addEventListener("pointerup", (event) => {
  if (draggedPieceId || didDrag) return;
  const cell = event.target.closest(".cell");
  if (!cell || event.target.closest(".piece")) return;
  moveSelectedPiece(cell);
});
