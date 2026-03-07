import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isDoctorVerified } from "../utils/contract";

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const address = state?.address || "";
  const doctor = state?.doctor || null;

  const [verified, setVerified] = useState(null);
  const [checkingChain, setCheckingChain] = useState(true);

  useEffect(() => {
    if (!address) return;
    isDoctorVerified(address)
      .then(v => { setVerified(v); setCheckingChain(false); })
      .catch(() => { setVerified(false); setCheckingChain(false); });
  }, [address]);

  return (
    <div style={styles.root}>
      <div style={styles.orb1} /><div style={styles.orb2} />

      <div style={styles.container}>
        {/* Nav */}
        <nav style={styles.nav}>
          <span style={styles.logo}>
            Health<span style={{ color: "#06b6d4" }}>Chain</span>
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
            <span style={{ fontSize: 38 }}>🩺</span>
          </div>
          <div>
            <h1 style={styles.welcome}>
              {doctor?.name ? `Dr. ${doctor.name}` : "Doctor Dashboard"}
            </h1>
            <p style={styles.subtitle}>
              {doctor?.email || ""}
            </p>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div style={{
          ...styles.verifyBanner,
          background: checkingChain
            ? "rgba(100,116,139,0.1)"
            : verified
              ? "rgba(16,185,129,0.08)"
              : "rgba(245,158,11,0.08)",
          border: `1px solid ${checkingChain ? "rgba(100,116,139,0.2)" : verified ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
        }}>
          <div style={styles.verifyBannerLeft}>
            <span style={{ fontSize: 28 }}>
              {checkingChain ? "⏳" : verified ? "✅" : "🔒"}
            </span>
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: checkingChain ? "#94a3b8" : verified ? "#10b981" : "#f59e0b",
              }}>
                {checkingChain
                  ? "Checking on-chain status..."
                  : verified
                    ? "Verified Doctor — Full Access"
                    : "Pending Admin Verification"}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                {checkingChain
                  ? "Querying the smart contract..."
                  : verified
                    ? "Your credentials have been confirmed on the Sepolia blockchain."
                    : "An admin needs to review your credentials and verify you on-chain."}
              </div>
            </div>
          </div>
          {!checkingChain && !verified && (
            <span style={styles.pendingBadge}>Under Review</span>
          )}
          {!checkingChain && verified && (
            <span style={styles.verifiedBadge}>On-Chain ✓</span>
          )}
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <StatCard icon="👥" label="Patients" value={verified ? "—" : "Locked"} color="#06b6d4" locked={!verified} />
          <StatCard icon="🗂️" label="Medical Records" value={verified ? "—" : "Locked"} color="#8b5cf6" locked={!verified} />
          <StatCard icon="📋" label="Documents Uploaded" value={doctor?.docs?.length ?? "—"} color="#10b981" />
          <StatCard icon="📅" label="Joined" value={doctor?.createdAt ? new Date(doctor.createdAt).toLocaleDateString() : "—"} color="#f59e0b" />
        </div>

        {/* Profile Info */}
        {doctor && (
          <div style={styles.infoCard}>
            <h3 style={styles.infoCardTitle}>Profile Details</h3>
            <div style={styles.infoGrid}>
              <InfoItem icon="📧" label="Email" value={doctor.email} />
              <InfoItem icon="📱" label="Phone" value={doctor.phoneNumber} />
              <InfoItem icon="🔑" label="Wallet" value={`${doctor.walletAddress?.slice(0, 10)}...${doctor.walletAddress?.slice(-8)}`} mono />
              <InfoItem icon="📄" label="Documents" value={`${doctor.docs?.length || 0} file(s) submitted`} />
            </div>
          </div>
        )}

        {/* Locked overlay message */}
        {!checkingChain && !verified && (
          <div style={styles.lockedCard}>
            <span style={{ fontSize: 40 }}>⏳</span>
            <h3 style={{ color: "#f0f4ff", margin: "12px 0 8px", fontWeight: 700 }}>
              Awaiting Admin Verification
            </h3>
            <p style={{ color: "#64748b", fontSize: 14, maxWidth: 420, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
              Your credentials are being reviewed. Once an admin verifies your wallet on-chain, you'll gain full access to patient records and medical data management.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatCard({ icon, label, value, color, locked }) {
  return (
    <div style={{
      ...styles.statCard,
      opacity: locked ? 0.5 : 1,
    }}>
      <div style={{ ...styles.statIcon, background: `${color}12`, border: `1px solid ${color}25` }}>
        <span style={{ fontSize: 22 }}>{locked ? "🔒" : icon}</span>
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
    position: "fixed", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)", pointerEvents: "none",
  },
  orb2: {
    position: "fixed", bottom: "-10%", right: "-5%", width: 600, height: 600, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents: "none",
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
    background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)",
    color: "#06b6d4", padding: "5px 12px", borderRadius: 100, fontSize: 12,
  },
  addrBadge: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontFamily: "monospace",
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
  },
  header: { display: "flex", alignItems: "center", gap: 20, marginBottom: 28 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 20,
    background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  welcome: { fontSize: 28, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  subtitle: { fontSize: 14, color: "#64748b", margin: 0 },
  verifyBanner: {
    borderRadius: 16, padding: "18px 22px", marginBottom: 28,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    flexWrap: "wrap",
  },
  verifyBannerLeft: { display: "flex", alignItems: "center", gap: 16 },
  pendingBadge: {
    background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
    color: "#f59e0b", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
  },
  verifiedBadge: {
    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
    color: "#10b981", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16, marginBottom: 28,
  },
  statCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10,
    transition: "opacity 0.3s",
  },
  statIcon: {
    width: 46, height: 46, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  infoCard: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: "22px 24px", marginBottom: 28,
  },
  infoCardTitle: { fontSize: 14, fontWeight: 700, color: "#94a3b8", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  infoItem: { display: "flex", alignItems: "flex-start", gap: 12 },
  infoItemIcon: { fontSize: 18, marginTop: 2 },
  infoItemLabel: { fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 },
  infoItemValue: { color: "#e2e8f0" },
  lockedCard: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20, padding: "48px 32px",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
};