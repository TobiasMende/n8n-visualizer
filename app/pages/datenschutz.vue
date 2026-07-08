<script setup lang="ts">
const isOfficialHost = useOfficialHost()
useHead({ title: 'Datenschutzerklärung — n8viz' })
</script>
<template>
  <div class="page">
    <article class="content">
      <NuxtLink to="/" class="back">← Zurück zu n8viz</NuxtLink>
      <h1>Datenschutzerklärung</h1>
      <p class="meta">Stand: Juli 2026 · Gilt für die offizielle Instanz unter n8viz.effizienzagent.de</p>

      <aside v-if="!isOfficialHost" class="selfhost-note">
        Diese Erklärung gilt nur für die Instanz, die der unten genannte Verantwortliche
        betreibt. Hostest Du n8viz selbst, bist Du selbst Betreiber — und brauchst eine eigene
        Datenschutzerklärung.
      </aside>

      <h2>1. Worum es hier geht</h2>
      <p>
        n8viz zeigt Dir Deine n8n-Workflows als Karte. Dafür braucht es erstaunlich wenig:
        keine Konten, kein Tracking, keine Werbung. Was an Daten trotzdem technisch anfällt,
        steht hier — vollständig und ohne Kleingedrucktes.
      </p>

      <h2>2. Wer verantwortlich ist</h2>
      <p>
        INOCEA LLC<br />
        Tobias Mende<br />
        Scanbox #16656<br />
        Ehrenbergstr. 16a<br />
        10245 Berlin, Deutschland<br />
        Telefon: +49 451 7072134
      </p>
      <p>
        Weitere Angaben findest Du im
        <a href="https://effizienzagent.de/impressum/" target="_blank" rel="noopener noreferrer">Impressum</a>.
      </p>

      <h2>3. Hosting bei Vercel</h2>
      <p>
        n8viz läuft bei Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA. Die
        Serverfunktionen laufen in Frankfurt am Main (Region fra1). Beim Aufruf entstehen
        Server-Logs: Deine IP-Adresse, Zeitpunkt des Zugriffs, aufgerufene Ressource und
        Browser-Kennung (User-Agent). Ohne diese Daten funktioniert keine Webanwendung.
      </p>
      <p>
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO — das berechtigte Interesse, die
        Anwendung sicher und stabil zu betreiben. Mit Vercel besteht ein
        Auftragsverarbeitungsvertrag. Für Übermittlungen in die USA ist Vercel unter dem
        EU-US Data Privacy Framework zertifiziert, ergänzend gelten
        EU-Standardvertragsklauseln.
      </p>

      <h2>4. Schutz vor Missbrauch</h2>
      <p>
        Damit niemand die API überlastet, begrenzen wir Anfragen pro IP-Adresse. Deine
        IP-Adresse liegt dafür kurz als Zähler in einem Redis-Speicher von Upstash, Inc. —
        nach Ablauf des Zeitfensters wird sie automatisch gelöscht. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. f DSGVO (Schutz der Infrastruktur).
      </p>

      <h2>5. Deine n8n-Verbindung</h2>
      <p>
        Wo landen Deine n8n-URL und Dein API-Schlüssel? — Bei Deiner n8n-Instanz und
        nirgendwo sonst. n8viz reicht beides serverseitig durch und verwirft es nach der
        Anfrage. Durchgereicht, nicht gespeichert.
      </p>
      <p>
        Deine Workflow-Daten werden nur flüchtig im Arbeitsspeicher verarbeitet, um die Karte
        zu bauen. Sie werden weder gespeichert noch protokolliert.
      </p>

      <h2>6. Das eine Cookie</h2>
      <p>
        Nur wenn Du beim Verbinden „Remember" anhakst, speichert n8viz URL und API-Schlüssel
        verschlüsselt in einem Cookie in Deinem Browser (<code>n8nviz_sess</code>). Das Cookie
        ist serverseitig versiegelt, mit HttpOnly, Secure und SameSite=Strict geschützt und
        läuft nach 7 Tagen ab. Auf unseren Servern wird nichts gespeichert. Trennst Du die
        Verbindung in der Anwendung, ist das Cookie weg.
      </p>
      <p>
        Das Cookie wird nur auf Deinen ausdrücklichen Wunsch und für genau diese Funktion
        gesetzt — es ist damit technisch erforderlich im Sinne von § 25 Abs. 2 Nr. 2 TDDDG.
        Rechtsgrundlage der Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO. Weitere Cookies gibt
        es nicht.
      </p>

      <h2>7. Deine Rechte</h2>
      <p>
        Du hast gegenüber dem Verantwortlichen das Recht auf Auskunft (Art. 15 DSGVO),
        Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung
        (Art. 18 DSGVO), Datenübertragbarkeit (Art. 20 DSGVO) und Widerspruch gegen
        Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO). Du kannst
        Dich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, etwa der Berliner
        Beauftragten für Datenschutz und Informationsfreiheit.
      </p>
    </article>
  </div>
</template>
<style scoped>
.page { height: 100vh; overflow-y: auto; background: var(--bg-0, #0d1117); }
.content { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; color: var(--text-dim); line-height: 1.6; }
.back { display: inline-block; margin-bottom: 20px; color: var(--accent); text-decoration: none; font-size: 14px; }
.back:hover { text-decoration: underline; }
h1 { color: var(--text); font-size: 26px; margin: 0 0 4px; }
.meta { color: var(--text-faint); font-size: 13px; margin: 0 0 20px; }
h2 { color: var(--text); font-size: 17px; margin: 28px 0 8px; }
p { margin: 0 0 12px; }
a { color: var(--accent); }
code { background: var(--bg-2); padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
.selfhost-note { border: 1px solid var(--border); border-left: 3px solid var(--accent); background: var(--bg-1);
  padding: 10px 14px; border-radius: var(--radius-m, 8px); font-size: 14px; margin-bottom: 20px; }
</style>
