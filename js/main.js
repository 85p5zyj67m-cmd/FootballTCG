import {
  createGameState,
  getCurrentPlayer,
  getPieceById,
  getLegalMoveCells,
  getLegalPassTargets,
  getLegalTackleTarget,
  getShotInfo,
  executeMove,
  executePass,
  executeTackle,
  executeShoot,
  endTurnNow,
  ACTIONS_PER_TURN,
} from "./gameLogic.js";
import { performAiAction } from "./aiPlayer.js";
import {
  renderPitch,
  renderPieces,
  renderBall,
  renderTurnIndicator,
  renderScore,
  fitPitchToViewport,
} from "./boardRenderer.js";

let gameState = createGameState();

const pitchEl = document.getElementById("pitch");
const turnIndicatorEl = document.getElementById("turn-indicator");
const scoreEl = document.getElementById("score-board");
const messageEl = document.getElementById("message-line");
const boardWrapperEl = document.querySelector(".board-wrapper");
const newGameBtn = document.getElementById("new-game-btn");
const moveBtn = document.getElementById("move-btn");
const passBtn = document.getElementById("pass-btn");
const shootBtn = document.getElementById("shoot-btn");
const tackleBtn = document.getElementById("tackle-btn");
const cancelBtn = document.getElementById("cancel-btn");
const endTurnBtn = document.getElementById("end-turn-btn");

let selectedPieceId = null;
let actionMode = null; // "move" | "pass" | "tackle" | null

renderPitch(pitchEl, gameState);
render();
fitPitchToViewport(boardWrapperEl, gameState);
window.addEventListener("resize", () => fitPitchToViewport(boardWrapperEl, gameState));

function setMessage(text) {
  messageEl.textContent = text;
}

const FAILURE_MESSAGES = {
  not_your_turn: "Das ist nicht dein Spieler.",
  no_actions_left: "Keine Aktionen mehr in diesem Zug.",
  game_over: "Das Spiel ist bereits vorbei.",
  illegal_move: "Diese Bewegung ist nicht erlaubt.",
  illegal_pass: "Dieser Pass ist nicht erlaubt.",
  illegal_tackle: "Tackling hier nicht moeglich.",
  out_of_range: "Zu weit vom Tor entfernt.",
  line_blocked: "Ein Spieler steht auf der Schusslinie.",
  no_ball: "Dieser Spieler hat den Ball nicht.",
  not_found: "Spieler nicht gefunden.",
};

function describeShotResult(result) {
  const modifierText = result.modifier ? ` (Modifikator ${result.modifier})` : "";
  const outcomeText = result.outcome === "goal" ? "TOR!" : "Fehlschuss - Torwart haelt den Ball.";
  return `Schuss aus ${result.distance} Feld(ern), benoetigt ${result.needed}+, gewuerfelt ${result.roll}${modifierText} -> ${outcomeText}`;
}

function describeSuccess(type, result) {
  switch (type) {
    case "move":
      return "Spieler bewegt.";
    case "pass":
      return "Pass gespielt.";
    case "tackle":
      return "Tackling! Der Ball ist jetzt frei.";
    case "shoot":
      return describeShotResult(result);
    default:
      return "";
  }
}

function clearHighlights() {
  pitchEl.querySelectorAll(".cell.move-target").forEach((el) => el.classList.remove("move-target"));
  pitchEl
    .querySelectorAll(".piece.pass-target, .piece.tackle-target, .piece.selected")
    .forEach((el) => el.classList.remove("pass-target", "tackle-target", "selected"));
}

function applyHighlights() {
  clearHighlights();
  if (!selectedPieceId) return;

  const pieceEl = pitchEl.querySelector(`.piece[data-piece-id="${selectedPieceId}"]`);
  if (pieceEl) pieceEl.classList.add("selected");

  if (actionMode === "move") {
    for (const cell of getLegalMoveCells(gameState, selectedPieceId)) {
      const cellEl = pitchEl.querySelector(`.cell[data-row="${cell.row}"][data-col="${cell.col}"]`);
      if (cellEl) cellEl.classList.add("move-target");
    }
  } else if (actionMode === "pass") {
    for (const id of getLegalPassTargets(gameState, selectedPieceId)) {
      const targetEl = pitchEl.querySelector(`.piece[data-piece-id="${id}"]`);
      if (targetEl) targetEl.classList.add("pass-target");
    }
  } else if (actionMode === "tackle") {
    const targetId = getLegalTackleTarget(gameState, selectedPieceId);
    if (targetId) {
      const targetEl = pitchEl.querySelector(`.piece[data-piece-id="${targetId}"]`);
      if (targetEl) targetEl.classList.add("tackle-target");
    }
  }
}

function updateActionBar() {
  const piece = selectedPieceId ? getPieceById(gameState, selectedPieceId) : null;
  const current = getCurrentPlayer(gameState);
  const isControllable = piece && !current.isAI && piece.side === current.side && !gameState.winner;
  const hasBall = piece && gameState.ball.possessorId === piece.id;

  moveBtn.disabled = !isControllable || getLegalMoveCells(gameState, piece?.id).length === 0;
  passBtn.disabled =
    !isControllable || !hasBall || getLegalPassTargets(gameState, piece?.id).length === 0;
  shootBtn.disabled = !isControllable || !hasBall || !getShotInfo(gameState, piece?.id).legal;
  tackleBtn.disabled = !isControllable || !getLegalTackleTarget(gameState, piece?.id);
  cancelBtn.disabled = !selectedPieceId;
  endTurnBtn.disabled = current.isAI || Boolean(gameState.winner);
}

function render() {
  renderPieces(pitchEl, gameState);
  renderBall(pitchEl, gameState);
  renderTurnIndicator(turnIndicatorEl, gameState);
  renderScore(scoreEl, gameState);
  applyHighlights();
  updateActionBar();
}

function deselect() {
  selectedPieceId = null;
  actionMode = null;
}

function handleActionResult(result, type) {
  if (!result.ok) {
    setMessage(FAILURE_MESSAGES[result.reason] || "Aktion nicht moeglich.");
    return;
  }
  setMessage(describeSuccess(type, result));
  deselect();
  render();
  maybeTriggerAiTurn();
}

pitchEl.addEventListener("click", (event) => {
  if (gameState.winner || getCurrentPlayer(gameState).isAI) return;

  const pieceEl = event.target.closest(".piece");
  const cellEl = event.target.closest(".cell");

  if (actionMode === "move" && cellEl && cellEl.classList.contains("move-target")) {
    const row = Number(cellEl.dataset.row);
    const col = Number(cellEl.dataset.col);
    handleActionResult(executeMove(gameState, selectedPieceId, row, col), "move");
    return;
  }

  if (actionMode === "pass" && pieceEl && pieceEl.classList.contains("pass-target")) {
    handleActionResult(executePass(gameState, selectedPieceId, pieceEl.dataset.pieceId), "pass");
    return;
  }

  if (actionMode === "tackle" && pieceEl && pieceEl.classList.contains("tackle-target")) {
    handleActionResult(executeTackle(gameState, selectedPieceId), "tackle");
    return;
  }

  if (pieceEl) {
    const pieceId = pieceEl.dataset.pieceId;
    const piece = getPieceById(gameState, pieceId);
    if (piece.side !== getCurrentPlayer(gameState).side) {
      setMessage("Das ist nicht dein Spieler.");
      return;
    }
    selectedPieceId = pieceId === selectedPieceId ? null : pieceId;
    actionMode = null;
    render();
    return;
  }

  deselect();
  render();
});

moveBtn.addEventListener("click", () => {
  actionMode = "move";
  render();
});
passBtn.addEventListener("click", () => {
  actionMode = "pass";
  render();
});
tackleBtn.addEventListener("click", () => {
  actionMode = "tackle";
  render();
});
cancelBtn.addEventListener("click", () => {
  deselect();
  render();
});
shootBtn.addEventListener("click", () => {
  handleActionResult(executeShoot(gameState, selectedPieceId), "shoot");
});
endTurnBtn.addEventListener("click", () => {
  if (getCurrentPlayer(gameState).isAI || gameState.winner) return;
  endTurnNow(gameState);
  deselect();
  setMessage("Zug beendet.");
  render();
  maybeTriggerAiTurn();
});
newGameBtn.addEventListener("click", () => {
  gameState = createGameState();
  deselect();
  setMessage("Neues Spiel gestartet.");
  render();
});

function maybeTriggerAiTurn() {
  if (gameState.winner) return;
  if (!getCurrentPlayer(gameState).isAI) return;
  setTimeout(runAiStep, 700);
}

function runAiStep() {
  const current = getCurrentPlayer(gameState);
  if (!current.isAI || gameState.winner) return;

  const result = performAiAction(gameState, current.side);
  if (!result.ok) {
    endTurnNow(gameState);
    setMessage("KI konnte keine Aktion ausfuehren, Zug beendet.");
    render();
    return;
  }

  setMessage(`KI: ${describeSuccess(result.type, result)}`);
  render();

  if (getCurrentPlayer(gameState).isAI && !gameState.winner) {
    setTimeout(runAiStep, 700);
  }
}
