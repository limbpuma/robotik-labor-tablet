// Der Dienstarbeiter speichert nichts.
//
// Er ist nur da, weil Chrome eine Seite erst dann als App anbietet, wenn einer
// existiert und auf fetch hoert. Zwischenspeichern waere hier sogar schaedlich:
// der Editor kommt von makecode.microbit.org, die Projekte vom eigenen Server,
// und eine alte Kopie der Seite waere schlimmer als gar keine.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
