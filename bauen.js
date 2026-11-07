// Turns a small JSON program into MakeCode block XML.
//
// Why not let the model write the XML directly: it would be writing field
// names from memory, and that is exactly where this project kept losing
// afternoons - "pauseTime" instead of "pause", "P2P3" without its namespace.
// Both produce valid XML that MakeCode loads without a word, and the child
// gets pause(0) or reads the wrong plug.
//
// So the model picks blocks and values; this file calls the generator, and
// the generator holds every fact that was measured at the editor. A block the
// model invents does not exist here, and says so instead of becoming silence.

import * as b from "./bloecke.js";

// Was gebaut werden kann. Der Schluessel ist, was das Modell schreibt.
//
// "inhalt" sind Bausteine, die untereinander haengen; "wert" ist einer, der
// eingesetzt wird. Was ein Baustein erwartet, steht hier und nicht im Kopf
// des Modells.
const BAUSTEINE = {
  // Stapel, die oben auf der Flaeche liegen
  dauerhaft:   { art: "stapel", bauen: (k) => b.dauerhaft(k.inhalt, zahlOder(k.x, 20), zahlOder(k.y, 20)) },
  beim_start:  { art: "stapel", bauen: (k) => b.beimStart(k.inhalt, zahlOder(k.x, 20), zahlOder(k.y, 20)) },
  bei_knopf:   { art: "stapel", bauen: (k) => b.beiKnopf(k.knopf ?? "A", k.inhalt, zahlOder(k.x, 20), zahlOder(k.y, 20)) },
  funktion:    { art: "stapel", bauen: (k) => b.funktion(k.name, k.inhalt, zahlOder(k.x, 20), zahlOder(k.y, 20)) },

  // Anweisungen
  zeige_symbol: { bauen: (k) => b.symbol(k.symbol ?? "Happy") },
  zeige_zahl:   { bauen: (k) => b.zahl(k.wert) },
  zeige_bild:   { bauen: (k) => b.bild(k.zeilen) },
  pause:        { bauen: (k) => b.pause(k.ms ?? 500) },
  setze:        { bauen: (k) => b.setze(k.name, k.wert ?? 0) },
  erhoehe:      { bauen: (k) => b.erhoehe(k.name, k.um ?? 1) },
  anhaengen:    { bauen: (k) => b.anhaengen(k.name, k.wert) },
  servo:        { bauen: (k) => b.servo(k.pin ?? "P1", k.winkel ?? 90) },
  anzeige:      { bauen: (k) => b.anzeige(k.wert) },
  aufrufen:     { bauen: (k) => b.aufrufen(k.name) },
  wenn:         { bauen: (k) => b.wennDann(k.bedingung, k.dann, k.sonst ?? null) },
  wiederhole:   { bauen: (k) => b.wiederhole(k.male ?? 2, k.inhalt) },
  solange:      { bauen: (k) => b.solange(k.bedingung, k.inhalt) },

  // Werte zum Einsetzen
  wert:          { bauen: (k) => b.wert(k.name) },
  vergleich:     { bauen: (k) => b.vergleich(k.links, k.zeichen, k.rechts) },
  knopf:         { bauen: (k) => b.yahboomKnopf(k.pin ?? "P0P1", k.zustand ?? "Press") },
  abstand:       { bauen: (k) => b.abstand(k.pin ?? "P0P1") },
  licht:         { bauen: (k) => b.licht(k.pin ?? "AP0P1") },
  geraeusch:     { bauen: (k) => b.geraeusch(k.pin ?? "AP0P1") },
  temperatur:    { bauen: (k) => b.temperatur(k.pin ?? "P0P1") },
  feuchtigkeit:  { bauen: (k) => b.feuchtigkeit(k.pin ?? "P0P1") },
  bewegung:      { bauen: (k) => b.bewegung(k.pin ?? "P0P1", k.zustand ?? "OPIR") },
  neue_liste:    { bauen: (k) => b.neueListe(k.werte ?? []) },
  aus_liste:     { bauen: (k) => b.ausListe(k.name, k.platz ?? 0) },
  listen_laenge: { bauen: (k) => b.listenLaenge(k.name) },
};

// So tief darf ein Programm verschachtelt sein. Ein Kind baut keine zwanzig
// Ebenen; zwanzig Ebenen sind ein Modell, das sich verlaufen hat.
const MAX_TIEFE = 20;

// Was als Zahl gemeint ist, wird auch eine. Das Modell schlaegt x und y vor,
// und die landen in einem XML-Attribut.
function zahlOder(wert, ersatz) {
  const n = Number(wert);
  return Number.isFinite(n) ? n : ersatz;
}

function bauen(knoten, tiefe) {
  if (tiefe > MAX_TIEFE) throw new Error("zu tief verschachtelt");

  // "variable" statt "name": danach greift das Modell von selbst, und es
  // meint dasselbe. Am lebenden Tablet gesehen - der Plan war richtig
  // gedacht und scheiterte an einem Wort. Ein Kind haette nur gehoert,
  // dass die Bloecke nicht gehen.
  if (knoten && typeof knoten === "object" && knoten.variable && !knoten.name) {
    knoten = { ...knoten, name: knoten.variable };
  }

  // Eine blosse Zahl bleibt eine Zahl.
  if (typeof knoten === "number") return knoten;
  if (typeof knoten !== "object" || knoten === null) {
    throw new Error("kein Baustein: " + JSON.stringify(knoten).slice(0, 60));
  }

  const name = knoten.was;
  const bauplan = BAUSTEINE[name];
  if (!bauplan) {
    // Lieber laut hier als stumm im Editor eines Kindes.
    throw new Error(`Baustein "${name}" gibt es nicht`);
  }

  // Erst alles Verschachtelte bauen, dann den Baustein selbst.
  const fertig = { ...knoten };
  for (const feld of ["inhalt", "dann", "sonst"]) {
    if (knoten[feld] !== undefined) {
      if (!Array.isArray(knoten[feld])) throw new Error(`${feld} muss eine Liste sein`);
      fertig[feld] = knoten[feld].map((kind) => bauen(kind, tiefe + 1));
    }
  }
  for (const feld of ["bedingung", "wert", "links", "rechts", "winkel", "platz", "um"]) {
    if (knoten[feld] !== undefined && typeof knoten[feld] === "object") {
      fertig[feld] = bauen(knoten[feld], tiefe + 1);
    }
  }
  if (Array.isArray(knoten.werte)) {
    fertig.werte = knoten.werte.map((kind) =>
      typeof kind === "object" && kind !== null ? bauen(kind, tiefe + 1) : kind);
  }
  try {
    return bauplan.bauen(fertig);
  } catch (fehler) {
    throw new Error(`in "${name}": ${fehler.message}`);
  }
}

export function programmBauen(plan) {
  /* Aus dem JSON des Modells ein Programm machen.

     plan = { variablen: ["zaehler"], bloecke: [ {was: "dauerhaft", inhalt: [...]} ] }
  */
  if (typeof plan !== "object" || plan === null) throw new Error("kein Plan");
  const bloecke = plan.bloecke;
  if (!Array.isArray(bloecke) || !bloecke.length) throw new Error("keine Bloecke im Plan");

  const gebaut = bloecke.map((knoten) => {
    const name = knoten && knoten.was;
    // Erst: gibt es den ueberhaupt? Sonst bekommt ein erfundener Baustein die
    // Begruendung des falschen Fehlers, und wer sie liest, sucht am falschen Ort.
    if (!BAUSTEINE[name]) throw new Error(`Baustein "${name}" gibt es nicht`);
    if (BAUSTEINE[name].art !== "stapel") {
      // Oben auf der Flaeche liegen nur Stapel. Eine Pause allein dort waere
      // ein Baustein, den niemand ausfuehrt - er saehe aus wie ein Programm
      // und taete nichts.
      throw new Error(`"${name}" kann nicht allein auf der Flaeche liegen`);
    }
    return bauen(knoten, 0);
  });

  const variablen = Array.isArray(plan.variablen) ? plan.variablen : [];
  return b.programm(gebaut, variablen);
}

export const BAUSTEIN_NAMEN = Object.keys(BAUSTEINE);
