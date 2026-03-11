function PrivacyPage() {
  return (
    <div
      style={{
        maxWidth: 680,
        margin: '3rem auto',
        padding: '0 1.5rem 3rem',
        fontFamily: 'Lato, sans-serif',
        color: '#1a1208',
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Datenschutzerklärung</h1>
      <p style={{ color: '#8a7a60', marginBottom: '2rem', fontSize: '0.875rem' }}>Privacy Policy</p>

      <section style={{ marginBottom: '2.5rem' }}>
        <p>
          Diese App speichert keine personenbezogenen Daten dauerhaft. Beim Erstellen oder Beitreten
          einer Spielrunde wird ein frei gewählter Spitzname an den Spielserver übertragen und dort
          für die Dauer der Spielsitzung gespeichert. Nach Beendigung der Sitzung werden diese Daten
          gelöscht. Es werden keine Konten erstellt, keine E-Mail-Adressen erhoben und keine Daten
          an Dritte weitergegeben.
        </p>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #d8ccb0', marginBottom: '2.5rem' }} />

      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Privacy Policy</h1>

      <section>
        <p>
          This app does not store any personal data permanently. When creating or joining a game
          session, a freely chosen nickname is transmitted to the game server and stored for the
          duration of that session. Once the session ends, this data is deleted. No accounts are
          created, no email addresses are collected, and no data is shared with third parties.
        </p>
      </section>
    </div>
  );
}

export default PrivacyPage;
