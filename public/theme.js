// Gewählte Darstellung (hell/dunkel) setzen, bevor die Seite gezeichnet wird – sonst blitzt sie kurz
// in der Gerätefarbe auf. Klassisches Skript im <head>, weil Module erst nach dem Laden laufen.
// Umschalten: themeToggle() in app.js.
try {
  const theme = localStorage.getItem('vokabeltrainer.theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // ohne Speicher (z. B. privater Modus) gilt die Einstellung des Geräts
}
