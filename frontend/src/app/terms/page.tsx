export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ display: "inline-block", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, marginBottom: 12 }}>
        Draft — pending college review
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Terms &amp; Conditions</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        Campus Black Box is provided as an educational project and campus infrastructure management facility. By accessing this platform, students, faculty, and administrative users agree to report factual maintenance observations in good faith. Frivolous or malicious submissions are subject to college disciplinary policies.
      </p>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>1. Service Availability</h3>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        The platform is provided for campus reporting on an as-available basis. Emergency physical or medical hazards must also be reported directly to campus emergency security.
      </p>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>2. User Conduct</h3>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
        Reporters must provide clear descriptions and genuine photographic evidence corresponding to the indicated room or facility.
      </p>
    </div>
  );
}

