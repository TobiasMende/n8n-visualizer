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
        Hinweis: Diese Datenschutzerklärung gilt ausschließlich für die vom unten genannten
        Verantwortlichen betriebene Instanz. Wird n8viz selbst gehostet, ist der jeweilige
        Betreiber für eine eigene Datenschutzerklärung verantwortlich.
      </aside>

      <h2>1. Verantwortlicher</h2>
      <p>
        INOCEA LLC<br />
        Tobias Mende<br />
        Scanbox #16656<br />
        Ehrenbergstr. 16a<br />
        10245 Berlin, Deutschland<br />
        Telefon: +49 451 7072134
      </p>
      <p>
        Weitere Angaben im
        <a href="https://effizienzagent.de/impressum/" target="_blank" rel="noopener noreferrer">Impressum</a>.
      </p>

      <h2>2. Überblick</h2>
      <p>
        n8viz visualisiert n8n-Workflows. Die Anwendung kommt ohne Benutzerkonten, ohne
        Tracking- oder Analyse-Tools und ohne Werbung aus. Personenbezogene Daten werden nur
        verarbeitet, soweit dies für den technischen Betrieb erforderlich ist.
      </p>

      <h2>3. Hosting (Vercel)</h2>
      <p>
        Diese Anwendung wird bei Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA
        gehostet. Die Serverfunktionen werden in der Region Frankfurt am Main (fra1) ausgeführt.
        Beim Aufruf der Anwendung verarbeitet Vercel technisch notwendige Verbindungsdaten,
        insbesondere IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene Ressource und
        User-Agent (Server-Logs).
      </p>
      <p>
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der sicheren
        und stabilen Bereitstellung der Anwendung). Mit Vercel besteht ein
        Auftragsverarbeitungsvertrag. Soweit Daten in die USA übermittelt werden, stützt sich
        die Übermittlung auf die Zertifizierung von Vercel unter dem EU-US Data Privacy
        Framework sowie ergänzend auf EU-Standardvertragsklauseln.
      </p>

      <h2>4. Schutz vor Missbrauch (Rate-Limiting)</h2>
      <p>
        Um die API-Endpunkte der Anwendung vor Überlastung und Missbrauch zu schützen, wird die
        Anzahl der Anfragen pro IP-Adresse begrenzt. Dazu wird die IP-Adresse für die Dauer des
        jeweiligen Bewertungszeitfensters als Zählerschlüssel in einem Redis-Datenspeicher von
        Upstash, Inc. verarbeitet und anschließend automatisch gelöscht. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Schutz der Infrastruktur).
      </p>

      <h2>5. Verbindung zu Ihrer n8n-Instanz</h2>
      <p>
        Wenn Sie n8viz mit Ihrer n8n-Instanz verbinden, geben Sie die URL Ihrer Instanz und
        einen API-Schlüssel ein. Diese Daten werden ausschließlich dazu verwendet, die Anfrage
        serverseitig an Ihre n8n-Instanz weiterzuleiten. Standardmäßig werden sie nicht
        gespeichert und nach der Anfrage verworfen.
      </p>
      <p>
        Die abgerufenen Workflow-Daten werden nur flüchtig im Arbeitsspeicher verarbeitet, um
        die Visualisierung zu erzeugen. Sie werden weder serverseitig gespeichert noch
        protokolliert.
      </p>

      <h2>6. Cookie „Verbindung merken"</h2>
      <p>
        Nur wenn Sie beim Verbinden die Option „Remember" aktivieren, werden URL und
        API-Schlüssel verschlüsselt in einem Cookie (<code>n8nviz_sess</code>) in Ihrem Browser
        gespeichert. Das Cookie ist mit den Attributen HttpOnly, Secure und SameSite=Strict
        geschützt, serverseitig versiegelt (verschlüsselt) und läuft nach 7 Tagen ab. Eine
        serverseitige Speicherung findet nicht statt; Sie können die Verbindung jederzeit in
        der Anwendung trennen und das Cookie damit löschen.
      </p>
      <p>
        Da das Cookie ausschließlich auf Ihren ausdrücklichen Wunsch und für die von Ihnen
        angeforderte Funktion gesetzt wird, ist es technisch erforderlich im Sinne von § 25
        Abs. 2 Nr. 2 TDDDG. Rechtsgrundlage der Datenverarbeitung ist Art. 6 Abs. 1 lit. b
        DSGVO. Weitere Cookies werden nicht gesetzt.
      </p>

      <h2>7. Ihre Rechte</h2>
      <p>
        Sie haben gegenüber dem Verantwortlichen das Recht auf Auskunft (Art. 15 DSGVO),
        Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung
        (Art. 18 DSGVO), Datenübertragbarkeit (Art. 20 DSGVO) sowie Widerspruch gegen
        Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21 DSGVO). Außerdem
        haben Sie das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren, etwa der
        Berliner Beauftragten für Datenschutz und Informationsfreiheit.
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
