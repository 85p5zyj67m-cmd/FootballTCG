// Reine Kartendaten & Deck-Aufbau - keine Spielregel-Anwendung hier (siehe
// gameLogic.js applyCardEffect fuer die tatsaechliche Wirkung).

export const CARD_DEFINITIONS = [
  {
    cardId: "sprint",
    name: "Sprint",
    category: "offense",
    description: "Ein eigener Spieler erhaelt +2 Bewegung fuer diesen Zug.",
    targetType: "ownPiece",
  },
  {
    cardId: "doppelpass",
    name: "Doppelpass",
    category: "offense",
    description: "Nach einem erfolgreichen Pass darfst du sofort einen weiteren Pass ausfuehren.",
    targetType: "none",
  },
  {
    cardId: "steilpass",
    name: "Steilpass",
    category: "offense",
    description: "Ein Pass ignoriert einen gegnerischen Spieler auf der Passlinie.",
    targetType: "none",
  },
  {
    cardId: "fernschuss",
    name: "Fernschuss",
    category: "offense",
    description: "Ein eigener Spieler darf aus 4 statt 3 Feldern Entfernung schiessen.",
    targetType: "ownPiece",
  },
  {
    cardId: "pressing",
    name: "Pressing",
    category: "defense",
    description: "Ein gegnerischer Spieler darf sich in seinem naechsten Zug nur 1 Feld bewegen.",
    targetType: "opponentPiece",
  },
  {
    cardId: "graetsche",
    name: "Graetsche",
    category: "defense",
    description: "Ein Tackling darf aus bis zu 2 Feldern Entfernung durchgefuehrt werden.",
    targetType: "none",
  },
  {
    cardId: "abwehrblock",
    name: "Abwehrblock",
    category: "defense",
    description: "Bewege sofort einen eigenen Verteidiger um 1 Feld.",
    targetType: "ownDefenderMove",
  },
  {
    cardId: "torwartparade",
    name: "Torwartparade",
    category: "defense",
    description: "Dein Torwart erhaelt +2 auf seine Schussabwehr beim naechsten gegnerischen Schuss.",
    targetType: "none",
  },
  {
    cardId: "konter",
    name: "Konter",
    category: "tactic",
    description: "Nach einem erfolgreichen Tackling erhaeltst du sofort 1 zusaetzliche Aktion.",
    targetType: "none",
  },
  {
    cardId: "seitenwechsel",
    name: "Seitenwechsel",
    category: "tactic",
    description: "Ein Pass darf beliebig weit gespielt werden, solange keine Figur die Passlinie blockiert.",
    targetType: "none",
  },
  {
    cardId: "teamwork",
    name: "Teamwork",
    category: "tactic",
    description: "Deine Mannschaft erhaelt sofort 1 zusaetzliche Aktion.",
    targetType: "none",
  },
  {
    cardId: "auszeit",
    name: "Auszeit",
    category: "tactic",
    description: "Ziehe 2 Karten und lege anschliessend 1 Karte deiner Wahl ab.",
    targetType: "none",
  },
];

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Baut ein frisch gemischtes 24-Karten-Deck (2 Kopien je Kartentyp).
export function buildDeck() {
  const cards = [];
  for (const def of CARD_DEFINITIONS) {
    for (let copy = 1; copy <= 2; copy++) {
      cards.push({ ...def, instanceId: `${def.cardId}-${copy}` });
    }
  }
  return shuffle(cards);
}
