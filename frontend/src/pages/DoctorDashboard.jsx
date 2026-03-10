import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isDoctorVerified, getMedicalContract } from "../utils/contract";

const API = "http://localhost:5010/api";

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const address = state?.address || "";
  const doctor = state?.doctor || null;

  const [verified, setVerified] = useState(null);
  const [checkingChain, setCheckingChain] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // NFT / patient records state
  const [nftRecords, setNftRecords] = useState([]);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [patientNames, setPatientNames] = useState({}); // pubkey -> name

  useEffect(() => {
    if (!address) return;
    isDoctorVerified(address)
      .then(v => { setVerified(v); setCheckingChain(false); })
      .catch(() => { setVerified(false); setCheckingChain(false); });
  }, [address]);

  // Fetch NFTs when tab becomes active or doctor is verified
  useEffect(() => {
    if (activeTab === "patients" && verified && address) {
      fetchDoctorNFTs();
    }
  }, [activeTab, verified, address]);

  const fetchPatientName = async (pubkey) => {
    if (!pubkey || patientNames[pubkey]) return;
    try {
      const res = await fetch(`${API}/users/${pubkey}`);
      if (!res.ok) return;
      const user = await res.json();
      setPatientNames(prev => ({ ...prev, [pubkey]: user?.name || "Unknown Patient" }));
    } catch {
      setPatientNames(prev => ({ ...prev, [pubkey]: "Unknown Patient" }));
    }
  };

  const fetchDoctorNFTs = useCallback(async () => {
    setLoadingNfts(true);
    try {
      const contract = await getMedicalContract();
      const raw = await contract.getAccessDataByDoctor(address);

      const records = raw.map(r => ({
        patient: r.patient,
        doctor: r.doctor,
        ipfsHash: r.ipfsHash,
        revoked: r.revoked,
        tokenId: r.tokenId !== undefined ? Number(r.tokenId) : null,
      }));

      setNftRecords(records);

      // Fetch patient names for unique patient addresses
      const uniquePatients = [...new Set(records.map(r => r.patient).filter(Boolean))];
      for (const pubkey of uniquePatients) {
        fetchPatientName(pubkey);
      }
    } catch (e) {
      console.error("fetchDoctorNFTs:", e);
    }
    setLoadingNfts(false);
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

        {/* Tabs */}
        <div style={styles.tabBar}>
          {[
            { key: "overview", icon: "🏠", label: "Overview" },
            { key: "patients", icon: "👥", label: "Patient Records" },
          ].map(t => (
            <button
              key={t.key}
              style={{ ...styles.tabBtn, ...(activeTab === t.key ? styles.tabBtnActive : {}) }}
              onClick={() => setActiveTab(t.key)}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ══════ OVERVIEW TAB ══════ */}
        {activeTab === "overview" && (
          <>
            {/* Stats */}
            <div style={styles.statsGrid}>
              <StatCard icon="👥" label="Patients" value={verified ? nftRecords.length || "—" : "Locked"} color="#06b6d4" locked={!verified} />
              <StatCard icon="🗂️" label="Medical Records" value={verified ? nftRecords.filter(r => !r.revoked).length || "—" : "Locked"} color="#8b5cf6" locked={!verified} />
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
          </>
        )}

        {/* ══════ PATIENT RECORDS TAB ══════ */}
        {activeTab === "patients" && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Patient Records</h2>
              <p style={styles.panelSubtitle}>NFT-gated medical records shared with you by patients.</p>
            </div>
            <div style={styles.panelBody}>

              {!verified && !checkingChain ? (
                <div style={styles.lockedCard}>
                  <span style={{ fontSize: 36 }}>🔒</span>
                  <h3 style={{ color: "#f0f4ff", margin: "12px 0 8px", fontWeight: 700 }}>
                    Access Restricted
                  </h3>
                  <p style={{ color: "#64748b", fontSize: 14, maxWidth: 380, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
                    You need to be verified on-chain before accessing patient records.
                  </p>
                </div>
              ) : loadingNfts ? (
                <div style={styles.centerBox}>
                  <Spinner color="#06b6d4" size={28} />
                  <span style={{ color: "#64748b", fontSize: 13 }}>Fetching on-chain records…</span>
                </div>
              ) : nftRecords.length === 0 ? (
                <div style={styles.emptyCard}>
                  <span style={{ fontSize: 44 }}>📭</span>
                  <h3 style={{ color: "#f0f4ff", margin: "14px 0 8px", fontWeight: 700 }}>No Records Yet</h3>
                  <p style={{ color: "#64748b", fontSize: 14, maxWidth: 340, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
                    No patients have shared medical records with you yet.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button style={styles.refreshBtn} onClick={fetchDoctorNFTs}>
                      ↻ Refresh
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {nftRecords.map((record, i) => {
                      const patientName = patientNames[record.patient] || null;
                      return (
                        <div key={i} style={{ ...styles.recordRow, opacity: record.revoked ? 0.4 : 1 }}>
                          {/* Patient info */}
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                            <div style={styles.patientAvatar}>
                              <span style={{ fontSize: 18 }}>👤</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>
                                {patientName
                                  ? patientName
                                  : <span style={{ color: "#475569", fontFamily: "monospace", fontSize: 12 }}>
                                      {record.patient?.slice(0, 14)}…{record.patient?.slice(-6)}
                                    </span>
                                }
                              </div>
                              <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", marginTop: 2 }}>
                                {record.patient?.slice(0, 18)}…
                              </div>
                            </div>
                          </div>

                          {/* IPFS + status */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                            {record.revoked
                              ? <span style={styles.revokedBadge}>Revoked</span>
                              : <span style={styles.activeBadge}>Active</span>
                            }
                            {record.tokenId != null && (
                              <span style={styles.tokenBadge}>#{record.tokenId}</span>
                            )}
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${record.ipfsHash}`}
                              target="_blank"
                              rel="noreferrer"
                              style={styles.rawLink}
                            >
                              IPFS ↗
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatCard({ icon, label, value, color, locked }) {
  return (
    <div style={{ ...styles.statCard, opacity: locked ? 0.5 : 1 }}>
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

function Spinner({ color = "#fff", size = 14 }) {
  return (
    <span style={{
      width: size, height: size,
      border: `2px solid ${color}30`, borderTopColor: color,
      borderRadius: "50%", display: "inline-block",
      animation: "hc-spin 0.7s linear infinite", flexShrink: 0,
    }} />
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
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
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
  tabBar: { display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" },
  tabBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    color: "#64748b", padding: "11px 20px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
  tabBtnActive: {
    background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.35)", color: "#06b6d4",
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
  // Panel (for Patient Records tab)
  panel: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20, overflow: "hidden",
  },
  panelHeader: { padding: "24px 28px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  panelTitle:    { fontSize: 18, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  panelSubtitle: { fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 },
  panelBody:     { padding: "22px 28px", display: "flex", flexDirection: "column", gap: 14 },
  centerBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 12, padding: 32,
  },
  emptyCard: {
    display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 32px", gap: 8,
  },
  recordRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12, padding: "14px 16px", gap: 12, flexWrap: "wrap",
  },
  patientAvatar: {
    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
    background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  activeBadge: {
    display: "inline-block",
    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
    color: "#10b981", padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
  },
  revokedBadge: {
    display: "inline-block",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
    color: "#f87171", padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
  },
  tokenBadge: {
    background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
    color: "#8b5cf6", padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
  },
  rawLink: {
    color: "#475569", fontSize: 12, textDecoration: "none", fontWeight: 600,
    padding: "4px 10px", borderRadius: 6,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
  },
  refreshBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    color: "#64748b", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
  },
};
