import { useNavigate, useLocation } from "react-router-dom";

export default function SelectRole() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const address = state?.address;

  return (
    <div style={styles.root}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.container}>
        <div style={styles.walletBadge}>
          <span style={{ fontSize: 14 }}>🦊</span>
          <span style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8" }}>
            {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "Connected"}
          </span>
        </div>

        <h1 style={styles.title}>Who are you?</h1>
        <p style={styles.sub}>
          No existing account found for this wallet.<br />Select your role to get started.
        </p>

        <div style={styles.grid}>
          <RoleCard
            icon="🩺"
            title="Doctor"
            description="Register with your medical credentials. Upload documents for on-chain verification."
            color="#06b6d4"
            glow="rgba(6,182,212,0.25)"
            onClick={() => navigate("/doctor/register", { state: { address } })}
          />
          <RoleCard
            icon="👤"
            title="Patient"
            description="Create your health profile and take full ownership of your medical records."
            color="#8b5cf6"
            glow="rgba(139,92,246,0.25)"
            onClick={() => navigate("/user/register", { state: { address } })}
          />
        </div>

        <button style={styles.back} onClick={() => navigate("/")}>
          ← Use a different wallet
        </button>
      </div>
    </div>
  );
}

function RoleCard({ icon, title, description, color, glow, onClick }) {
  return (
    <div
      style={styles.card}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
        e.currentTarget.style.borderColor = `${color}60`;
        e.currentTarget.style.boxShadow = `0 20px 50px ${glow}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ ...styles.cardIcon, background: `${color}15`, border: `1px solid ${color}30` }}>
        <span style={{ fontSize: 38 }}>{icon}</span>
      </div>
      <h3 style={{ ...styles.cardTitle, color }}>{title}</h3>
      <p style={styles.cardDesc}>{description}</p>
      <div style={{ ...styles.cardCta, background: `${color}15`, color, border: `1px solid ${color}30` }}>
        Register as {title} →
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh", background: "#060a12",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    position: "relative", overflow: "hidden", padding: 24,
  },
  orb1: {
    position: "absolute", top: "-20%", left: "-10%",
    width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  orb2: {
    position: "absolute", bottom: "-20%", right: "-10%",
    width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  container: {
    maxWidth: 640, width: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 24, position: "relative", zIndex: 1,
  },
  walletBadge: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 100, padding: "8px 16px",
  },
  title: {
    fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 800,
    color: "#f0f4ff", margin: 0, letterSpacing: "-1px", textAlign: "center",
  },
  sub: {
    fontSize: 15, color: "#64748b", margin: 0,
    textAlign: "center", lineHeight: 1.7,
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20, width: "100%",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 20, padding: 28, cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 14,
    transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  cardIcon: {
    width: 72, height: 72, borderRadius: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 22, fontWeight: 800, margin: 0 },
  cardDesc: { fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: 0 },
  cardCta: {
    padding: "10px 16px", borderRadius: 10,
    fontWeight: 700, fontSize: 13, textAlign: "center",
  },
  back: {
    background: "none", border: "none", color: "#475569",
    cursor: "pointer", fontSize: 14, marginTop: 8,
  },
};