import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isDoctorVerified, getMedicalContract } from "../utils/contract";
import { deriveUserKeypair } from "../utils/deriveKeypair";
import { decrypt } from "eciesjs";
import { getBytes } from "ethers";

const API = "http://localhost:5010/api";

function base64ToUint8(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function decryptFileForDoctor(encryptedFileBuffer, encDoctorAesKeyHex, doctorPrivKeyHex) {
  const aesKey    = decrypt(getBytes(doctorPrivKeyHex), getBytes(encDoctorAesKeyHex));
  const cryptoKey = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const encBytes  = new Uint8Array(encryptedFileBuffer);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: encBytes.slice(0, 12) }, cryptoKey, encBytes.slice(12));
  return new Uint8Array(decrypted);
}

export default function DoctorDashboard() {
  const navigate    = useNavigate();
  const { state }   = useLocation();
  const address     = state?.address || "";
  const doctor      = state?.doctor  || null;

  const [verified,      setVerified]      = useState(null);
  const [checkingChain, setCheckingChain] = useState(true);
  const [activeTab,     setActiveTab]     = useState("overview");

  // Patient Records tab
  const [nftRecords,    setNftRecords]    = useState([]);
  const [loadingNfts,   setLoadingNfts]   = useState(false);
  const [recordMeta,    setRecordMeta]    = useState({});
  const [decryptingId,  setDecryptingId]  = useState(null);
  const [decryptedUrls, setDecryptedUrls] = useState({});
  const [decryptErrors, setDecryptErrors] = useState({});

  // Record Requests tab
  const [allUsers,         setAllUsers]        = useState([]);
  const [userSearch,       setUserSearch]       = useState("");
  const [selectedUser,     setSelectedUser]     = useState(null);
  const [userRecords,      setUserRecords]      = useState([]);
  const [loadingUserRec,   setLoadingUserRec]   = useState(false);
  const [requestingRecord, setRequestingRecord] = useState(null);
  const [requestSuccess,   setRequestSuccess]   = useState({});
  const [requestError,     setRequestError]     = useState({});
  const [sentRequests,     setSentRequests]     = useState([]);
  const [showDropdown,     setShowDropdown]     = useState(false);
  const searchRef = useRef(null);
  const recordsRef = useRef(null);

  useEffect(() => {
    if (!address) return;
    isDoctorVerified(address)
      .then(v  => { setVerified(v);     setCheckingChain(false); })
      .catch(() => { setVerified(false); setCheckingChain(false); });
  }, [address]);

  useEffect(() => {
    fetchDoctorNFTs();
  }, [activeTab, verified, address]);

  useEffect(() => {
    if (activeTab === "requests") { fetchAllUsers(); fetchSentRequests(); }
  }, [activeTab]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchAllUsers = async () => {
    try {
      const res  = await fetch(`${API}/users`);
      const data = await res.json();
      setAllUsers(Array.isArray(data) ? data : []);
    } catch (e) { console.error("fetchAllUsers:", e); }
  };

  const fetchSentRequests = async () => {
    if (!address) return;
    try {
      const res  = await fetch(`${API}/requests/doctor/${address}`);
      if (!res.ok) { setSentRequests([]); return; }
      const data = await res.json();
      setSentRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error("fetchSentRequests:", e); setSentRequests([]); }
  };

  const fetchRecordMeta = useCallback(async (ipfsHash) => {
    if (!ipfsHash) return;
    setRecordMeta(prev => { if (ipfsHash in prev) return prev; return { ...prev, [ipfsHash]: null }; });
    try {
      const res  = await fetch(`${API}/records/ipfs/${ipfsHash}`);
      if (!res.ok) { setRecordMeta(prev => ({ ...prev, [ipfsHash]: undefined })); return; }
      const data = await res.json();
      setRecordMeta(prev => ({ ...prev, [ipfsHash]: data }));
    } catch { setRecordMeta(prev => ({ ...prev, [ipfsHash]: undefined })); }
  }, []);

  const fetchDoctorNFTs = useCallback(async () => {
    setLoadingNfts(true);
    try {
      const contract = await getMedicalContract();
      const raw      = await contract.getAccessDataByDoctor(address);
      const records  = raw.map(r => ({
        patient: r.patient, doctor: r.doctor, ipfsHash: r.ipfsHash,
        revoked: r.revoked, tokenId: r.tokenId !== undefined ? Number(r.tokenId) : null,
      }));
      setNftRecords(records);
      for (const rec of records) if (rec.ipfsHash) fetchRecordMeta(rec.ipfsHash);
    } catch (e) { console.error("fetchDoctorNFTs:", e); }
    setLoadingNfts(false);
  }, [address, fetchRecordMeta]);

  const fetchUserRecords = async (user) => {
    setLoadingUserRec(true);
    setUserRecords([]);
    try {
      const res = await fetch(`${API}/records`);
      if (!res.ok) throw new Error("Failed to fetch records");
      const allRecords = await res.json();

      const userPubKey = user.pubkey || user.walletAddress;
      const matched = allRecords.filter(
        r => r.userPubKey?.toLowerCase() === userPubKey?.toLowerCase()
      );

      const seen    = new Set();
      const deduped = [];
      for (const rec of matched) {
        const key = rec.fileName ? rec.fileName.trim().toLowerCase() : rec.ipfsHash;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push({
            ipfsHash:          rec.ipfsHash,
            tokenId:           rec.tokenId   ?? null,
            fileName:          rec.fileName  || null,
            userDerivedPubKey: rec.userDerivedPubKey || user.derivedpubkey || null,
          });
        }
      }
      setUserRecords(deduped);
    } catch (e) { console.error("fetchUserRecords:", e); setUserRecords([]); }
    setLoadingUserRec(false);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserSearch(user.name);
    setShowDropdown(false);
    setRequestSuccess({});
    setRequestError({});
    fetchUserRecords(user);
    setTimeout(() => {
      recordsRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  const handleRequestRecord = async (record) => {
    if (!selectedUser || !doctor) return;
    const key = record.ipfsHash;
    setRequestingRecord(key);
    setRequestError(prev => ({ ...prev, [key]: null }));
    try {
      const body = {
        userName:            selectedUser.name,
        userEmail:           selectedUser.email,
        userPubkey:          selectedUser.pubkey,
        userDerivedPubkey:   selectedUser.derivedpubkey,
        doctorName:          doctor.name,
        doctorPubkey:        address,
        doctorDerivedPubkey: doctor.derivedpubkey || "",
        recordName:          record.fileName || record.ipfsHash,
        recordTokenId:       record.tokenId  ?? null,
      };
      const res  = await fetch(`${API}/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setRequestSuccess(prev => ({ ...prev, [key]: true }));
      await fetchSentRequests();
    } catch (e) {
      setRequestError(prev => ({ ...prev, [key]: e.message || "Failed to send request." }));
    }
    setRequestingRecord(null);
  };

  const handleDecryptAndView = async (record) => {
    const key = record.ipfsHash;
    if (decryptedUrls[key]) { window.open(decryptedUrls[key].url, "_blank"); return; }
    setDecryptingId(key);
    setDecryptErrors(prev => ({ ...prev, [key]: null }));
    try {
      const { privateKey: doctorPrivKey } = await deriveUserKeypair(address);
      const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${key}`);
      if (!ipfsRes.ok) throw new Error(`IPFS fetch failed (${ipfsRes.status})`);
      const bundle = JSON.parse(await ipfsRes.text());
      if (!bundle.doctor_encAesKey) throw new Error("No doctor_encAesKey in bundle.");
      if (!bundle.encrypted_file)   throw new Error("No encrypted_file in bundle.");
      const decryptedBytes = await decryptFileForDoctor(base64ToUint8(bundle.encrypted_file).buffer, bundle.doctor_encAesKey, doctorPrivKey);
      const url = URL.createObjectURL(new Blob([decryptedBytes], { type: bundle.mimeType || "application/octet-stream" }));
      setDecryptedUrls(prev => ({ ...prev, [key]: { url } }));
      window.open(url, "_blank");
    } catch (e) { setDecryptErrors(prev => ({ ...prev, [key]: e.message || "Decryption failed." })); }
    setDecryptingId(null);
  };

  const filteredUsers = userSearch.trim().length < 1 ? [] :
    allUsers.filter(u =>
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.walletAddress?.toLowerCase().includes(userSearch.toLowerCase())
    ).slice(0, 8);

  const alreadyRequested = (record) =>
    sentRequests.some(r =>
      r.recordName === (record.fileName || record.ipfsHash) &&
      r.userPubkey === selectedUser?.pubkey &&
      r.status === "pending"
    );

  // ── NEW: check if doctor already has this record in their nftRecords ─────
  // Match by fileName (from recordMeta) AND patient wallet address
  const alreadyHaveRecord = (record) => {
    if (!selectedUser || nftRecords.length === 0) return false;
    const recordFileName = record.fileName?.trim().toLowerCase();
    return nftRecords.some(nft => {
      // must belong to this patient
      const patientMatch =
        nft.patient?.toLowerCase() === selectedUser.walletAddress?.toLowerCase() ||
        nft.patient?.toLowerCase() === selectedUser.pubkey?.toLowerCase();
      if (!patientMatch) return false;
      // must not be revoked
      if (nft.revoked) return false;
      // match by fileName via recordMeta
      if (recordFileName) {
        const meta = recordMeta[nft.ipfsHash];
        const nftFileName = meta?.fileName?.trim().toLowerCase();
        if (nftFileName && nftFileName === recordFileName) return true;
      }
      // fallback: match by ipfsHash directly
      if (nft.ipfsHash === record.ipfsHash) return true;
      return false;
    });
  };

  return (
    <div style={S.root}>
      <div style={S.orb1} /><div style={S.orb2} /><div style={S.gridBg} />
      <div style={S.container}>

        <nav style={S.nav}>
          <span style={S.logo}>Health<span style={{ color: "#06b6d4" }}>Chain</span></span>
          <div style={S.navRight}>
            <span style={S.networkBadge}>⬡ Sepolia</span>
            {address && <span style={S.addrBadge}>{address.slice(0,6)}…{address.slice(-4)}</span>}
            <button style={S.logoutBtn} onClick={() => navigate("/")}>Disconnect</button>
          </div>
        </nav>

        <div style={S.header}>
          <div style={S.avatarWrap}><span style={{ fontSize: 38 }}>🩺</span></div>
          <div>
            <h1 style={S.welcome}>{doctor?.name ? `Dr. ${doctor.name}` : "Doctor Dashboard"}</h1>
            <p style={S.subtitle}>{doctor?.email || ""}</p>
          </div>
        </div>

        <div style={{ ...S.verifyBanner, background: checkingChain ? "rgba(100,116,139,0.1)" : verified ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${checkingChain ? "rgba(100,116,139,0.2)" : verified ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}` }}>
          <div style={S.verifyBannerLeft}>
            <span style={{ fontSize: 28 }}>{checkingChain ? "⏳" : verified ? "✅" : "🔒"}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: checkingChain ? "#94a3b8" : verified ? "#10b981" : "#f59e0b" }}>
                {checkingChain ? "Checking on-chain status..." : verified ? "Verified Doctor — Full Access" : "Pending Admin Verification"}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                {checkingChain ? "Querying the smart contract..." : verified ? "Your credentials have been confirmed on the Sepolia blockchain." : "An admin needs to review your credentials and verify you on-chain."}
              </div>
            </div>
          </div>
          {!checkingChain && !verified && <span style={S.pendingBadge}>Under Review</span>}
          {!checkingChain &&  verified  && <span style={S.verifiedBadge}>On-Chain ✓</span>}
        </div>

        <div style={S.tabBar}>
          {[{ key: "overview", icon: "🏠", label: "Overview" }, { key: "patients", icon: "👥", label: "Patient Records" }, { key: "requests", icon: "📨", label: "Record Requests" }].map(t => (
            <button key={t.key} style={{ ...S.tabBtn, ...(activeTab === t.key ? S.tabBtnActive : {}) }} onClick={() => setActiveTab(t.key)}>
              <span style={{ fontSize: 16 }}>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <>
            <div style={S.statsGrid}>
              <StatCard icon="👥" label="Unique Patients" value={verified ? [...new Set(nftRecords.map(r => r.patient))].length || "—" : "Locked"} color="#06b6d4" locked={!verified} />
              <StatCard icon="🗂️" label="Active Records"  value={verified ? nftRecords.filter(r => !r.revoked).length || "—" : "Locked"} color="#8b5cf6" locked={!verified} />
              <StatCard icon="📋" label="Docs Submitted"  value={doctor?.docs?.length ?? "—"} color="#10b981" />
              <StatCard icon="📅" label="Joined" value={doctor?.createdAt ? new Date(doctor.createdAt).toLocaleDateString() : "—"} color="#f59e0b" />
            </div>
            {doctor && (
              <div style={S.infoCard}>
                <h3 style={S.infoCardTitle}>Profile Details</h3>
                <div style={S.infoGrid}>
                  <InfoItem icon="📧" label="Email"     value={doctor.email} />
                  <InfoItem icon="📱" label="Phone"     value={doctor.phoneNumber} />
                  <InfoItem icon="🔑" label="Wallet"    value={`${doctor.walletAddress?.slice(0,10)}…${doctor.walletAddress?.slice(-8)}`} mono />
                  <InfoItem icon="📄" label="Documents" value={`${doctor.docs?.length || 0} file(s) submitted`} />
                </div>
              </div>
            )}
            {!checkingChain && !verified && (
              <div style={S.lockedCard}>
                <span style={{ fontSize: 40 }}>⏳</span>
                <h3 style={{ color: "#f0f4ff", margin: "12px 0 8px", fontWeight: 700 }}>Awaiting Admin Verification</h3>
                <p style={{ color: "#64748b", fontSize: 14, maxWidth: 420, textAlign: "center", lineHeight: 1.7, margin: 0 }}>Your credentials are being reviewed. Once an admin verifies your wallet on-chain, you'll gain full access to patient records and medical data management.</p>
              </div>
            )}
          </>
        )}

        {/* PATIENT RECORDS */}
        {activeTab === "patients" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <h2 style={S.panelTitle}>Patient Records</h2>
              <p style={S.panelSubtitle}>NFT-gated medical records shared with you by patients.</p>
            </div>
            <div style={S.panelBody}>
              {!verified && !checkingChain ? <LockedNote /> :
               loadingNfts ? <CenterBox><Spinner color="#06b6d4" size={28} /><Muted>Fetching on-chain records…</Muted></CenterBox> :
               nftRecords.length === 0 ? <EmptyCard icon="📭" title="No Records Yet" desc="No patients have shared medical records with you yet." /> : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button style={S.refreshBtn} onClick={fetchDoctorNFTs}>↻ Refresh</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {nftRecords.map((record, i) => {
                      const meta = recordMeta[record.ipfsHash];
                      const isLoadingMeta = meta === null;
                      const isDecrypted  = !!decryptedUrls[record.ipfsHash];
                      const isDecrypting = decryptingId === record.ipfsHash;
                      const decryptErr   = decryptErrors[record.ipfsHash];
                      return (
                        <div key={i} style={{ ...S.recordCard, opacity: record.revoked ? 0.45 : 1 }}>
                          <div style={S.recordTop}>
                            <div style={S.fileIconWrap}><span style={{ fontSize: 20 }}>📄</span></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isLoadingMeta
                                ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner color="#475569" size={12} /><span style={{ color: "#475569", fontSize: 13 }}>Loading…</span></div>
                                : meta?.fileName
                                  ? <div style={S.recordFileName}>{meta.fileName}</div>
                                  : <div style={{ color: "#475569", fontFamily: "monospace", fontSize: 12 }}>{record.ipfsHash.slice(0,24)}…</div>
                              }
                              {record.revoked && <span style={{ ...S.revokedBadge, marginTop: 4, display: "inline-block" }}>Revoked</span>}
                            </div>
                            {record.tokenId != null && <span style={S.tokenBadge}>#{record.tokenId}</span>}
                          </div>
                          <div style={S.metaRow}>
                            <div style={S.metaItem}>
                              <span style={S.metaIcon}>👤</span>
                              <div>
                                <div style={S.metaLabel}>Patient</div>
                                <div style={S.metaValue}>{isLoadingMeta ? "—" : meta?.userName || <span style={{ fontFamily: "monospace", color: "#475569", fontSize: 11 }}>{record.patient?.slice(0,18)}…</span>}</div>
                              </div>
                            </div>
                          </div>
                          {decryptErr && <div style={S.errorBox}><span>⚠️</span><span>{decryptErr}</span></div>}
                          {!record.revoked && (
                            <div style={S.recordActions}>
                              <button style={{ ...S.decryptBtn, opacity: isDecrypting ? 0.6 : 1, cursor: isDecrypting ? "wait" : "pointer", background: isDecrypted ? "rgba(16,185,129,0.1)" : "rgba(6,182,212,0.1)", borderColor: isDecrypted ? "rgba(16,185,129,0.3)" : "rgba(6,182,212,0.3)", color: isDecrypted ? "#10b981" : "#06b6d4" }} onClick={() => handleDecryptAndView(record)} disabled={isDecrypting}>
                                {isDecrypting ? <><Spinner color="#06b6d4" size={11} />&nbsp;Decrypting…</> : isDecrypted ? "🔓 Open File" : "🔓 Decrypt & View"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* RECORD REQUESTS */}
        {activeTab === "requests" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <h2 style={S.panelTitle}>Record Requests</h2>
              <p style={S.panelSubtitle}>Search for a patient, browse their stored records, and send an access request. The patient will be notified by email.</p>
            </div>
            <div style={S.panelBody}>
              {!verified && !checkingChain ? <LockedNote /> : (
                <>
                  <div style={S.fieldGroup}>
                    <label style={S.fieldLabel}>Search Patient</label>
                    <div style={{ position: "relative" }} ref={searchRef}>
                      <div style={{ ...S.inputWrap, borderColor: selectedUser ? "rgba(6,182,212,0.5)" : "rgba(255,255,255,0.08)" }}>
                        <span style={{ fontSize: 15, opacity: 0.45 }}>🔍</span>
                        <input style={S.input} placeholder="Search by name, email or wallet address…" value={userSearch}
                          onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); setUserRecords([]); setShowDropdown(true); }}
                          onFocus={() => { if (userSearch.trim().length > 0) setShowDropdown(true); }} />
                        {selectedUser && (
                          <div ref={recordsRef}>
                            <button style={S.clearBtn} onClick={() => { setUserSearch(""); setSelectedUser(null); setUserRecords([]); setShowDropdown(false); }}>✕</button>
                          </div>
                        )}
                      </div>
                      {showDropdown && filteredUsers.length > 0 && (
                        <div style={S.dropdown}>
                          {filteredUsers.map(user => (
                            <div key={user._id} style={S.dropdownItem} onMouseDown={() => handleSelectUser(user)}>
                              <div style={S.dropdownAvatar}><span style={{ fontSize: 16 }}>👤</span></div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{user.name}</div>
                                <div style={{ color: "#475569", fontSize: 12 }}>{user.email}</div>
                              </div>
                              <div style={{ fontFamily: "monospace", color: "#334155", fontSize: 11 }}>{user.walletAddress?.slice(0,8)}…</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {showDropdown && userSearch.trim().length > 0 && filteredUsers.length === 0 && (
                        <div style={S.dropdown}><div style={{ padding: "16px 14px", color: "#475569", fontSize: 13, textAlign: "center" }}>No patients found</div></div>
                      )}
                    </div>
                  </div>

                  {selectedUser && (
                    <div style={S.selectedUserPill}>
                      <div style={S.selectedUserAvatar}><span style={{ fontSize: 20 }}>👤</span></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>{selectedUser.name}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{selectedUser.email}</div>
                      </div>
                      <div style={{ fontFamily: "monospace", color: "#334155", fontSize: 11 }}>{selectedUser.walletAddress?.slice(0,12)}…</div>
                    </div>
                  )}

                  {selectedUser && (
                    <>
                      <div style={S.sectionDivider}>
                        <span style={S.sectionLabel}>Stored Records</span>
                        <span style={{ color: "#334155", fontSize: 12 }}>{loadingUserRec ? "loading…" : `${userRecords.length} record${userRecords.length !== 1 ? "s" : ""}`}</span>
                      </div>
                      {loadingUserRec ? (
                        <CenterBox><Spinner color="#06b6d4" size={24} /><Muted>Fetching records…</Muted></CenterBox>
                      ) : userRecords.length === 0 ? (
                        <div style={S.emptyNote}>
                          <span style={{ fontSize: 22 }}>📭</span>
                          <span style={{ color: "#64748b", fontSize: 13 }}>{selectedUser.name} has no stored records yet.</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, maxHeight: "400px", overflowY: "auto" }}>
                          {userRecords.map((rec, i) => {
                            const displayName  = rec.fileName || rec.ipfsHash.slice(0,20) + "…";
                            const alreadyHave  = alreadyHaveRecord(rec);   // ← NEW
                            const isPending    = !alreadyHave && alreadyRequested(rec);
                            const isRequesting = requestingRecord === rec.ipfsHash;
                            const wasJustSent  = requestSuccess[rec.ipfsHash];
                            const reqErr       = requestError[rec.ipfsHash];
                            return (
                              <div key={i} style={S.reqRecordCard}>
                                <div style={S.reqRecordLeft}>
                                  <div style={S.reqFileIcon}><span style={{ fontSize: 18 }}>📄</span></div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                                    <div style={{ fontFamily: "monospace", color: "#334155", fontSize: 11, marginTop: 2 }}>{rec.ipfsHash.slice(0,24)}…</div>
                                  </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                  {rec.tokenId != null && <span style={S.tokenBadge}>#{rec.tokenId}</span>}
                                  {/* ── NEW: already have badge takes top priority ── */}
                                  {alreadyHave ? (
                                    <span style={S.alreadyHaveBadge}>✓ Already Have It</span>
                                  ) : wasJustSent ? (
                                    <span style={S.sentBadge}>✓ Request Sent</span>
                                  ) : isPending ? (
                                    <span style={S.pendingReqBadge}>⏳ Pending</span>
                                  ) : (
                                    <button style={{ ...S.requestBtn, opacity: isRequesting ? 0.6 : 1, cursor: isRequesting ? "wait" : "pointer" }} onClick={() => handleRequestRecord(rec)} disabled={isRequesting}>
                                      {isRequesting ? <><Spinner color="#000" size={11} />&nbsp;Sending…</> : "📨 Request Record"}
                                    </button>
                                  )}
                                </div>
                                {reqErr && <div style={{ width: "100%", marginTop: 4 }}><div style={{ ...S.errorBox, padding: "8px 12px" }}><span>⚠️</span><span style={{ fontSize: 12 }}>{reqErr}</span></div></div>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {!selectedUser && !userSearch && (
                    <div style={S.searchPlaceholder}>
                      <span style={{ fontSize: 40 }}>🔍</span>
                      <h3 style={{ color: "#f0f4ff", margin: "12px 0 6px", fontWeight: 700, fontSize: 16 }}>Search for a Patient</h3>
                      <p style={{ color: "#475569", fontSize: 13, maxWidth: 320, textAlign: "center", lineHeight: 1.7, margin: 0 }}>Type a patient's name, email, or wallet address to view their stored records and send an access request.</p>
                    </div>
                  )}
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
    <div style={{ ...S.statCard, opacity: locked ? 0.5 : 1 }}>
      <div style={{ ...S.statIcon, background: `${color}12`, border: `1px solid ${color}25` }}><span style={{ fontSize: 22 }}>{locked ? "🔒" : icon}</span></div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
    </div>
  );
}
function InfoItem({ icon, label, value, mono }) {
  return (
    <div style={S.infoItem}>
      <span style={S.infoItemIcon}>{icon}</span>
      <div>
        <div style={S.infoItemLabel}>{label}</div>
        <div style={{ ...S.infoItemValue, fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 12 : 14 }}>{value}</div>
      </div>
    </div>
  );
}
function LockedNote() {
  return (
    <div style={S.lockedCard}>
      <span style={{ fontSize: 36 }}>🔒</span>
      <h3 style={{ color: "#f0f4ff", margin: "12px 0 8px", fontWeight: 700 }}>Access Restricted</h3>
      <p style={{ color: "#64748b", fontSize: 14, maxWidth: 380, textAlign: "center", lineHeight: 1.7, margin: 0 }}>You need to be verified on-chain before accessing patient records.</p>
    </div>
  );
}
function EmptyCard({ icon, title, desc }) {
  return (
    <div style={S.emptyCard}>
      <span style={{ fontSize: 44 }}>{icon}</span>
      <h3 style={{ color: "#f0f4ff", margin: "14px 0 8px", fontWeight: 700 }}>{title}</h3>
      <p style={{ color: "#64748b", fontSize: 14, maxWidth: 340, textAlign: "center", lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </div>
  );
}
function CenterBox({ children }) { return <div style={S.centerBox}>{children}</div>; }
function Muted({ children }) { return <span style={{ color: "#64748b", fontSize: 13 }}>{children}</span>; }
function Spinner({ color = "#fff", size = 14 }) {
  return <span style={{ width: size, height: size, border: `2px solid ${color}30`, borderTopColor: color, borderRadius: "50%", display: "inline-block", animation: "hc-spin 0.7s linear infinite", flexShrink: 0 }} />;
}

const S = {
  root: { minHeight: "100vh", background: "#060a12", fontFamily: "'DM Sans','Segoe UI',sans-serif", position: "relative", overflow: "auto" },
  orb1: { position: "fixed", top: "-10%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.09) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  orb2: { position: "fixed", bottom: "-10%", right: "-5%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  gridBg: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(6,182,212,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,0.02) 1px,transparent 1px)", backgroundSize: "60px 60px" },
  container: { maxWidth: 900, margin: "0 auto", padding: "0 24px 80px", position: "relative", zIndex: 1 },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 40 },
  logo: { fontSize: 22, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.5px" },
  navRight: { display: "flex", alignItems: "center", gap: 10 },
  networkBadge: { background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#06b6d4", padding: "5px 12px", borderRadius: 100, fontSize: 12 },
  addrBadge: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontFamily: "monospace" },
  logoutBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  header: { display: "flex", alignItems: "center", gap: 20, marginBottom: 28 },
  avatarWrap: { width: 80, height: 80, borderRadius: 20, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  welcome: { fontSize: 28, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  subtitle: { fontSize: 14, color: "#64748b", margin: 0 },
  verifyBanner: { borderRadius: 16, padding: "18px 22px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  verifyBannerLeft: { display: "flex", alignItems: "center", gap: 16 },
  pendingBadge: { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600 },
  verifiedBadge: { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600 },
  tabBar: { display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" },
  tabBtn: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b", padding: "11px 20px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600 },
  tabBtnActive: { background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.35)", color: "#06b6d4" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 28 },
  statCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 },
  statIcon: { width: 46, height: 46, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  infoCard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "22px 24px", marginBottom: 28 },
  infoCardTitle: { fontSize: 14, fontWeight: 700, color: "#94a3b8", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 },
  infoItem: { display: "flex", alignItems: "flex-start", gap: 12 },
  infoItemIcon: { fontSize: 18, marginTop: 2 },
  infoItemLabel: { fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 },
  infoItemValue: { color: "#e2e8f0" },
  lockedCard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center" },
  panel: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" },
  panelHeader: { padding: "24px 28px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  panelTitle: { fontSize: 18, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  panelSubtitle: { fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 },
  panelBody: { padding: "22px 28px", display: "flex", flexDirection: "column", gap: 16, minHeight: "400px" },
  centerBox: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 32px", gap: 8 },
  emptyNote: { display: "flex", alignItems: "center", gap: 12, padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" },
  recordCard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 },
  recordTop: { display: "flex", alignItems: "center", gap: 12 },
  fileIconWrap: { width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.18)", display: "flex", alignItems: "center", justifyContent: "center" },
  recordFileName: { color: "#e2e8f0", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 20, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" },
  metaItem: { display: "flex", alignItems: "flex-start", gap: 8 },
  metaIcon: { fontSize: 15, marginTop: 1 },
  metaLabel: { fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 },
  metaValue: { fontSize: 13, color: "#94a3b8" },
  recordActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 4 },
  decryptBtn: { display: "flex", alignItems: "center", gap: 6, border: "1px solid", padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 },
  rawLink: { color: "#475569", fontSize: 12, textDecoration: "none", fontWeight: 600, padding: "6px 12px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" },
  errorBox: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", color: "#fca5a5", fontSize: 13, display: "flex", gap: 8, alignItems: "center" },
  tokenBadge: { background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#8b5cf6", padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, flexShrink: 0 },
  revokedBadge: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 },
  refreshBtn: { display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#64748b", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  inputWrap: { display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: 12, padding: "12px 14px" },
  input: { background: "none", border: "none", outline: "none", color: "#f0f4ff", fontSize: 14, width: "100%" },
  clearBtn: { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 },
  dropdown: { position: "absolute", maxHeight: "250px", overflowY: "auto", top: "calc(100% + 6px)", left: 0, right: 0, background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, zIndex: 50, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.6)" },
  dropdownItem: { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  dropdownAvatar: { width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center" },
  selectedUserPill: { display: "flex", alignItems: "center", gap: 14, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 14, padding: "14px 16px" },
  selectedUserAvatar: { width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", display: "flex", alignItems: "center", justifyContent: "center" },
  sectionDivider: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" },
  reqRecordCard: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" },
  reqRecordLeft: { display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  reqFileIcon: { width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)", display: "flex", alignItems: "center", justifyContent: "center" },
  requestBtn: { display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#06b6d4,#0284c7)", border: "none", color: "#000", padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 },
  sentBadge: { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600 },
  pendingReqBadge: { background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600 },
  // ── NEW badge style ──────────────────────────────────────────────────────
  alreadyHaveBadge: { background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600 },
  searchPlaceholder: { display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 32px", gap: 8 },
};