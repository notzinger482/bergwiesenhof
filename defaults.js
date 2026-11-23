// Startwerte aus Bestellsystem_Bergwiesenhof.xlsm (Preisliste, Ausbeute, Auto)
const DEFAULTS = {
 "artikel": [
  {
   "name": "Hackfleisch",
   "einheit": "kg",
   "preis": 13,
   "inPaket": true,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0.192,
   "teile": ""
  },
  {
   "name": "Braten",
   "einheit": "kg",
   "preis": 18,
   "inPaket": true,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0.112,
   "teile": "Keule: Unterschale mit Schwanzstück, Kugel/Nuss, Bürgermeisterstück | Schulter: dicker Bug, Schaufelstück, Mittelbug, falsches Filet, Bugdeckel"
  },
  {
   "name": "Gulasch geschnitten",
   "einheit": "kg",
   "preis": 16,
   "inPaket": true,
   "stueckG": 0,
   "amStueck": true,
   "beutelG": 0,
   "anteil": 0.064,
   "teile": "Kamm/Hals, Hesse"
  },
  {
   "name": "Rostbraten",
   "einheit": "kg",
   "preis": 30,
   "inPaket": true,
   "stueckG": 250,
   "amStueck": true,
   "beutelG": 0,
   "anteil": 0.053,
   "teile": "Roastbeef, Hochrippe"
  },
  {
   "name": "Filet",
   "einheit": "kg",
   "preis": 42,
   "inPaket": false,
   "stueckG": 200,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0.0185,
   "teile": "Filet"
  },
  {
   "name": "Steak",
   "einheit": "kg",
   "preis": 28,
   "inPaket": true,
   "stueckG": 250,
   "amStueck": true,
   "beutelG": 0,
   "anteil": 0.043,
   "teile": "Hüfte"
  },
  {
   "name": "Rouladen",
   "einheit": "kg",
   "preis": 20,
   "inPaket": true,
   "stueckG": 180,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0.086,
   "teile": "Oberschale (reicht sie nicht: Unterschale anschneiden)"
  },
  {
   "name": "Siedfleisch",
   "einheit": "kg",
   "preis": 12,
   "inPaket": true,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0.098,
   "teile": "Brust, Fehlrippe, Spannrippe"
  },
  {
   "name": "Beinscheiben",
   "einheit": "kg",
   "preis": 10,
   "inPaket": true,
   "stueckG": 400,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0.041,
   "teile": "Vorder- und Hinterhesse"
  },
  {
   "name": "Tafelspitz",
   "einheit": "kg",
   "preis": 20,
   "inPaket": false,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0.014,
   "teile": "Tafelspitz"
  },
  {
   "name": "Suppenknochen (SK)",
   "einheit": "kg",
   "preis": 4,
   "inPaket": true,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 800,
   "anteil": 0,
   "teile": ""
  },
  {
   "name": "Soßenknochen (FK)",
   "einheit": "kg",
   "preis": 4,
   "inPaket": true,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 1000,
   "anteil": 0,
   "teile": ""
  },
  {
   "name": "Leber",
   "einheit": "kg",
   "preis": 12,
   "inPaket": false,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0,
   "teile": ""
  },
  {
   "name": "Nieren",
   "einheit": "Stk",
   "preis": 6.5,
   "inPaket": false,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0,
   "teile": ""
  },
  {
   "name": "Herz",
   "einheit": "Stk",
   "preis": 6.5,
   "inPaket": false,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0,
   "teile": ""
  },
  {
   "name": "Zunge",
   "einheit": "Stk",
   "preis": 22,
   "inPaket": false,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0,
   "teile": ""
  },
  {
   "name": "Ochsenschwanz",
   "einheit": "Stk",
   "preis": 12,
   "inPaket": false,
   "stueckG": 0,
   "amStueck": false,
   "beutelG": 0,
   "anteil": 0,
   "teile": ""
  }
 ],
 "settings": {
  "preisPaketKg": 15,
  "preisVakPaket": 20,
  "preisTuete": 0.3,
  "paketVon": 12,
  "paketBis": 14,
  "preislisteTitel": "Preisliste (gültig ab 01.10.2026, inkl. 7 % MwSt.)",
  "sgBulle": 420,
  "sgRind": 320,
  "nenner": 16,
  "hackKiste": 20,
  "kisteMax": 20,
  "kisteAusnahme": 25,
  "hackPaketG": 500,
  "tueteJeKg": 1,
  "skKg": 15,
  "fkKg": 10,
  "leberKg": 6,
  "nierenStk": 2,
  "herzStk": 1,
  "zungeStk": 1,
  "ochsStk": 1,
  "leberPortionG": 500,
  "hofZeile": "Bergwiesenhof Bempflingen · Bernd & Claudia Huber · Tel. 07123 / 31543"
 },
 "auto": [
  {
   "name": "hinten links",
   "hoehe": 4,
   "reihenfolge": 1,
   "zugang": "Tür hinten"
  },
  {
   "name": "hinten rechts",
   "hoehe": 4,
   "reihenfolge": 2,
   "zugang": "Tür hinten"
  },
  {
   "name": "vorne rechts",
   "hoehe": 4,
   "reihenfolge": 3,
   "zugang": "rechte Tür"
  },
  {
   "name": "Mitte rechts",
   "hoehe": 3,
   "reihenfolge": 4,
   "zugang": "wenn hinten rechts leer"
  },
  {
   "name": "Mitte Mitte",
   "hoehe": 4,
   "reihenfolge": 5,
   "zugang": "wenn hinten leer"
  },
  {
   "name": "Mitte links",
   "hoehe": 3,
   "reihenfolge": 6,
   "zugang": "wenn hinten links leer"
  },
  {
   "name": "vorne Mitte",
   "hoehe": 3,
   "reihenfolge": 7,
   "zugang": "wenn Mitte leer"
  },
  {
   "name": "vorne links",
   "hoehe": 4,
   "reihenfolge": 8,
   "zugang": "wenn Mitte links leer"
  }
 ],
 "wege": [
  "Zettel",
  "Telefon",
  "Mail",
  "persönlich"
 ]
};
