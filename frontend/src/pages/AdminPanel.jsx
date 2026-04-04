import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  connectWallet,
  isAdminWallet,
  isDoctorVerified,
  verifyDoctorOnChain,
  getAdminDecryptionKey,
  suspendDoctorOnChain,
  unsuspendDoctorOnChain,
  revokeAllForDoctorOnChain,
  isDoctorSuspended
} from "../utils/contract";
import { decryptFileFromAdmin } from "../utils/crypto";

const API = "http://localhost:5010/api";
const ADMIN_WALLET = import.meta.env.VITE_ADMIN_WALLET?.toLowerCase();

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ["Doctors", "History", "Complaints"];

export default function AdminPanel() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [address, setAddress] = useState(state?.address || "");
  const [authed, setAuthed] = useState(!!state?.address && isAdminWallet(state?.address));
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Doctors");

  // ── Doctors ──────────────────────────────────────────────────────────────────
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [docModal, setDocModal] = useState(false);
  const [decryptedDocs, setDecryptedDocs] = useState([]);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptStep, setDecryptStep] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyTx, setVerifyTx] = useState("");
  const [verifyStep, setVerifyStep] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [suspendStep, setSuspendStep] = useState("");
  const [suspendTx, setSuspendTx] = useState("");

  // ── History ───────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Complaints ────────────────────────────────────────────────────────────────
  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintModal, setComplaintModal] = useState(false);
  const [ackInput, setAckInput] = useState("");
  const [statusInput, setStatusInput] = useState("");
  const [savingComplaint, setSavingComplaint] = useState(false);
  const [complaintError, setComplaintError] = useState("");

  // ── Auth ─────────────────────────────────────────────────────────────────────
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
    if (authed) {
      fetchDoctors();
      fetchHistory();
      fetchComplaints();
    }
  }, [authed]);

  // ── Fetch Doctors ─────────────────────────────────────────────────────────────
  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const res = await fetch(`${API}/doctors`);
      const data = await res.json();
      const withChain = await Promise.all(
        data.map(async (doc) => {
          try {
            const verified = await isDoctorVerified(doc.walletAddress);
            // you need a new function OR extend existing
            const isSuspended = await isDoctorSuspended(doc.walletAddress);
            return { ...doc, onChainVerified: verified, isSuspended: isSuspended };
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

  // ── Fetch History ─────────────────────────────────────────────────────────────
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API}/viewhistory`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
    setLoadingHistory(false);
  };

  // ── Fetch Complaints ──────────────────────────────────────────────────────────
  const fetchComplaints = async () => {
    setLoadingComplaints(true);
    try {
      // No "get all" endpoint by default, but admin can hit /user/ or /doctor/ endpoints
      // Assuming we add a GET /api/complaints or use both. Here we try a general fetch:
      const res = await fetch(`${API}/complaints`);
      if (res.ok) {
        const data = await res.json();
        setComplaints(data);
      }
    } catch (err) {
      console.error("Failed to fetch complaints:", err);
    }
    setLoadingComplaints(false);
  };

  // ── Open Doctor Modal ─────────────────────────────────────────────────────────
  const openDoctorModal = (doctor) => {
    setSelectedDoctor(doctor);
    setDecryptedDocs([]);
    setVerifyTx("");
    setSuspendTx("");
    setDecryptStep("");
    setVerifyStep("");
    setSuspendStep("");
    setError("");
    setDocModal(true);
  };

  // ── Decrypt Docs ──────────────────────────────────────────────────────────────
  function base64ToUint8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
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
      const { PrivateKey } = await import("eciesjs");
      const { getBytes, hexlify } = await import("ethers");
      const sk = new PrivateKey(getBytes(decryptionKey));
      const derivedPubKey = hexlify(sk.publicKey.toBytes());
      console.log("🔑 Keys match?", derivedPubKey === import.meta.env.VITE_ADMIN_DERIVED_PUBKEY);
      setDecryptStep("Fetching bundle from IPFS...");
      for (const cid of selectedDoctor.docs) {
        try {
          const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
          const res = await fetch(ipfsUrl);
          if (!res.ok) throw new Error(`IPFS fetch failed (${res.status})`);
          const bundle = JSON.parse(await res.text());
          const encryptedFileBuffer = base64ToUint8(bundle.encryptedFile).buffer;
          const decrypted = await decryptFileFromAdmin(encryptedFileBuffer, bundle.encryptedAESKey, decryptionKey);
          const blob = new Blob([decrypted], { type: bundle.mimeType });
          results.push({ cid, url: URL.createObjectURL(blob) });
        } catch (err) {
          results.push({ cid, error: err.message, url: null });
        }
      }
    } catch (err) {
      setDecryptStep("");
      setDecrypting(false);
      setError(err.message || "Decryption cancelled");
      return;
    }
    setDecryptedDocs(results);
    setDecryptStep("");
    setDecrypting(false);
  };

  // ── Verify Doctor ─────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!selectedDoctor) return;
    setVerifying(true);
    setVerifyStep("Waiting for MetaMask to confirm transaction...");
    setError("");
    try {
      const tx = await verifyDoctorOnChain(selectedDoctor.walletAddress);
      setVerifyTx(tx.hash);
      setVerifyStep("");
      setDoctors(prev => prev.map(d =>
        d.walletAddress === selectedDoctor.walletAddress ? { ...d, onChainVerified: true } : d
      ));
      setSelectedDoctor(prev => ({ ...prev, onChainVerified: true }));
    } catch (err) {
      setError(err.message || "Verification failed.");
      setVerifyStep("");
    }
    setVerifying(false);
  };

  // ── Suspend Doctor ────────────────────────────────────────────────────────────
  const handleSuspend = async () => {
    if (!selectedDoctor) return;
    setSuspending(true);
    setSuspendStep("Suspending on-chain...");
    setError("");
    setSuspendTx("");
    try {
      const tx1 = await suspendDoctorOnChain(selectedDoctor.walletAddress);
      setSuspendStep("Revoking all NFT access...");
      const tx2 = await revokeAllForDoctorOnChain(selectedDoctor.walletAddress);
      setSuspendTx(tx1.hash);
      setSuspendStep("");
      setDoctors(prev => prev.map(d =>
        d.walletAddress === selectedDoctor.walletAddress ? { ...d, isSuspended: true, onChainVerified: false } : d
      ));
      setSelectedDoctor(prev => ({ ...prev, isSuspended: true, onChainVerified: false }));
    } catch (err) {
      setError(err.message || "Suspend failed.");
      setSuspendStep("");
    }
    setSuspending(false);
  };

  // ── Unsuspend Doctor ──────────────────────────────────────────────────────────
  const handleUnsuspend = async () => {
    if (!selectedDoctor) return;
    setSuspending(true);
    setSuspendStep("Unsuspending on-chain...");
    setError("");
    setSuspendTx("");
    try {
      const tx = await unsuspendDoctorOnChain(selectedDoctor.walletAddress);
      setSuspendTx(tx.hash);
      setSuspendStep("");
      setDoctors(prev => prev.map(d =>
        d.walletAddress === selectedDoctor.walletAddress ? { ...d, isSuspended: false } : d
      ));
      setSelectedDoctor(prev => ({ ...prev, isSuspended: false }));
    } catch (err) {
      setError(err.message || "Unsuspend failed.");
      setSuspendStep("");
    }
    setSuspending(false);
  };

  // ── Open Complaint Modal ──────────────────────────────────────────────────────
  const openComplaintModal = (c) => {
    setSelectedComplaint(c);
    setAckInput(c.adminAcknowledgement || "");
    setStatusInput(c.status);
    setComplaintError("");
    setComplaintModal(true);
  };

  // ── Save Complaint Changes ─────────────────────────────────────────────────────
  const handleSaveComplaint = async () => {
    if (!selectedComplaint) return;
    setComplaintError("");

    setSavingComplaint(true);
    try {
      const id = selectedComplaint._id;

      // Update status
      if (statusInput !== selectedComplaint.status) {
        const r = await fetch(`${API}/complaints/status/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusInput }),
        });
        if (!r.ok) throw new Error("Failed to update status");
      }

      // Update admin acknowledgement
      if (ackInput !== selectedComplaint.adminAcknowledgement) {
        const r = await fetch(`${API}/complaints/admin-ack/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: ackInput }),
        });
        if (!r.ok) throw new Error("Failed to save acknowledgement");
      }

      // Refresh complaints
      await fetchComplaints();
      setComplaintModal(false);
    } catch (err) {
      setComplaintError(err.message || "Failed to save changes");
    }
    setSavingComplaint(false);
  };

  // ── Lock Screen ───────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={S.root}>
        <div style={S.orb1} /><div style={S.orb2} />
        <div style={S.lockCard}>
          <button style={S.backBtn} onClick={() => navigate("/")}>← Back</button>
          <div style={S.shieldWrap}><span style={{ fontSize: 44 }}>🛡️</span></div>
          <h2 style={S.lockTitle}>Admin Access</h2>
          <p style={S.lockSub}>Only the designated admin wallet can access this panel.</p>
          <div style={S.adminHint}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Admin wallet:</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#f59e0b" }}>
              {ADMIN_WALLET ? `${ADMIN_WALLET.slice(0, 10)}...${ADMIN_WALLET.slice(-8)}` : "Not configured"}
            </span>
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <button
            style={{ ...S.connectBtn, opacity: connecting ? 0.7 : 1 }}
            onClick={handleConnect} disabled={connecting}
            onMouseEnter={e => { if (!connecting) e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <BtnInner icon={connecting ? <Spinner color="#000" /> : "🦊"}
              text={connecting ? "Connecting..." : "Connect Admin Wallet"} />
          </button>
          <p style={S.hint}>Sepolia Testnet · MetaMask required</p>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  const pendingCount = doctors.filter(d => !d.onChainVerified && !d.isSuspended).length;
  const verifiedCount = doctors.filter(d => d.onChainVerified).length;
  const suspendedCount = doctors.filter(d => d.isSuspended).length;

  return (
    <div style={S.root}>
      <div style={S.orb1} /><div style={S.orb2} />
      <div style={S.dashContainer}>

        {/* Nav */}
        <nav style={S.nav}>
          <span style={S.logo}>
            Health<span style={{ color: "#f59e0b" }}>Chain</span>
            <span style={S.adminTag}>ADMIN</span>
          </span>
          <div style={S.navRight}>
            <span style={S.networkBadge}>⬡ Sepolia</span>
            <span style={S.addrBadge}>{address.slice(0, 6)}...{address.slice(-4)}</span>
            <button style={S.disconnectBtn} onClick={() => navigate("/")}>Disconnect</button>
          </div>
        </nav>

        {/* Stats */}
        <div style={S.statsRow}>
          <StatCard icon="🩺" label="Total Doctors" value={doctors.length} color="#06b6d4" />
          <StatCard icon="✅" label="Verified" value={verifiedCount} color="#10b981" />
          <StatCard icon="⏳" label="Pending" value={pendingCount} color="#f59e0b" />
          <StatCard icon="🚫" label="Suspended" value={suspendedCount} color="#ef4444" />
          <StatCard icon="📋" label="Complaints" value={complaints.length} color="#a78bfa" />
          <StatCard icon="🕘" label="View Records" value={history.length} color="#38bdf8" />
        </div>

        {/* Tab Bar */}
        <div style={S.tabBar}>
          {TABS.map(tab => (
            <button
              key={tab}
              style={{ ...S.tabBtn, ...(activeTab === tab ? S.tabBtnActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "Doctors" && "🩺 "}
              {tab === "History" && "🕘 "}
              {tab === "Complaints" && "📋 "}
              {tab}
            </button>
          ))}
        </div>

        {/* ── DOCTORS TAB ── */}
        {activeTab === "Doctors" && (
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <h2 style={S.sectionTitle}>Doctor Registry</h2>
              <button style={S.refreshBtn} onClick={fetchDoctors}>
                {loadingDoctors ? <Spinner color="#94a3b8" size={12} /> : "↻"} Refresh
              </button>
            </div>
            {loadingDoctors ? (
              <div style={S.centerBox}><Spinner color="#06b6d4" size={28} /><span style={{ color: "#64748b", fontSize: 14 }}>Loading doctors...</span></div>
            ) : doctors.length === 0 ? (
              <div style={S.centerBox}><span style={{ fontSize: 36 }}>📭</span><p style={{ color: "#64748b", margin: "12px 0 0", fontSize: 14 }}>No doctors registered yet</p></div>
            ) : (
              <div style={S.doctorGrid}>
                {doctors.map(doctor => (
                  <DoctorCard key={doctor._id} doctor={doctor} onClick={() => openDoctorModal(doctor)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "History" && (
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <h2 style={S.sectionTitle}>View History</h2>
              <button style={S.refreshBtn} onClick={fetchHistory}>
                {loadingHistory ? <Spinner color="#94a3b8" size={12} /> : "↻"} Refresh
              </button>
            </div>
            {loadingHistory ? (
              <div style={S.centerBox}><Spinner color="#38bdf8" size={28} /></div>
            ) : history.length === 0 ? (
              <div style={S.centerBox}><span style={{ fontSize: 36 }}>📭</span><p style={{ color: "#64748b", margin: "12px 0 0", fontSize: 14 }}>No view history yet</p></div>
            ) : (
              <div style={S.tableWrapper}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {["File", "User", "Doctor", "Time"].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((rec, i) => (
                      <tr key={rec._id} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                        <td style={S.td}>
                          <span style={S.fileTag}>📄 {rec.fileName}</span>
                        </td>
                        <td style={S.td}>
                          <div style={S.cellName}>{rec.userName}</div>
                          <div style={S.cellMono}>{rec.userPubKey?.slice(0, 10)}…</div>
                        </td>
                        <td style={S.td}>
                          <div style={S.cellName}>{rec.doctorName}</div>
                          <div style={S.cellMono}>{rec.doctorPubKey?.slice(0, 10)}…</div>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontSize: 13, color: "#94a3b8" }}>
                            {new Date(rec.time || rec.createdAt).toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── COMPLAINTS TAB ── */}
        {activeTab === "Complaints" && (
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <h2 style={S.sectionTitle}>Complaints</h2>
              <button style={S.refreshBtn} onClick={fetchComplaints}>
                {loadingComplaints ? <Spinner color="#94a3b8" size={12} /> : "↻"} Refresh
              </button>
            </div>
            {loadingComplaints ? (
              <div style={S.centerBox}><Spinner color="#a78bfa" size={28} /></div>
            ) : complaints.length === 0 ? (
              <div style={S.centerBox}><span style={{ fontSize: 36 }}>📭</span><p style={{ color: "#64748b", margin: "12px 0 0", fontSize: 14 }}>No complaints filed yet</p></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {complaints.map(c => (
                  <ComplaintRow key={c._id} complaint={c} onClick={() => openComplaintModal(c)} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── DOCTOR DETAIL MODAL ── */}
      {docModal && selectedDoctor && (
        <div style={S.overlay} onClick={() => setDocModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>{selectedDoctor.name}</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <StatusPill verified={selectedDoctor.onChainVerified} />
                  {selectedDoctor.isSuspended && <SuspendedPill />}
                </div>
              </div>
              <button style={S.closeBtn} onClick={() => setDocModal(false)}>✕</button>
            </div>

            <div style={S.modalBody}>
              <InfoRow label="Wallet" value={selectedDoctor.walletAddress} mono />
              <InfoRow label="Email" value={selectedDoctor.email} />
              <InfoRow label="Phone" value={selectedDoctor.phoneNumber} />
              <InfoRow label="Registered" value={new Date(selectedDoctor.createdAt).toLocaleDateString()} />

              {/* Docs */}
              {selectedDoctor.docs?.length > 0 && (
                <div style={S.docsBox}>
                  <div style={S.docsBoxHeader}>
                    <span style={S.docsLabel}>Credential Documents ({selectedDoctor.docs.length})</span>
                    <button style={{ ...S.actionBtn, opacity: decrypting ? 0.6 : 1 }} onClick={handleDecryptDocs} disabled={decrypting}>
                      {decrypting
                        ? <BtnInner icon={<Spinner color="#06b6d4" size={12} />} text={decryptStep || "Decrypting..."} />
                        : <BtnInner icon="🔓" text="Decrypt & View" />}
                    </button>
                  </div>
                  {!decrypting && decryptedDocs.length === 0 && (
                    <div style={S.decryptNotice}>
                      <span style={{ fontSize: 16 }}>🔐</span>
                      <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                        Documents are encrypted. Click <strong style={{ color: "#06b6d4" }}>Decrypt & View</strong> — MetaMask will ask you to sign a message to authorize decryption.
                      </span>
                    </div>
                  )}
                  {decrypting && decryptStep && (
                    <div style={S.stepBanner}><Spinner color="#06b6d4" size={14} /><span style={{ fontSize: 13, color: "#94a3b8" }}>{decryptStep}</span></div>
                  )}
                  {decryptedDocs.length === 0 && !decrypting && (
                    <div style={S.cidList}>
                      {selectedDoctor.docs.map((cid, i) => (
                        <div key={i} style={S.cidRow}>
                          <span style={{ fontSize: 15 }}>📄</span>
                          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{cid}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {decryptedDocs.length > 0 && (
                    <div style={S.decryptedList}>
                      {decryptedDocs.map((doc, i) => (
                        <div key={i} style={{ ...S.decryptedRow, background: doc.error ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)", border: `1px solid ${doc.error ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}` }}>
                          {doc.error ? <span style={{ color: "#f87171", fontSize: 13 }}>⚠️ {doc.error}</span> : (
                            <>
                              <span style={{ fontSize: 13, color: "#e2e8f0" }}>📄 Document_{doc.cid.slice(0, 8)}</span>
                              <a href={doc.url} download={`doc_${doc.cid.slice(0, 8)}`} target="_blank" rel="noreferrer" style={{ color: "#10b981", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Download ↓</a>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && <div style={S.errorBox}>{error}</div>}

              {verifyTx && (
                <div style={S.txBox}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <span style={{ color: "#10b981", fontSize: 13, flex: 1 }}>Doctor verified on-chain!</span>
                  <a href={`https://sepolia.etherscan.io/tx/${verifyTx}`} target="_blank" rel="noreferrer" style={{ color: "#06b6d4", fontSize: 12, textDecoration: "none" }}>View tx ↗</a>
                </div>
              )}
              {suspendTx && (
                <div style={{ ...S.txBox, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <span style={{ fontSize: 14 }}>{selectedDoctor.isSuspended ? "🚫" : "✅"}</span>
                  <span style={{ color: "#f87171", fontSize: 13, flex: 1 }}>
                    {selectedDoctor.isSuspended ? "Doctor suspended & all NFT access revoked." : "Doctor unsuspended."}
                  </span>
                  <a href={`https://sepolia.etherscan.io/tx/${suspendTx}`} target="_blank" rel="noreferrer" style={{ color: "#06b6d4", fontSize: 12, textDecoration: "none" }}>View tx ↗</a>
                </div>
              )}
              {(verifyStep || suspendStep) && (
                <div style={S.stepBanner}>
                  <Spinner color="#10b981" size={14} />
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{verifyStep || suspendStep}</span>
                </div>
              )}
            </div>

            <div style={S.modalFooter}>
              {!selectedDoctor.onChainVerified && !selectedDoctor.isSuspended && (
                <button
                  style={{ ...S.verifyBtn, opacity: verifying ? 0.65 : 1 }}
                  onClick={handleVerify} disabled={verifying}
                  onMouseEnter={e => { if (!verifying) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {verifying
                    ? <BtnInner icon={<Spinner color="#000" />} text={verifyStep || "Sending transaction..."} />
                    : <BtnInner icon="⛓️" text="Verify Doctor On-Chain" />}
                </button>
              )}

              {!selectedDoctor.isSuspended ? (
                <button
                  style={{ ...S.suspendBtn, opacity: suspending ? 0.65 : 1 }}
                  onClick={handleSuspend} disabled={suspending}
                  onMouseEnter={e => { if (!suspending) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {suspending
                    ? <BtnInner icon={<Spinner color="#fff" />} text={suspendStep || "Processing..."} />
                    : <BtnInner icon="🚫" text="Suspend Doctor" />}
                </button>
              ) : (
                <button
                  style={{ ...S.unsuspendBtn, opacity: suspending ? 0.65 : 1 }}
                  onClick={handleUnsuspend} disabled={suspending}
                  onMouseEnter={e => { if (!suspending) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {suspending
                    ? <BtnInner icon={<Spinner color="#000" />} text={suspendStep || "Processing..."} />
                    : <BtnInner icon="✅" text="Unsuspend Doctor" />}
                </button>
              )}

              <button style={S.cancelBtn} onClick={() => setDocModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLAINT DETAIL MODAL ── */}
      {complaintModal && selectedComplaint && (
        <div style={S.overlay} onClick={() => setComplaintModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div>
                <h3 style={S.modalTitle}>Complaint Detail</h3>
                <ComplaintStatusPill status={selectedComplaint.status} />
              </div>
              <button style={S.closeBtn} onClick={() => setComplaintModal(false)}>✕</button>
            </div>

            <div style={S.modalBody}>
              <InfoRow label="User" value={selectedComplaint.userName} />
              <InfoRow label="User Wallet" value={selectedComplaint.userPubKey?.slice(0, 16) + "..."} mono />
              <InfoRow label="Doctor" value={selectedComplaint.doctorName} />
              <InfoRow label="Doctor Wallet" value={selectedComplaint.doctorPubKey?.slice(0, 16) + "..."} mono />
              <InfoRow label="Filed At" value={new Date(selectedComplaint.createdAt).toLocaleString()} />
              <InfoRow label="User Confirmed?" value={selectedComplaint.userOk ? "✅ Yes" : "⏳ Not yet"} />

              {/* Complaint Description */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Complaint</div>
                <div style={S.descBox}>{selectedComplaint.complaintDescription}</div>
              </div>

              {/* Doctor Acknowledgement (read-only) */}
              {selectedComplaint.doctorAcknowledgement && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Doctor's Response</div>
                  <div style={{ ...S.descBox, borderColor: "rgba(6,182,212,0.2)", background: "rgba(6,182,212,0.04)" }}>{selectedComplaint.doctorAcknowledgement}</div>
                </div>
              )}

              {/* Status Update */}
              {selectedComplaint.status !== "resolved" ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Update Status</div>
                  <div style={S.statusBtnGroup}>
                    {["not_yet_seen", "verifying", "verified", "resolved"].map(s => {
                      return (
                        <button
                          key={s}
                          style={{
                            ...S.statusOptionBtn,
                            ...(statusInput === s ? S.statusOptionBtnActive : {}),
                          }}
                          onClick={() => {  setStatusInput(s); }}
                        >
                          {statusLabel(s)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Status</div>
                  <div style={{ ...S.descBox, background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 600 }}>
                    ✅ Resolved — no further changes allowed
                  </div>
                </div>
              )}

              {/* Admin Acknowledgement */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Admin Acknowledgement</div>
                {selectedComplaint.status !== "resolved" ? (
                  <textarea
                    style={S.ackTextarea}
                    rows={4}
                    placeholder="Write your acknowledgement or response here..."
                    value={ackInput}
                    onChange={e => setAckInput(e.target.value)}
                  />
                ) : (
                  <div style={S.descBox}>{selectedComplaint.adminAcknowledgement || <span style={{ color: "#475569", fontStyle: "italic" }}>No acknowledgement provided.</span>}</div>
                )}
              </div>

              {complaintError && <div style={S.errorBox}>{complaintError}</div>}
            </div>

            <div style={S.modalFooter}>
              {selectedComplaint.status !== "resolved" && (
                <button
                  style={{ ...S.verifyBtn, opacity: savingComplaint ? 0.65 : 1 }}
                  onClick={handleSaveComplaint} disabled={savingComplaint}
                >
                  {savingComplaint ? <BtnInner icon={<Spinner color="#000" />} text="Saving..." /> : <BtnInner icon="💾" text="Save Changes" />}
                </button>
              )}
              <button style={S.cancelBtn} onClick={() => setComplaintModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusLabel(s) {
  return { not_yet_seen: "Not Seen", verifying: "Verifying", verified: "Verified", resolved: "Resolved" }[s] || s;
}

function statusColor(s) {
  return { not_yet_seen: "#64748b", verifying: "#f59e0b", verified: "#06b6d4", resolved: "#10b981" }[s] || "#64748b";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusPill({ verified }) {
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
      background: verified ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
      color: verified ? "#10b981" : "#f59e0b",
      border: `1px solid ${verified ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
    }}>
      {verified ? "✓ Verified On-Chain" : "⏳ Pending Verification"}
    </span>
  );
}

function SuspendedPill() {
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
      background: "rgba(239,68,68,0.12)", color: "#f87171",
      border: "1px solid rgba(239,68,68,0.3)",
    }}>
      🚫 Suspended
    </span>
  );
}

function ComplaintStatusPill({ status }) {
  const color = statusColor(status);
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
      background: `${color}18`, color, border: `1px solid ${color}40`, marginTop: 8,
    }}>
      {statusLabel(status)}
    </span>
  );
}

function ComplaintRow({ complaint, onClick }) {
  const color = statusColor(complaint.status);
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14, padding: "16px 20px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        transition: "all 0.2s ease",
      }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.background = `${color}06`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
    >
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f4ff", marginBottom: 4 }}>
          {complaint.userName} <span style={{ color: "#64748b", fontWeight: 400, fontSize: 13 }}>→</span> {complaint.doctorName}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
          {complaint.complaintDescription}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {complaint.userOk && <span title="User confirmed" style={{ fontSize: 14 }}>✅</span>}
        <ComplaintStatusPill status={complaint.status} />
        <span style={{ fontSize: 12, color: "#475569" }}>{new Date(complaint.createdAt).toLocaleDateString()}</span>
        <span style={{ color: "#475569", fontSize: 14 }}>›</span>
      </div>
    </div>
  );
}

function DoctorCard({ doctor, onClick }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)", border: `1px solid ${doctor.isSuspended ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16, padding: 20, cursor: "pointer",
        transition: "all 0.25s ease", display: "flex", flexDirection: "column", gap: 8,
      }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.35)"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.3)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = doctor.isSuspended ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: doctor.isSuspended ? "rgba(239,68,68,0.1)" : "rgba(6,182,212,0.1)", border: `1px solid ${doctor.isSuspended ? "rgba(239,68,68,0.2)" : "rgba(6,182,212,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22 }}>{doctor.isSuspended ? "🚫" : "🩺"}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <StatusPill verified={doctor.onChainVerified} />
          {doctor.isSuspended && <SuspendedPill />}
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f4ff" }}>{doctor.name}</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>{doctor.email}</div>
      <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{doctor.walletAddress?.slice(0, 8)}...{doctor.walletAddress?.slice(-6)}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>📄 {doctor.docs?.length || 0} document(s)</div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}12`, border: `1px solid ${color}25` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ color: "#e2e8f0", textAlign: "right", maxWidth: "65%", wordBreak: "break-all", fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 11 : 14 }}>{value}</span>
    </div>
  );
}

function Spinner({ color = "#fff", size = 14 }) {
  return (
    <span style={{ width: size, height: size, border: `2px solid ${color}30`, borderTopColor: color, borderRadius: "50%", display: "inline-block", animation: "hc-spin 0.7s linear infinite", flexShrink: 0 }} />
  );
}

function BtnInner({ icon, text }) {
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {typeof icon === "string" ? <span>{icon}</span> : icon}{text}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  root: { minHeight: "100vh", background: "#060a12", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", position: "relative", overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24 },
  orb1: { position: "fixed", top: "-15%", left: "-8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)", pointerEvents: "none" },
  orb2: { position: "fixed", bottom: "-15%", right: "-8%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)", pointerEvents: "none" },

  lockCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 420, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", backdropFilter: "blur(20px)", marginTop: "10vh" },
  backBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 0, marginBottom: 28 },
  shieldWrap: { width: 80, height: 80, borderRadius: 20, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  lockTitle: { fontSize: 28, fontWeight: 800, color: "#f0f4ff", margin: "0 0 8px" },
  lockSub: { fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px" },
  adminHint: { display: "flex", flexDirection: "column", gap: 4, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, width: "100%" },
  connectBtn: { width: "100%", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", borderRadius: 12, padding: "14px 0", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" },
  hint: { textAlign: "center", fontSize: 12, color: "#475569", marginTop: 14, width: "100%" },

  dashContainer: { maxWidth: 1200, width: "100%", position: "relative", zIndex: 1, paddingBottom: 60 },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 36 },
  logo: { fontSize: 22, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.5px" },
  adminTag: { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", padding: "2px 8px", borderRadius: 6, fontSize: 11, letterSpacing: "0.1em", marginLeft: 10 },
  navRight: { display: "flex", alignItems: "center", gap: 10 },
  networkBadge: { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", padding: "5px 12px", borderRadius: 100, fontSize: 12 },
  addrBadge: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontFamily: "monospace" },
  disconnectBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 },

  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 28 },

  tabBar: { display: "flex", gap: 8, marginBottom: 24 },
  tabBtn: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.15s ease" },
  tabBtnActive: { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" },

  section: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 20, padding: 28 },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: "#f0f4ff", margin: 0 },
  refreshBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 },
  centerBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 48, color: "#64748b" },
  doctorGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 },

  // Table
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  td: { padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", verticalAlign: "middle" },
  fileTag: { fontSize: 13, color: "#e2e8f0", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 6, padding: "3px 8px" },
  cellName: { fontSize: 13, color: "#e2e8f0", fontWeight: 600 },
  cellMono: { fontSize: 11, color: "#475569", fontFamily: "monospace", marginTop: 2 },

  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 },
  modal: { background: "#0d1321", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto", display: "flex", flexDirection: "column" },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "28px 28px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 16 },
  modalTitle: { fontSize: 22, fontWeight: 800, color: "#f0f4ff", margin: "0 0 6px" },
  closeBtn: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 14, flexShrink: 0 },
  modalBody: { padding: "20px 28px", flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  modalFooter: { padding: "20px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, flexWrap: "wrap" },

  // Docs
  docsBox: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: 16, marginTop: 12 },
  docsBoxHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  docsLabel: { fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  actionBtn: { background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  decryptNotice: { display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.1)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 },
  stepBanner: { display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 14px", marginBottom: 10 },
  cidList: { display: "flex", flexDirection: "column", gap: 6 },
  cidRow: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "8px 10px" },
  decryptedList: { display: "flex", flexDirection: "column", gap: 8 },
  decryptedRow: { display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 8, padding: "8px 12px" },

  errorBox: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px", color: "#fca5a5", fontSize: 13, marginTop: 8 },
  txBox: { display: "flex", alignItems: "center", gap: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 8 },

  // Buttons
  verifyBtn: { flex: 1, minWidth: 160, background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 12, padding: "13px 0", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" },
  suspendBtn: { flex: 1, minWidth: 160, background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: 12, padding: "13px 0", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 4px 16px rgba(239,68,68,0.3)" },
  unsuspendBtn: { flex: 1, minWidth: 160, background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", borderRadius: 12, padding: "13px 0", color: "#000", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 4px 16px rgba(245,158,11,0.3)" },
  cancelBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "13px 20px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600 },

  // Complaints
  descBox: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 },
  ackTextarea: { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#e2e8f0", lineHeight: 1.6, resize: "vertical", outline: "none", fontFamily: "'DM Sans', sans-serif" },
  statusBtnGroup: { display: "flex", gap: 8, flexWrap: "wrap" },
  statusOptionBtn: { padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s ease", textAlign: "center" },
  statusOptionBtnActive: { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" },
  statusOptionBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },
};