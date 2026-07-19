// Spielseitenlayout: erzeugt und aktualisiert das DOM auf Basis des
// Spielzustands aus gameLogic.js. Enthaelt selbst keine Spielregeln.

import { SIDE, GOAL_COLUMN } from "./gameLogic.js";

function addPitchMarking(container, className) {
  const marking = document.createElement("div");
  marking.className = `pitch-marking ${className}`;
  marking.setAttribute("aria-hidden", "true");
  container.appendChild(marking);
}

export