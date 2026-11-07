// Builds MakeCode block XML in the browser, so the tablet needs no PC.
//
// A straight port of scripts/bloecke.py. Everything that was measured against
// the real editor travels with it, because every one of those facts failed
// silently when it was wrong:
//
//   - main.blocks or nothing: a block project throws main.ts away
//   - the pause socket is "pause", not "pauseTime"   -> otherwise pause(0)
//   - show number is "number", not "aNumber"         -> otherwise showNumber(0)
//   - dropdowns need the fully qualified name        -> otherwise the FIRST
//     option, so P2P3 silently becomes P0P1 and the child reads the wrong plug
//   - the analog members are named differently from their labels:
//     "P0P1" on the block, AP0P1 in the code
//
// tests/test_bloecke_js.py compares this file's output against the Python one,
// program for program. They must not drift.

const RAUM = '<xml xmlns="https://developers.google.com/blockly/xml">';
const FUSS = "</xml>";

// Ein Variablenname wird zugleich seine Kennung.
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const DIGITAL_PINS = ["P0P1", "P2P3", "P3P4", "P4P5", "P6P7", "P8P9", "P10P11"];
const ANALOG_PINS = ["AP0P1", "AP2P3", "AP3P4"];
const SERVO_PINS = ["P1", "P2", "P4", "P10"];

const VERGLEICHE = { "=": "EQ", "!=": "NEQ", "<": "LT", "<=": "LTE", ">": "GT", ">=": "GTE" };

function escape(text) {
  // Dieselben drei Zeichen wie xml.sax.saxutils.escape, in derselben
  // Reihenfolge: & zuerst, sonst entstehen aus den anderen kaputte Entitaeten.
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attribut(wert) {
  // In einem Attribut reichen die drei Zeichen von escape() nicht: ein
  // Anfuehrungszeichen beendet das Attribut, und was dahinter steht, ist
  // dann etwas anderes als gemeint. x und y schlaegt das Modell vor.
  return escape(wert).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function feld(name, wert) {
  return `<field name="${attribut(name)}">${escape(wert)}</field>`;
}

function kette(bloecke) {
  // Bloecke untereinander haengen - in Blockly ueber <next>, nicht als Liste.
  if (!bloecke.length) return "";
  if (bloecke.length === 1) return bloecke[0];
  const kopf = bloecke[0];
  const rest = kette(bloecke.slice(1));
  if (!kopf.endsWith("</block>")) throw new Error("kein Block: " + kopf.slice(-40));
  return kopf.slice(0, -"</block>".length) + `<next>${rest}</next></block>`;
}

function wertOderZahl(wert) {
  // Eine Zahl - oder ein ganzer Baustein, der eine liefert.
  if (typeof wert === "string" && wert.trimStart().startsWith("<block")) return wert;
  return `<shadow type="math_number">${feld("NUM", wert)}</shadow>`;
}

function pin(wert, erlaubt) {
  if (!erlaubt.includes(wert)) {
    throw new Error(`Diesen Anschluss gibt es nicht: ${wert} (es gibt ${erlaubt.join(", ")})`);
  }
  return wert;
}

function variable(name) {
  if (!NAME.test(name || "")) throw new Error(`Variablenname taugt nicht als Kennung: ${name}`);
  return `<field name="VAR" id="${attribut(name)}">${escape(name)}</field>`;
}

// --- Die Bausteine ----------------------------------------------------------

export function symbol(name = "Happy") {
  return `<block type="basic_show_icon">${feld("i", "IconNames." + name)}</block>`;
}

export function zahl(wert) {
  return `<block type="device_show_number"><value name="number">${wertOderZahl(wert)}</value></block>`;
}

export function pause(millisekunden = 500) {
  // Der Anschluss heisst "pause", nicht "pauseTime", und der Schatten ist ein
  // timePicker mit dem Feld "ms". Geraten hiess zweimal pause(0).
  return `<block type="device_pause"><value name="pause">` +
         `<shadow type="timePicker">${feld("ms", millisekunden)}</shadow></value></block>`;
}

export function bild(zeilen) {
  const muster = "`\n" + zeilen.map((z) => "        " + z).join("\n") + "\n        `";
  return `<block type="device_show_leds">${feld("LEDS", muster)}</block>`;
}

export function dauerhaft(inhalt, x = 20, y = 20) {
  return `<block type="device_forever" x="${attribut(x)}" y="${attribut(y)}">` +
         `<statement name="HANDLER">${kette(inhalt)}</statement></block>`;
}

export function beimStart(inhalt, x = 20, y = 20) {
  return `<block type="pxt-on-start" x="${attribut(x)}" y="${attribut(y)}">` +
         `<statement name="HANDLER">${kette(inhalt)}</statement></block>`;
}

export function beiKnopf(knopf, inhalt, x = 20, y = 20) {
  return `<block type="device_button_event" x="${attribut(x)}" y="${attribut(y)}">${feld("NAME", "Button." + knopf)}` +
         `<statement name="HANDLER">${kette(inhalt)}</statement></block>`;
}

export function wennDann(bedingung, dann, sonst = null) {
  const teile = ['<block type="controls_if">',
                 `<mutation elseif="0" else="${sonst ? 1 : 0}"></mutation>`,
                 `<value name="IF0">${bedingung}</value>`,
                 `<statement name="DO0">${kette(dann)}</statement>`];
  if (sonst) teile.push(`<statement name="ELSE">${kette(sonst)}</statement>`);
  teile.push("</block>");
  return teile.join("");
}

// --- Variablen --------------------------------------------------------------

export function setze(name, wert = 0) {
  return `<block type="variables_set">${variable(name)}` +
         `<value name="VALUE">${wertOderZahl(wert)}</value></block>`;
}

export function erhoehe(name, um = 1) {
  return `<block type="variables_change">${variable(name)}` +
         `<value name="VALUE">${wertOderZahl(um)}</value></block>`;
}

export function wert(name) {
  return `<block type="variables_get">${variable(name)}</block>`;
}

// --- Eigene Funktionen ------------------------------------------------------

export function funktion(name, inhalt, x = 20, y = 20) {
  if (!NAME.test(name || "")) throw new Error(`Funktionsname taugt nicht als Kennung: ${name}`);
  return `<block type="function_definition" x="${attribut(x)}" y="${attribut(y)}">` +
         `<mutation name="${attribut(name)}" functionid="${attribut(name)}"></mutation>` +
         `<statement name="STACK">${kette(inhalt)}</statement></block>`;
}

export function aufrufen(name) {
  if (!NAME.test(name || "")) throw new Error(`Funktionsname taugt nicht als Kennung: ${name}`);
  return `<block type="function_call">` +
         `<mutation name="${name}" functionid="${name}"></mutation></block>`;
}

// --- Listen -----------------------------------------------------------------

export function neueListe(werte) {
  if (!werte.length) throw new Error("eine leere Liste baut MakeCode anders - bitte Werte angeben");
  const eintraege = werte
    .map((w, nummer) => `<value name="ADD${nummer}">${wertOderZahl(w)}</value>`)
    .join("");
  return `<block type="lists_create_with"><mutation items="${werte.length}"></mutation>${eintraege}</block>`;
}

export function ausListe(name, platz = 0) {
  return `<block type="lists_index_get">` +
         `<value name="LIST">${wert(name)}</value>` +
         `<value name="INDEX">${wertOderZahl(platz)}</value></block>`;
}

export function listenLaenge(name) {
  return `<block type="lists_length"><value name="VALUE">${wert(name)}</value></block>`;
}

export function anhaengen(name, was) {
  return `<block type="array_push">` +
         `<value name="list">${wert(name)}</value>` +
         `<value name="value">${wertOderZahl(was)}</value></block>`;
}

// --- Vergleichen und wiederholen --------------------------------------------

export function vergleich(links, zeichen, rechts) {
  if (!(zeichen in VERGLEICHE)) {
    throw new Error(`Vergleich kenne ich nicht: ${zeichen} (es gibt ${Object.keys(VERGLEICHE).join(", ")})`);
  }
  return `<block type="logic_compare">${feld("OP", VERGLEICHE[zeichen])}` +
         `<value name="A">${wertOderZahl(links)}</value>` +
         `<value name="B">${wertOderZahl(rechts)}</value></block>`;
}

export function wiederhole(male, inhalt) {
  return `<block type="controls_repeat_ext">` +
         `<value name="TIMES"><shadow type="math_number">${feld("NUM", male)}</shadow></value>` +
         `<statement name="DO">${kette(inhalt)}</statement></block>`;
}

export function solange(bedingung, inhalt) {
  return `<block type="device_while"><value name="COND">${bedingung}</value>` +
         `<statement name="DO">${kette(inhalt)}</statement></block>`;
}

// --- Die Sensoren aus dem Yahboom-Kasten ------------------------------------
// Voll qualifiziert, immer: ein blosses "P2P3" wird geschluckt und endet als
// P0P1 - der ersten Option. Am Editor gemessen, in beide Richtungen.

export function yahboomKnopf(anschluss = "P0P1", zustand = "Press") {
  return `<block type="ModuleWorld_Digital_Button">` +
         feld("value_DNum", "ModuleWorld_Digital.mwDigitalNum." + pin(anschluss, DIGITAL_PINS)) +
         feld("value", "ModuleWorld_Digital.enButton." + zustand) + `</block>`;
}

export function abstand(anschluss = "P0P1") {
  return `<block type="ModuleWorld_Digital_Ultrasonic">` +
         feld("value_DNum", "ModuleWorld_Digital.mwDigitalNum." + pin(anschluss, DIGITAL_PINS)) +
         `</block>`;
}

export function licht(anschluss = "AP0P1") {
  return `<block type="ModuleWorld_Anaglog_Light">` +
         feld("value_ANum", "ModuleWorld_Analog.mwAnalogNum." + pin(anschluss, ANALOG_PINS)) +
         `</block>`;
}

export function geraeusch(anschluss = "AP0P1") {
  return `<block type="ModuleWorld_Anaglog_Sound">` +
         feld("value_ANum", "ModuleWorld_Analog.mwAnalogNum." + pin(anschluss, ANALOG_PINS)) +
         `</block>`;
}

export function temperatur(anschluss = "P0P1") {
  return `<block type="readdht11">` +
         feld("dht11type", "ModuleWorld_Digital.DHT11Type.DHT11_temperature_C") +
         feld("value_DNum", "ModuleWorld_Digital.mwDigitalNum." + pin(anschluss, DIGITAL_PINS)) +
         `</block>`;
}

export function feuchtigkeit(anschluss = "P0P1") {
  return `<block type="readdht11">` +
         feld("dht11type", "ModuleWorld_Digital.DHT11Type.DHT11_humidity") +
         feld("value_DNum", "ModuleWorld_Digital.mwDigitalNum." + pin(anschluss, DIGITAL_PINS)) +
         `</block>`;
}

export function bewegung(anschluss = "P0P1", zustand = "OPIR") {
  return `<block type="ModuleWorld_Digital_PIR">` +
         feld("value_DNum", "ModuleWorld_Digital.mwDigitalNum." + pin(anschluss, DIGITAL_PINS)) +
         feld("value", "ModuleWorld_Digital.enPIR." + zustand) + `</block>`;
}

export function servo(anschluss = "P1", winkel = 90) {
  return `<block type="ModuleWorld_PWM_Servo">` +
         feld("ServoNum", "ModuleWorld_PWM.mwServoNum." + pin(anschluss, SERVO_PINS)) +
         `<value name="value">${wertOderZahl(winkel)}</value></block>`;
}

export function anzeige(zahlWert) {
  return `<block type="TM650_SHOW_NUMBER"><value name="num">${wertOderZahl(zahlWert)}</value></block>`;
}

// --- Alles zusammen ---------------------------------------------------------

export function programm(bloecke, variablen = []) {
  // Benutzte Variablen muessen oben angemeldet sein. Fehlt die Anmeldung,
  // laedt der Editor den Baustein mit leerem Auswahlfeld - er sieht fast
  // richtig aus und das Programm rechnet mit nichts.
  const inhalt = bloecke.join("");
  for (const name of variablen) {
    if (!NAME.test(name)) throw new Error(`Variablenname taugt nicht als Kennung: ${name}`);
  }
  const benutzt = new Set([...inhalt.matchAll(/<field name="VAR" id="([^"]+)"/g)].map((t) => t[1]));
  const fehlend = [...benutzt].filter((n) => !variablen.includes(n)).sort();
  if (fehlend.length) throw new Error("nicht angemeldete Variablen: " + fehlend.join(", "));
  const anmeldung = variablen.map((n) => `<variable id="${attribut(n)}">${escape(n)}</variable>`).join("");
  return RAUM + `<variables>${anmeldung}</variables>` + inhalt + FUSS;
}

export const PINS = { DIGITAL: DIGITAL_PINS, ANALOG: ANALOG_PINS, SERVO: SERVO_PINS };
