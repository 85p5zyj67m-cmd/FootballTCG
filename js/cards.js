// Reine Kartendaten & Deck-Aufbau - keine Spielregel-Anwendung hier (siehe
// gameLogic.js applyCardEffect fuer die tatsaechliche Wirkung).

export const CARD_DEFINITIONS = [
  {
    cardId: "sprint",
    name: "Sprint",
    category: "offense",
    icon: "💨",
    description: "Ein eigener Spieler erhaelt +2 Bewegung fuer diesen Zug.",
    targetType: "ownPiece",
  },
  {
    cardId: "doppelpass",
    name: "Doppelpass",
    category: "offense",
    icon: "🔁",
    description: "Nach einem erfolgreichen Pass darfst du sofort einen weiteren Pass ausfuehren.",
    targetType: "none",
  },
  {
    cardId: "steilpass",
    name: "Steilpass",
    category: "offense",
    icon: "🎯",
    description: "Ein Pass ignoriert einen gegnerischen Spieler auf der Passlinie.",
    targetType: "none",
  },
  {
    cardId: "fernschuss",
    name: "Fernschuss",
    category: "offense",
    icon: "🚀",
    description: "Ein eigener Spieler darf aus 4 statt 3 Feldern Entfernung schiessen.",
    targetType: "ownPiece",
  },
  {
    cardId: "pressing",
    name: "Pressing",
    category: "defense",
    icon: "🧱",
    description: "Ein gegnerischer Spieler darf sich in seinem naechsten Zug nur 1 Feld bewegen.",
    targetType: "opponentPiece",
  },
  {
    cardId: "graetsche",
    name: "Graetsche",
    category: "defense",
    icon: "🦵",
    description: "Ein Tackling darf aus bis zu 2 Feldern Entfernung durchgefuehrt werden.",
    targetType: "none",
  },
  {
    cardId: "abwehrblock",
    name: "Abwehrblock",
    category: "defense",
    icon: "🛡️",
    description: "Bewege sofort einen eigenen Verteidiger um 1 Feld.",
    targetType: "ownPieceNudge",
    nudgePosition: "DEF",
    nudgeRadius: 1,
  },
  {
    cardId: "sturmlauf",
    name: "Sturmlauf",
    category: "offense",
    icon: "🏃",
    description: "Bewege sofort einen eigenen Stuermer um 1 Feld.",
    targetType: "ownPieceNudge",
    nudgePosition: "FWD",
    nudgeRadius: 1,
  },
  {
    cardId: "mittelfeldwechsel",
    name: "Mittelfeldwechsel",
    category: "tactic",
    icon: "🔄",
    description: "Bewege sofort einen eigenen Mittelfeldspieler um 1 Feld.",
    targetType: "ownPieceNudge",
    nudgePosition: "MID",
    nudgeRadius: 1,
  },
  {
    cardId: "torwartsprung",
    name: "Torwartsprung",
    category: "defense",
    icon: "🥅",
    description: "Bewege sofort deinen Torwart um 1 Feld.",
    targetType: "ownPieceNudge",
    nudgePosition: "GK",
    nudgeRadius: 1,
  },
  {
    cardId: "freilaufen",
    name: "Freilaufen",
    category: "offense",
    icon: "💫",
    description: "Bewege sofort einen beliebigen eigenen Spieler um bis zu 2 Felder.",
    targetType: "ownPieceNudge",
    nudgePosition: null,
    nudgeRadius: 2,
    copies: 1,
  },
  {
    cardId: "torwartparade",
    name: "Torwartparade",
    category: "defense",
    icon: "🧤",
    description: "Dein Torwart erhaelt +2 auf seine Schussabwehr beim naechsten gegnerischen Schuss.",
    targetType: "none",
  },
  {
    cardId: "konter",
    name: "Konter",
    category: "tactic",
    icon: "⚡",
    description: "Nach einem erfolgreichen Tackling erhaeltst du sofort 1 zusaetzliche Aktion.",
    targetType: "none",
  },
  {
    cardId: "seitenwechsel",
    name: "Seitenwechsel",
    category: "tactic",
    icon: "↔️",
    description: "Ein Pass darf beliebig weit gespielt werden, solange keine Figur die Passlinie blockiert.",
    targetType: "none",
  },
  {
    cardId: "teamwork",
    name: "Teamwork",
    category: "tactic",
    icon: "🤝",
    description: "Deine Mannschaft erhaelt sofort 1 zusaetzliche Aktion.",
    targetType: "none",
  },
  {
    cardId: "auszeit",
    name: "Auszeit",
    category: "tactic",
    icon: "⏱️",
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

// Baut ein frisch gemischtes Deck (2 Kopien je Kartentyp, sofern nicht per
// def.copies abweichend festgelegt - z.B. fuer besonders starke Karten).
export function buildDeck() {
  const cards = [];
  for (const def of CARD_DEFINITIONS) {
    const copies = def.copies ?? 2;
    for (let copy = 1; copy <= copies; copy++) {
      cards.push({ ...def, instanceId: `${def.cardId}-${copy}` });
    }
  }
  return shuffle(cards);
}
