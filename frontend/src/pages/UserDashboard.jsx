import { useNavigate, useLocation } from "react-router-dom";

export default function UserDashboard() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const address = state?.address || "";
  const user = state?.user || null;

  return (
    <div style={styles.root}>
      <div style={styles.orb1} /><div style={styles.orb2} />

      <div style={styles.container}>
        {/* Nav */}
        <nav style={styles.nav}>
          <span style={styles.logo}>
            Health<span style={{ color: "#8b5cf6" }}>Chain</span>
          </span>
          <div style={styles.navRight}>
            <span style={styles.networkBadge}>⬡ Sepolia</span>
            {address && (
              <span style={styles.addrBadge}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            )}
            <button style={styles.logoutBtn} onClick={() => navigate("/")}>
              Disconnect
            </button>
          </div>
        </nav>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.avatarWrap}>
            <span style={{ fontSize: 38 }}>👤</span>
          </div>
          <div>
            <h1 style={styles.welcome}>
              {user?.name ? `Welcome, ${user.name}` : "Patient Dashboard"}
            </h1>
            <p style={styles.subtitle}>{user?.email || "Your health data, owned by you"}</p>
          </div>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <StatCard icon="🏥" label="Visits" value="—" color="#8b5cf6" />
          <StatCard icon="💊" label="Prescriptions" value="—" color="#06b6d4" />
          <StatCard icon="📊" label="Reports" value="—" color="#10b981" />
          <StatCard icon="👨‍⚕️" label="Treating Doctors" value="—" color="#f59e0b" />
        </div>

        {/* Profile Info */}
        {user && (
          <div style={styles.infoCard}>
            <h3 style={styles.infoCardTitle}>Profile Details</h3>
            <div style={styles.infoGrid}>
              <InfoItem icon="📧" label="Email" value={user.email} />
              <InfoItem icon="📱" label="Phone" value={user.phoneNumber} />
              <InfoItem icon="🔑" label="Wallet" value={`${user.walletAddress?.slice(0, 10)}...${user.walletAddress?.slice(-8)}`} mono />
            </div>
          </div>
        )}

        {/* Empty State */}
        <div style={styles.emptyCard}>
          <span style={{ fontSize: 44 }}>🔒</span>
          <h3 style={{ color: "#f0f4ff", margin: "14px 0 8px", fontWeight: 700 }}>
            No Medical Records Yet
          </h3>
          <p style={{ color: "#64748b", fontSize: 14, maxWidth: 380, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
            Your encrypted health records will appear here once a verified doctor adds them. All data is end-to-end encrypted using your public key.
          </p>
          <div style={styles.encryptionNote}>
            <span style={{ fontSize: 14 }}>🔐</span>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              Data is encrypted on IPFS — only you can decrypt it
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: `${color}12`, border: `1px solid ${color}25` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function InfoItem({ icon, label, value, mono }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoItemIcon}>{icon}</span>
      <div>
        <div style={styles.infoItemLabel}>{label}</div>
        <div style={{ ...styles.infoItemValue, fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 12 : 14 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh", background: "#060a12",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    position: "relative", overflow: "auto",
  },
  orb1: {
    position: "fixed", top: "-10%", right: "-5%", width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", pointerEvents: "none",
  },
  orb2: {
    position: "fixed", bottom: "-10%", left: "-5%", width: 600, height: 600, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)", pointerEvents: "none",
  },
  container: {
    maxWidth: 900, margin: "0 auto", padding: "0 24px 60px", position: "relative", zIndex: 1,
  },
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 40,
  },
  logo: { fontSize: 22, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.5px" },
  navRight: { display: "flex", alignItems: "center", gap: 10 },
  networkBadge: {
    background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)",
    color: "#8b5cf6", padding: "5px 12px", borderRadius: 100, fontSize: 12,
  },
  addrBadge: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontFamily: "monospace",
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
  },
  header: { display: "flex", alignItems: "center", gap: 20, marginBottom: 32 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 20,
    background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  welcome: { fontSize: 28, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  subtitle: { fontSize: 14, color: "#64748b", margin: 0 },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16, marginBottom: 28,
  },
  statCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10,
  },
  statIcon: {
    width: 46, height: 46, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  infoCard: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: "22px 24px", marginBottom: 28,
  },
  infoCardTitle: { fontSize: 13, fontWeight: 700, color: "#64748b", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  infoItem: { display: "flex", alignItems: "flex-start", gap: 12 },
  infoItemIcon: { fontSize: 18, marginTop: 2 },
  infoItemLabel: { fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 },
  infoItemValue: { color: "#e2e8f0" },
  emptyCard: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20, padding: "48px 32px",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  encryptionNote: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)",
    borderRadius: 10, padding: "10px 16px", marginTop: 20,
  },
};