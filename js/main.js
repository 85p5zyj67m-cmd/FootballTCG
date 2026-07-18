import { createGameState } from "./gameLogic.js";
import { renderPitch, renderTurnIndicator } from "./boardRenderer.js";

const gameState = createGameState();

const pitchEl = document.getElementById("pitch");
const turnIndicatorEl = document.getElementById("turn-indicator");

renderPitch(pitchEl, gameState);
renderTurnIndicator(turnIndicatorEl, gameState);
