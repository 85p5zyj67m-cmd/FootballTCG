import { createGameState } from "./gameLogic.js";
import { renderPitch, renderTurnIndicator, fitPitchToViewport } from "./boardRenderer.js";

const gameState = createGameState();

const pitchEl = document.getElementById("pitch");
const turnIndicatorEl = document.getElementById("turn-indicator");
const boardWrapperEl = document.querySelector(".board-wrapper");

renderPitch(pitchEl, gameState);
renderTurnIndicator(turnIndicatorEl, gameState);
fitPitchToViewport(boardWrapperEl, gameState);

window.addEventListener("resize", () => fitPitchToViewport(boardWrapperEl, gameState));
