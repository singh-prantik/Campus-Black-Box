export default function AcceptableUsePage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ display: "inline-block", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, marginBottom: 12 }}>
        Draft — pending college review
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Acceptable Use Policy</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        Users must utilize Campus Black Box exclusively for legitimate infrastructure, sanitation, electrical, network, and safety reporting on campus premises.
      </p>
      <ul style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, paddingLeft: 24 }}>
        <li>Do not submit non-campus or irrelevant personal grievances.</li>
        <li>Do not upload inappropriate, offensive, or non-facility images.</li>
        <li>Do not attempt to tamper with QR token deep links or API boundaries.</li>
      </ul>
    </div>
  );
}

