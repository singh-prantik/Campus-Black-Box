export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ display: "inline-block", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, marginBottom: 12 }}>
        Draft — pending college review
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Privacy Policy</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        Campus Black Box values user privacy. Reports are linked to authenticated college email accounts to prevent automated spam and enable dispatch confirmation. Personal identities are strictly shielded from public view.
      </p>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Data Retention &amp; Security</h3>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
        Incident data, resolution timestamps, and uploaded media are retained for facility auditing and continuous infrastructure improvement.
      </p>
    </div>
  );
}

