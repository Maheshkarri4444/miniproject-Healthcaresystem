import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  connectWallet,
  isAdminWallet,
  isDoctorVerified,
  verifyDoctorOnChain,
  getAdminDecryptionKey,
} from "../utils/contract";
import { decryptFileFromAdmin } from "../utils/crypto";

const API = "http://localhost:5010/api";
const ADMIN_WALLET = import.meta.env.VITE_ADMIN_WALLET?.toLowerCase();

export default function AdminPanel() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [address, setAddress] = useState(state?.address || "");
  const [authed, setAuthed] = useState(!!state?.address && isAdminWallet(state?.address));
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [docModal, setDocModal] = useState(false);

  // Decrypt state
  const [decryptedDocs, setDecryptedDocs] = useState([]);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptStep, setDecryptStep] = useState("");

  // Verify state
  const [verifying, setVerifying] = useState(false);
  const [verifyTx, setVerifyTx] = useState("");
  const [verifyStep, setVerifyStep] = useState("");

  // ── Auth ────────────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnecting(true);
    setError("");
    try {
      const addr = await connectWallet();
      if (!isAdminWallet(addr)) {
        setError("⛔ This wallet is not the admin wallet. Access denied.");
        setConnecting(false);
        return;
      }
      setAddress(addr);
      setAuthed(true);
    } catch (err) {
      setError(err.message || "Connection failed");
    }
    setConnecting(false);
  };

  useEffect(() => {
    if (authed) fetchDoctors();
  }, [authed]);

  // ── Fetch doctors + on-chain status ─────────────────────────────────────────
  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const res = await fetch(`${API}/doctors`);
      const data = await res.json();
      const withChain = await Promise.all(
        data.map(async (doc) => {
          try {
            const verified = await isDoctorVerified(doc.walletAddress);
            return { ...doc, onChainVerified: verified };
          } catch {
            return { ...doc, onChainVerified: false };
          }
        })
      );
      setDoctors(withChain);
    } catch (err) {
      console.error("Failed to fetch doctors:", err);
    }
    setLoadingDoctors(false);
  };

  // ── Open modal ───────────────────────────────────────────────────────────────
  const openDoctorModal = (doctor) => {
    setSelectedDoctor(doctor);
    setDecryptedDocs([]);
    setVerifyTx("");
    setDecryptStep("");
    setVerifyStep("");
    setError("");
    setDocModal(true);
  };

  // ── Decrypt docs — wallet signs to authorize, key never stored ──────────────

  // ✅ Helper: base64 string → Uint8Array
function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
const handleDecryptDocs = async () => {
  if (!selectedDoctor?.docs?.length) return;
  setDecrypting(true);
  setDecryptStep("Waiting for MetaMask signature...");
  setError("");
  const results = [];

  try {
    const decryptionKey = await getAdminDecryptionKey();
    
    // 🔍 DEBUG — log the derived privKey and check its matching pubkey
    console.log("🔑 Derived privKey:", decryptionKey);
    
    // Derive pubkey from this privKey and compare with .env
    const { PrivateKey } = await import("eciesjs");
    const { getBytes, hexlify } = await import("ethers");
    const sk = new PrivateKey(getBytes(decryptionKey));
    const derivedPubKey = hexlify(sk.publicKey.toBytes());
    console.log("🔑 PubKey from derived privKey:", derivedPubKey);
    console.log("🔑 VITE_ADMIN_DERIVED_PUBKEY:  ", import.meta.env.VITE_ADMIN_DERIVED_PUBKEY);
    console.log("🔑 Keys match?", derivedPubKey === import.meta.env.VITE_ADMIN_DERIVED_PUBKEY);

    setDecryptStep("Fetching bundle from IPFS...");

    for (const cid of selectedDoctor.docs) {
      try {
        const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
        const res = await fetch(ipfsUrl);
        if (!res.ok) throw new Error(`IPFS fetch failed (${res.status})`);

        const bundleText = await res.text();
        console.log("📦 Raw IPFS response (first 200 chars):", bundleText.slice(0, 200));
        console.log("📦 Starts with '{'?", bundleText.trim().startsWith("{"));

        const bundle = JSON.parse(bundleText);
        console.log("📦 Bundle keys:", Object.keys(bundle));
        console.log("📦 encryptedAESKey:", bundle.encryptedAESKey?.slice(0, 40), "...");
        console.log("📦 encryptedFile (first 40 chars of base64):", bundle.encryptedFile?.slice(0, 40));

        const encryptedFileBuffer = base64ToUint8(bundle.encryptedFile).buffer;
        console.log("📦 encryptedFileBuffer byteLength:", encryptedFileBuffer.byteLength);

        const decrypted = await decryptFileFromAdmin(
          encryptedFileBuffer,
          bundle.encryptedAESKey,
          decryptionKey,
        );

        const blob = new Blob([decrypted], { type: bundle.mimeType });
        const url = URL.createObjectURL(blob);
        results.push({ cid, url });

      } catch (err) {
        console.error("❌ Error for CID", cid, err);
        results.push({ cid, error: err.message, url: null });
      }
    }

  } catch (err) {
    console.error("❌ Top level error:", err);
    setDecryptStep("");
    setDecrypting(false);
    setError(err.message || "Decryption cancelled");
    return;
  }

  setDecryptedDocs(results);
  setDecryptStep("");
  setDecrypting(false);
};



  // ── Verify doctor — MetaMask signs & sends tx directly, no backend privkey ──
  const handleVerify = async () => {
    if (!selectedDoctor) return;
    setVerifying(true);
    setVerifyStep("Waiting for MetaMask to confirm transaction...");
    setError("");

    try {
      // Calls contract.verifyDoctor(address) signed by the connected admin wallet
      const tx = await verifyDoctorOnChain(selectedDoctor.walletAddress);

      setVerifyStep("Transaction submitted, waiting for confirmation...");
      // tx.wait() already called inside verifyDoctorOnChain, so we have the hash
      setVerifyTx(tx.hash);
      setVerifyStep("");

      // Update local state immediately
      setDoctors(prev =>
        prev.map(d =>
          d.walletAddress === selectedDoctor.walletAddress
            ? { ...d, onChainVerified: true }
            : d
        )
      );
      setSelectedDoctor(prev => ({ ...prev, onChainVerified: true }));
    } catch (err) {
      setError(err.message || "Verification failed. Did you reject the transaction?");
      setVerifyStep("");
    }

    setVerifying(false);
  };

  // ── Lock screen ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={styles.root}>
        <div style={styles.orb1} /><div style={styles.orb2} />
        <div style={styles.lockCard}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← Back</button>
          <div style={styles.shieldWrap}>
            <span style={{ fontSize: 44 }}>🛡️</span>
          </div>
          <h2 style={styles.lockTitle}>Admin Access</h2>
          <p style={styles.lockSub}>
            Only the designated admin wallet can access this panel.
          </p>
          <div style={styles.adminHint}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Admin wallet:</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b" }}>
              {ADMIN_WALLET
                ? `${ADMIN_WALLET.slice(0, 10)}...${ADMIN_WALLET.slice(-8)}`
                : "Not configured"}
            </span>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <button
            style={{ ...styles.connectBtn, opacity: connecting ? 0.7 : 1 }}
            onClick={handleConnect}
            disabled={connecting}
            onMouseEnter={e => { if (!connecting) e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <BtnInner icon={connecting ? <Spinner color="#000" /> : "🦊"}
              text={connecting ? "Connecting..." : "Connect Admin Wallet"} />
          </button>
          <p style={styles.hint}>Sepolia Testnet · MetaMask required</p>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  const pendingCount = doctors.filter(d => !d.onChainVerified).length;
  const verifiedCount = doctors.filter(d => d.onChainVerified).length;

  return (
    <div style={styles.root}>
      <div style={styles.orb1} /><div style={styles.orb2} />

      <div style={styles.dashContainer}>
        {/* Nav */}
        <nav style={styles.nav}>
          <span style={styles.logo}>
            Health<span style={{ color: "#f59e0b" }}>Chain</span>
            <span style={styles.adminTag}>ADMIN</span>
          </span>
          <div style={styles.navRight}>
            <span style={styles.networkBadge}>⬡ Sepolia</span>
            <span style={styles.addrBadge}>{address.slice(0, 6)}...{address.slice(-4)}</span>
            <button style={styles.disconnectBtn} onClick={() => navigate("/")}>Disconnect</button>
          </div>
        </nav>

        {/* Stats */}
        <div style={styles.statsRow}>
          <StatCard icon="🩺" label="Total Doctors" value={doctors.length} color="#06b6d4" />
          <StatCard icon="✅" label="Verified On-Chain" value={verifiedCount} color="#10b981" />
          <StatCard icon="⏳" label="Pending Review" value={pendingCount} color="#f59e0b" />
        </div>

        {/* Doctor list */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Doctor Registry</h2>
            <button style={styles.refreshBtn} onClick={fetchDoctors}>
              {loadingDoctors ? <Spinner color="#94a3b8" size={12} /> : "↻"} Refresh
            </button>
          </div>

          {loadingDoctors ? (
            <div style={styles.centerBox}>
              <Spinner color="#06b6d4" size={28} />
              <span style={{ color: "#64748b", fontSize: 14 }}>Loading doctors...</span>
            </div>
          ) : doctors.length === 0 ? (
            <div style={styles.centerBox}>
              <span style={{ fontSize: 36 }}>📭</span>
              <p style={{ color: "#64748b", margin: "12px 0 0", fontSize: 14 }}>No doctors registered yet</p>
            </div>
          ) : (
            <div style={styles.doctorGrid}>
              {doctors.map(doctor => (
                <DoctorCard key={doctor._id} doctor={doctor} onClick={() => openDoctorModal(doctor)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Doctor Detail Modal */}
      {docModal && selectedDoctor && (
        <div style={styles.overlay} onClick={() => setDocModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>{selectedDoctor.name}</h3>
                <StatusPill verified={selectedDoctor.onChainVerified} />
              </div>
              <button style={styles.closeBtn} onClick={() => setDocModal(false)}>✕</button>
            </div>

            {/* Modal body */}
            <div style={styles.modalBody}>
              <InfoRow label="Wallet" value={selectedDoctor.walletAddress} mono />
              <InfoRow label="Email" value={selectedDoctor.email} />
              <InfoRow label="Phone" value={selectedDoctor.phoneNumber} />
              <InfoRow label="Registered" value={new Date(selectedDoctor.createdAt).toLocaleDateString()} />

              {/* IPFS Documents */}
              {selectedDoctor.docs?.length > 0 && (
                <div style={styles.docsBox}>
                  <div style={styles.docsBoxHeader}>
                    <span style={styles.docsLabel}>Credential Documents ({selectedDoctor.docs.length})</span>
                    <button
                      style={{ ...styles.actionBtn, opacity: decrypting ? 0.6 : 1 }}
                      onClick={handleDecryptDocs}
                      disabled={decrypting}
                    >
                      {decrypting
                        ? <BtnInner icon={<Spinner color="#06b6d4" size={12} />} text={decryptStep || "Decrypting..."} />
                        : <BtnInner icon="🔓" text="Sign to Decrypt & View" />
                      }
                    </button>
                  </div>

                  {/* Decrypt notice */}
                  {!decrypting && decryptedDocs.length === 0 && (
                    <div style={styles.decryptNotice}>
                      <span style={{ fontSize: 16 }}>🔐</span>
                      <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                        Documents are encrypted. Click <strong style={{ color: "#06b6d4" }}>Sign to Decrypt & View</strong> — MetaMask will ask you to sign a message (no gas, no transaction) to authorize decryption. Your key never leaves the browser.
                      </span>
                    </div>
                  )}

                  {decrypting && decryptStep && (
                    <div style={styles.stepBanner}>
                      <Spinner color="#06b6d4" size={14} />
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{decryptStep}</span>
                    </div>
                  )}

                  {/* Raw CID list (before decryption) */}
                  {decryptedDocs.length === 0 && !decrypting && (
                    <div style={styles.cidList}>
                      {selectedDoctor.docs.map((cid, i) => (
                        <div key={i} style={styles.cidRow}>
                          <span style={{ fontSize: 15 }}>📄</span>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {cid}
                          </span>
                          <a href={`https://gateway.pinata.cloud/ipfs/${cid}`} target="_blank" rel="noreferrer"
                            style={{ color: "#06b6d4", fontSize: 12, textDecoration: "none", flexShrink: 0 }}>
                            Raw ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Decrypted files */}
                  {decryptedDocs.length > 0 && (
                    <div style={styles.decryptedList}>
                      {decryptedDocs.map((doc, i) => (
                        <div key={i} style={{
                          ...styles.decryptedRow,
                          background: doc.error ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
                          border: `1px solid ${doc.error ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
                        }}>
                          {doc.error ? (
                            <span style={{ color: "#f87171", fontSize: 13 }}>⚠️ {doc.error}</span>
                          ) : (
                            <>
                              <span style={{ fontSize: 13, color: "#e2e8f0" }}>📄 Document_{doc.cid.slice(0, 8)}</span>
                              <a href={doc.url} download={`doc_${doc.cid.slice(0, 8)}`} target="_blank" rel="noreferrer"
                                style={{ color: "#10b981", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
                                Download ↓
                              </a>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && <div style={styles.errorBox}>{error}</div>}

              {/* Tx success */}
              {verifyTx && (
                <div style={styles.txBox}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <span style={{ color: "#10b981", fontSize: 13, flex: 1 }}>Doctor verified on-chain!</span>
                  <a href={`https://sepolia.etherscan.io/tx/${verifyTx}`} target="_blank" rel="noreferrer"
                    style={{ color: "#06b6d4", fontSize: 12, textDecoration: "none" }}>
                    View tx ↗
                  </a>
                </div>
              )}

              {/* Verify step indicator */}
              {verifyStep && (
                <div style={styles.stepBanner}>
                  <Spinner color="#10b981" size={14} />
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{verifyStep}</span>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={styles.modalFooter}>
              {!selectedDoctor.onChainVerified && (
                <button
                  style={{ ...styles.verifyBtn, opacity: verifying ? 0.65 : 1 }}
                  onClick={handleVerify}
                  disabled={verifying}
                  onMouseEnter={e => { if (!verifying) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {verifying
                    ? <BtnInner icon={<Spinner color="#000" />} text={verifyStep || "Sending transaction..."} />
                    : <BtnInner icon="⛓️" text="Verify Doctor On-Chain" />
                  }
                </button>
              )}
              <button style={styles.cancelBtn} onClick={() => setDocModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusPill({ verified }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
      background: verified ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
      color: verified ? "#10b981" : "#f59e0b",
      border: `1px solid ${verified ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
    }}>
      {verified ? "✓ Verified On-Chain" : "⏳ Pending Verification"}
    </span>
  );
}

function DoctorCard({ doctor, onClick }) {
  return (
    <div style={styles.docCard} onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.35)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={styles.docCardTop}>
        <div style={styles.docAvatar}><span style={{ fontSize: 22 }}>🩺</span></div>
        <StatusPill verified={doctor.onChainVerified} />
      </div>
      <div style={styles.docCardName}>{doctor.name}</div>
      <div style={styles.docCardEmail}>{doctor.email}</div>
      <div style={styles.docCardAddr}>{doctor.walletAddress?.slice(0, 8)}...{doctor.walletAddress?.slice(-6)}</div>
      <div style={styles.docCardDocs}>📄 {doctor.docs?.length || 0} document(s)</div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: `${color}12`, border: `1px solid ${color}25` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={{ ...styles.infoValue, fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 11 : 14 }}>
        {value}
      </span>
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
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    padding: 24,
  },
  orb1: {
    position: "fixed", top: "-15%", left: "-8%", width: 500, height: 500, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)", pointerEvents: "none",
  },
  orb2: {
    position: "fixed", bottom: "-15%", right: "-8%", width: 600, height: 600, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)", pointerEvents: "none",
  },

  // Lock
  lockCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 420,
    position: "relative", zIndex: 1,
    display: "flex", flexDirection: "column", alignItems: "flex-start",
    backdropFilter: "blur(20px)", marginTop: "10vh",
  },
  backBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 28 },
  shieldWrap: {
    width: 80, height: 80, borderRadius: 20,
    background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  lockTitle: { fontSize: 28, fontWeight: 800, color: "#f0f4ff", margin: "0 0 8px" },
  lockSub: { fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px" },
  adminHint: {
    display: "flex", flexDirection: "column", gap: 4,
    background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)",
    borderRadius: 10, padding: "12px 14px", marginBottom: 16, width: "100%",
  },
  connectBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    border: "none", borderRadius: 12, padding: "14px 0",
    color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
    boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
  },
  hint: { textAlign: "center", fontSize: 12, color: "#475569", marginTop: 14, width: "100%" },

  // Dashboard
  dashContainer: { maxWidth: 1100, width: "100%", position: "relative", zIndex: 1, paddingBottom: 60 },
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 36,
  },
  logo: { fontSize: 22, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.5px" },
  adminTag: {
    background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
    color: "#f59e0b", padding: "2px 8px", borderRadius: 6, fontSize: 11, letterSpacing: "0.1em", marginLeft: 10,
  },
  navRight: { display: "flex", alignItems: "center", gap: 10 },
  networkBadge: {
    background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
    color: "#f59e0b", padding: "5px 12px", borderRadius: 100, fontSize: 12,
  },
  addrBadge: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontFamily: "monospace",
  },
  disconnectBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
  },
  statsRow: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 36,
  },
  statCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8,
  },
  statIcon: { width: 46, height: 46, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  section: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 20, padding: 28,
  },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: "#f0f4ff", margin: 0 },
  refreshBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "6px 14px", borderRadius: 8,
    cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
  },
  centerBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 48, color: "#64748b" },
  doctorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 },
  docCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16, padding: 20, cursor: "pointer",
    transition: "all 0.25s ease", display: "flex", flexDirection: "column", gap: 8,
  },
  docCardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  docAvatar: {
    width: 44, height: 44, borderRadius: 12,
    background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  docCardName: { fontSize: 16, fontWeight: 700, color: "#f0f4ff" },
  docCardEmail: { fontSize: 13, color: "#64748b" },
  docCardAddr: { fontSize: 11, color: "#475569", fontFamily: "monospace" },
  docCardDocs: { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  // Modal
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 24,
  },
  modal: {
    background: "#0d1321", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24, width: "100%", maxWidth: 580,
    maxHeight: "88vh", overflow: "auto",
    display: "flex", flexDirection: "column",
  },
  modalHeader: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    padding: "28px 28px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: 800, color: "#f0f4ff", margin: "0 0 10px" },
  closeBtn: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8", width: 32, height: 32, borderRadius: 8,
    cursor: "pointer", fontSize: 14, flexShrink: 0,
  },
  modalBody: { padding: "20px 28px", flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  infoRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  infoLabel: { fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" },
  infoValue: { color: "#e2e8f0", textAlign: "right", maxWidth: "65%", wordBreak: "break-all" },

  // Docs box
  docsBox: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 16, marginTop: 12,
  },
  docsBoxHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  docsLabel: { fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  actionBtn: {
    background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)",
    color: "#06b6d4", padding: "7px 14px", borderRadius: 8,
    cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  decryptNotice: {
    display: "flex", alignItems: "flex-start", gap: 10,
    background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.1)",
    borderRadius: 10, padding: "12px 14px", marginBottom: 12,
  },
  stepBanner: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px",
    marginBottom: 10,
  },
  cidList: { display: "flex", flexDirection: "column", gap: 6 },
  cidRow: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "8px 10px",
  },
  decryptedList: { display: "flex", flexDirection: "column", gap: 8 },
  decryptedRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    borderRadius: 8, padding: "8px 12px",
  },

  errorBox: {
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 10, padding: "12px 14px", color: "#fca5a5", fontSize: 13,
    marginTop: 8,
  },
  txBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
    borderRadius: 10, padding: "12px 14px", marginTop: 8,
  },

  // Modal footer
  modalFooter: {
    padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex", gap: 12,
  },
  verifyBtn: {
    flex: 1,
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none", borderRadius: 12, padding: "13px 0",
    color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
  },
  cancelBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8", padding: "13px 20px", borderRadius: 12,
    cursor: "pointer", fontSize: 14, fontWeight: 600,
  },
};