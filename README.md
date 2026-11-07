# Robotik-Labor (Tablet)

Die Seite, die auf dem Tablet laeuft: der MakeCode-Editor mit den
Yahboom-Bloecken, eine Tutorin, die auf Spanisch antwortet und ihre
Antwort als Bloecke in den Editor legt, und Sprache rein und raus.

Hier liegt nur die Seite. Die zwei Schluessel (Anthropic, Azure Speech)
werden einmal auf dem Tablet eingegeben und bleiben dort im Browser -
in diesem Repo steht keiner.

Warum ueberhaupt gehostet: der Browser gibt das Mikrofon nur auf https
oder localhost her. Vom PC aus geht das per `adb reverse`; damit das
Labor auch bei ausgeschaltetem PC laeuft, liegt die Seite hier.
