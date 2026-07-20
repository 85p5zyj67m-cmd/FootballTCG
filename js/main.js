import { createGameState, movePiece, moveBall } from "./gameLogic.js";
import {
  renderPitch,
  renderPieces,
  renderBall,
  renderTurnIndicator,
  fitPitchToViewport,
} from "./boardRenderer.js";

const gameState = createGameState();

const pitchEl = document.getElementById("pitch");
const turnIndicatorEl = document.getElementById("turn-indicator");
const boardWrapperEl = document.querySelector(".board-wrapper");

renderPitch(pitchEl, gameState);
renderPieces(pitchEl, gameState);
renderBall(pitchEl, gameState);
renderTurnIndicator(turnIndicatorEl, gameState);
fitPitchToViewport(boardWrapperEl, gameState);

window.addEventListener("resize", () => fitPitchToViewport(boardWrapperEl, gameState));

// Verschieben von Spielern UND Ball per Pointer-Events (mousedown -> mousemove
// -> mouseup). Auf Touchgeraeten kann ein Objekt stattdessen per Tippen
// ausgewaehlt und anschliessend durch Tippen auf ein Zielfeld bewegt werden.
let selectedItem = null;
let draggedItem = null;
let ghostEl = null;
let hoveredCell = null;
let dragStartX = 0;
let dragStartY = 0;
let didDrag = false;

function sameItem(a, b) {
  if (!a || !b) return a === b;
  return a.type === b.type && a.id === b.id;
}

function renderGame() {
  renderPieces(pitchEl, gameState);
  renderBall(pitchEl, gameState);
  renderTurnIndicator(turnIndicatorEl, gameState);
  applySelection();
}

function applySelection() {
  pitchEl.querySelectorAll(".piece.selected, .ball.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  if (!selectedItem) return;
  const selectedEl =
    selectedItem.type === "piece"
      ? pitchEl.querySelector(`.piece[data-piece-id="${selectedItem.id}"]`)
      : pitchEl.querySelector(".ball");
  if (selectedEl) selectedEl.classList.add("selected");
}

function selectItem(item) {
  selectedItem = sameItem(selectedItem, item) ? null : item;
  applySelection();
}

function moveSelectedItem(cell) {
  if (!selectedItem || !cell) return;

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (selectedItem.type === "piece") {
    movePiece(gameState, selectedItem.id, row, col);
  } else {
    moveBall(gameState, row, col);
  }
  selectedItem = null;
  renderGame();
}

function startDrag(item, token, pointerX, pointerY) {
  draggedItem = item;
  dragStartX = pointerX;
  dragStartY = pointerY;
  didDrag = false;

  const rect = token.getBoundingClientRect();
  ghostEl = token.cloneNode(true);
  ghostEl.classList.remove("selected");
  ghostEl.classList.add("drag-ghost");
  ghostEl.style.width = `${rect.width}px`;
  ghostEl.style.height = `${rect.height}px`;
  ghostEl.style.position = "fixed";
  ghostEl.style.bottom = "auto";
  ghostEl.style.right = "auto";
  document.body.appendChild(ghostEl);
  moveGhostTo(pointerX, pointerY);

  token.classList.add(item.type === "piece" ? "piece-dragging" : "ball-dragging");
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
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (draggedItem.type === "piece") {
        movePiece(gameState, draggedItem.id, row, col);
      } else {
        moveBall(gameState, row, col);
      }
      selectedItem = null;
    }
  } else {
    selectItem(draggedItem);
  }

  draggedItem = null;
  renderGame();
}

pitchEl.addEventListener("pointerdown", (event) => {
  const pieceToken = event.target.closest(".piece");
  const ballToken = !pieceToken ? event.target.closest(".ball") : null;
  const token = pieceToken || ballToken;
  if (!token) return;

  event.preventDefault();
  const item = pieceToken
    ? { type: "piece", id: pieceToken.dataset.pieceId }
    : { type: "ball" };
  startDrag(item, token, event.clientX, event.clientY);
});

window.addEventListener("pointermove", (event) => {
  if (!draggedItem) return;

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
  if (!draggedItem) return;
  endDrag(event.clientX, event.clientY);
});

window.addEventListener("pointercancel", () => {
  if (!draggedItem) return;
  endDrag(dragStartX, dragStartY);
});

pitchEl.addEventListener("pointerup", (event) => {
  if (draggedItem || didDrag) return;
  const cell = event.target.closest(".cell");
  if (!cell || event.target.closest(".piece") || event.target.closest(".ball")) return;
  moveSelectedItem(cell);
});
