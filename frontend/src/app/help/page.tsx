export default function HelpPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ display: "inline-block", background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, marginBottom: 12 }}>
        Draft — pending college review
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>How to Report an Issue (Help)</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        Reporting takes under 60 seconds. Follow these quick steps to submit a maintenance ticket:
      </p>
      <ol style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, paddingLeft: 24 }}>
        <li><strong>Scan or Select Location:</strong> Scan the QR code located near the door of any room (Block 1 - 4), or select the room manually.</li>
        <li><strong>Describe the Issue:</strong> Enter a specific description. Our AI assistant will automatically suggest the best category.</li>
        <li><strong>Attach a Photo:</strong> Take a photo of the fault to help technicians arrive with the correct tools.</li>
        <li><strong>Track Progress:</strong> Monitor the lifecycle in "My Reports" as tickets move from Assigned to In Progress to Resolved.</li>
      </ol>
    </div>
  );
}

