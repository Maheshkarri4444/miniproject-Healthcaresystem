import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const API = "http://localhost:5010/api";

export default function UserDashboard() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const address = state?.address || "";
  const user = state?.user || null;

  // Doctors state
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorTab, setDoctorTab] = useState("all"); // "all" | "verified" | "unverified"

  // Upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(""); // selected doctor wallet
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const res = await fetch(`${API}/doctors`);
      const data = await res.json();
      setDoctors(data);
    } catch (err) {
      console.error("Failed to fetch doctors:", err);
    }
    setLoadingDoctors(false);
  };

  const verifiedDoctors = doctors.filter(d => d.onChainVerified);
  const unverifiedDoctors = doctors.filter(d => !d.onChainVerified);
  const filteredDoctors =
    doctorTab === "verified" ? verifiedDoctors :
    doctorTab === "unverified" ? unverifiedDoctors :
    doctors;

  const openUploadModal = () => {
    setUploadFile(null);
    setUploadTarget("");
    setUploadStep("");
    setUploadError("");
    setUploadSuccess("");
    setUploadModal(true);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTarget) {
      setUploadError("Please select a file and a target doctor.");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      setUploadStep("Encrypting document...");
      // Placeholder: real encryption + IPFS upload logic goes here
      await new Promise(r => setTimeout(r, 1200));

      setUploadStep("Uploading to IPFS...");
      await new Promise(r => setTimeout(r, 1000));

      setUploadStep("Registering on-chain...");
      await new Promise(r => setTimeout(r, 800));

      setUploadSuccess("Document uploaded and encrypted successfully!");
      setUploadStep("");
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
      setUploadStep("");
    }

    setUploading(false);
  };

  return (
    <div style={styles.root}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />

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
          <div style={{ flex: 1 }}>
            <h1 style={styles.welcome}>
              {user?.name ? `Welcome, ${user.name}` : "Patient Dashboard"}
            </h1>
            <p style={styles.subtitle}>{user?.email || "Your health data, owned by you"}</p>
          </div>
          {/* Upload Doc Button */}
          <button
            style={styles.uploadBtn}
            onClick={openUploadModal}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(139,92,246,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(139,92,246,0.2)"; }}
          >
            <span style={{ fontSize: 16 }}>📤</span>
            <span>Upload Document</span>
          </button>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          <StatCard icon="🏥" label="Visits" value="—" color="#8b5cf6" />
          <StatCard icon="💊" label="Prescriptions" value="—" color="#06b6d4" />
          <StatCard icon="📊" label="Reports" value="—" color="#10b981" />
          <StatCard icon="👨‍⚕️" label="Verified Doctors" value={verifiedDoctors.length || "—"} color="#f59e0b" />
        </div>

        {/* Profile Info */}
        {user && (
          <div style={styles.infoCard}>
            <h3 style={styles.infoCardTitle}>Profile Details</h3>
            <div style={styles.infoGrid}>
              <InfoItem icon="📧" label="Email" value={user.email} />
              <InfoItem icon="📱" label="Phone" value={user.phoneNumber} />
              <InfoItem
                icon="🔑"
                label="Wallet"
                value={`${user.walletAddress?.slice(0, 10)}...${user.walletAddress?.slice(-8)}`}
                mono
              />
            </div>
          </div>
        )}

        {/* Doctors Section */}
        <div style={styles.doctorsSection}>
          <div style={styles.doctorsSectionHeader}>
            <h2 style={styles.sectionTitle}>Doctor Registry</h2>
            <div style={styles.tabRow}>
              {[
                { key: "all", label: `All (${doctors.length})` },
                { key: "verified", label: `✅ Verified (${verifiedDoctors.length})` },
                { key: "unverified", label: `⏳ Pending (${unverifiedDoctors.length})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  style={{ ...styles.tab, ...(doctorTab === tab.key ? styles.tabActive : {}) }}
                  onClick={() => setDoctorTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
              <button style={styles.refreshBtn} onClick={fetchDoctors}>
                {loadingDoctors ? <Spinner color="#94a3b8" size={12} /> : "↻"} Refresh
              </button>
            </div>
          </div>

          {loadingDoctors ? (
            <div style={styles.centerBox}>
              <Spinner color="#8b5cf6" size={28} />
              <span style={{ color: "#64748b", fontSize: 14 }}>Loading doctors...</span>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div style={styles.centerBox}>
              <span style={{ fontSize: 36 }}>📭</span>
              <p style={{ color: "#64748b", margin: "12px 0 0", fontSize: 14 }}>No doctors found in this category</p>
            </div>
          ) : (
            <div style={styles.doctorGrid}>
              {filteredDoctors.map(doctor => (
                <DoctorCard key={doctor._id} doctor={doctor} />
              ))}
            </div>
          )}
        </div>

        {/* Empty Records State */}
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

      {/* Upload Modal */}
      {uploadModal && (
        <div style={styles.overlay} onClick={() => !uploading && setUploadModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Upload Medical Document</h3>
                <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>
                  Document will be encrypted before upload
                </p>
              </div>
              <button style={styles.closeBtn} onClick={() => !uploading && setUploadModal(false)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {/* File picker */}
              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Select Document</label>
                <label style={styles.filePicker}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    style={{ display: "none" }}
                    onChange={e => setUploadFile(e.target.files[0])}
                    disabled={uploading}
                  />
                  {uploadFile ? (
                    <span style={{ color: "#8b5cf6", fontSize: 13 }}>📄 {uploadFile.name}</span>
                  ) : (
                    <span style={{ color: "#64748b", fontSize: 13 }}>📂 Click to browse files…</span>
                  )}
                </label>
                <span style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                  Supported: PDF, JPG, PNG, DOC, DOCX
                </span>
              </div>

              {/* Doctor selector */}
              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Share With Doctor</label>
                {loadingDoctors ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 0" }}>
                    <Spinner color="#8b5cf6" size={14} />
                    <span style={{ color: "#64748b", fontSize: 13 }}>Loading doctors...</span>
                  </div>
                ) : (
                  <div style={styles.doctorSelectList}>
                    {doctors.length === 0 && (
                      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No doctors registered yet.</p>
                    )}
                    {doctors.map(doc => (
                      <div
                        key={doc._id}
                        style={{
                          ...styles.doctorSelectRow,
                          borderColor: uploadTarget === doc.walletAddress
                            ? "rgba(139,92,246,0.5)"
                            : "rgba(255,255,255,0.06)",
                          background: uploadTarget === doc.walletAddress
                            ? "rgba(139,92,246,0.08)"
                            : "rgba(255,255,255,0.02)",
                        }}
                        onClick={() => !uploading && setUploadTarget(doc.walletAddress)}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                          <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{doc.name}</span>
                          <span style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>
                            {doc.walletAddress?.slice(0, 10)}...{doc.walletAddress?.slice(-6)}
                          </span>
                        </div>
                        <StatusPill verified={doc.onChainVerified} small />
                        {uploadTarget === doc.walletAddress && (
                          <span style={{ color: "#8b5cf6", fontSize: 16 }}>✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Encryption notice */}
              <div style={styles.encryptNotice}>
                <span style={{ fontSize: 15 }}>🔐</span>
                <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                  Your document will be <strong style={{ color: "#8b5cf6" }}>AES-encrypted</strong> with the selected doctor's public key and stored on IPFS. Only they can decrypt it.
                </span>
              </div>

              {/* Step indicator */}
              {uploading && uploadStep && (
                <div style={styles.stepBanner}>
                  <Spinner color="#8b5cf6" size={14} />
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{uploadStep}</span>
                </div>
              )}

              {/* Error / Success */}
              {uploadError && <div style={styles.errorBox}>{uploadError}</div>}
              {uploadSuccess && (
                <div style={styles.successBox}>
                  <span>✅</span>
                  <span style={{ color: "#10b981", fontSize: 13 }}>{uploadSuccess}</span>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                style={{
                  ...styles.uploadConfirmBtn,
                  opacity: uploading || !uploadFile || !uploadTarget ? 0.55 : 1,
                  cursor: uploading || !uploadFile || !uploadTarget ? "not-allowed" : "pointer",
                }}
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadTarget}
                onMouseEnter={e => { if (!uploading) e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {uploading
                  ? <BtnInner icon={<Spinner color="#fff" size={13} />} text={uploadStep || "Uploading..."} />
                  : <BtnInner icon="📤" text="Encrypt & Upload" />
                }
              </button>
              <button
                style={styles.cancelBtn}
                onClick={() => !uploading && setUploadModal(false)}
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusPill({ verified, small }) {
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "3px 8px" : "4px 12px",
      borderRadius: 100, fontSize: small ? 11 : 12, fontWeight: 600,
      background: verified ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
      color: verified ? "#10b981" : "#f59e0b",
      border: `1px solid ${verified ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {verified ? "✓ Verified" : "⏳ Pending"}
    </span>
  );
}

function DoctorCard({ doctor }) {
  return (
    <div style={styles.docCard}>
      <div style={styles.docCardTop}>
        <div style={styles.docAvatar}><span style={{ fontSize: 20 }}>🩺</span></div>
        <StatusPill verified={doctor.onChainVerified} />
      </div>
      <div style={styles.docCardName}>{doctor.name}</div>
      <div style={styles.docCardEmail}>{doctor.email}</div>
      <div style={styles.docCardAddr}>
        {doctor.walletAddress?.slice(0, 8)}...{doctor.walletAddress?.slice(-6)}
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

function BtnInner({ icon, text }) {
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {typeof icon === "string" ? <span>{icon}</span> : icon}
      {text}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
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
    maxWidth: 960, margin: "0 auto", padding: "0 24px 80px", position: "relative", zIndex: 1,
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
  header: {
    display: "flex", alignItems: "center", gap: 20, marginBottom: 32, flexWrap: "wrap",
  },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 20,
    background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  welcome: { fontSize: 28, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  subtitle: { fontSize: 14, color: "#64748b", margin: 0 },
  uploadBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    border: "none", color: "#fff", padding: "12px 22px",
    borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 700,
    boxShadow: "0 4px 16px rgba(139,92,246,0.2)",
    transition: "transform 0.15s, box-shadow 0.15s",
    marginLeft: "auto",
  },
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
  infoCardTitle: {
    fontSize: 13, fontWeight: 700, color: "#64748b", margin: "0 0 16px",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 },
  infoItem: { display: "flex", alignItems: "flex-start", gap: 12 },
  infoItemIcon: { fontSize: 18, marginTop: 2 },
  infoItemLabel: { fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 },
  infoItemValue: { color: "#e2e8f0" },

  // Doctors section
  doctorsSection: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20, padding: "24px", marginBottom: 28,
  },
  doctorsSectionHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexWrap: "wrap", gap: 12, marginBottom: 20,
  },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: "#f0f4ff", margin: 0 },
  tabRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  tab: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    color: "#64748b", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 500,
  },
  tabActive: {
    background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)",
    color: "#8b5cf6",
  },
  refreshBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    color: "#64748b", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
  },
  centerBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "32px 0", gap: 10,
  },
  doctorGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14,
  },
  docCard: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 6,
    transition: "border-color 0.2s, transform 0.2s",
  },
  docCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  docAvatar: {
    width: 38, height: 38, borderRadius: 10,
    background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  docCardName: { fontSize: 14, fontWeight: 700, color: "#e2e8f0" },
  docCardEmail: { fontSize: 12, color: "#64748b" },
  docCardAddr: { fontSize: 11, color: "#475569", fontFamily: "monospace" },

  // Empty card
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

  // Modal
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: "#0f1623", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20, width: "100%", maxWidth: 520,
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column",
    maxHeight: "90vh", overflow: "hidden",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "22px 24px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  modalTitle: { fontSize: 18, fontWeight: 800, color: "#f0f4ff", margin: 0 },
  closeBtn: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#64748b", width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  modalBody: {
    padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18,
  },
  modalFooter: {
    display: "flex", gap: 10, padding: "16px 24px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },

  // Upload form fields
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" },
  filePicker: {
    display: "flex", alignItems: "center",
    background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(139,92,246,0.3)",
    borderRadius: 10, padding: "14px 16px", cursor: "pointer",
    transition: "border-color 0.2s",
  },
  doctorSelectList: {
    display: "flex", flexDirection: "column", gap: 8,
    maxHeight: 200, overflowY: "auto",
  },
  doctorSelectRow: {
    display: "flex", alignItems: "center", gap: 12,
    border: "1px solid", borderRadius: 10, padding: "10px 14px",
    cursor: "pointer", transition: "all 0.15s",
  },
  encryptNotice: {
    display: "flex", alignItems: "flex-start", gap: 10,
    background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)",
    borderRadius: 10, padding: "12px 14px",
  },
  stepBanner: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8, padding: "10px 14px",
  },
  errorBox: {
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 10, padding: "12px 14px", color: "#f87171", fontSize: 13,
  },
  successBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 10, padding: "12px 14px",
  },
  uploadConfirmBtn: {
    flex: 1, background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    border: "none", color: "#fff", padding: "13px 0",
    borderRadius: 10, fontWeight: 700, fontSize: 14,
    transition: "transform 0.15s", display: "flex", alignItems: "center", justifyContent: "center",
  },
  cancelBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "13px 20px", borderRadius: 10,
    cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
};