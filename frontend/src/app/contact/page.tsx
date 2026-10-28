export default function ContactPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ display: "inline-block", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, marginBottom: 12 }}>
        Draft — pending college review
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Contact Campus Administration</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        For urgent physical safety hazards, power outages, or immediate assistance, reach out directly to the Campus Estate Management office.
      </p>
      <div style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8 }}>
        <div><strong>Office:</strong> Administration Block, Ground Floor, Room 102</div>
        <div><strong>Phone:</strong> +91 (0) 80-2345-6789 (Ext. 204)</div>
        <div><strong>Email:</strong> admin.office@campus.edu</div>
        <div><strong>Hours:</strong> Monday – Saturday, 8:30 AM – 5:30 PM</div>
      </div>
    </div>
  );
}

