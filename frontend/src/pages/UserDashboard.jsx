import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isDoctorVerified, getMedicalContract } from "../utils/contract";
import { deriveUserKeypair } from "../utils/deriveKeypair";
import { encrypt, decrypt } from "eciesjs";
import { getBytes, hexlify } from "ethers";

const API = "http://localhost:5010/api";
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// ─── Crypto helpers ────────────────────────────────────────────────────────────

function uint8ToBase64(bytes) {
  let b = "";
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}

function base64ToUint8(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptFileForUser(file, userDerivedPubKey) {
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const aesKey    = crypto.getRandomValues(new Uint8Array(32));
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher    = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, fileBytes);
  const encryptedFile    = new Uint8Array([...iv, ...new Uint8Array(cipher)]);
  const encUserAesKeyHex = hexlify(encrypt(getBytes(userDerivedPubKey), aesKey));
  return { encryptedFile, encUserAesKeyHex };
}

async function decryptFileForUser(encryptedFileBuffer, encUserAesKeyHex, userPrivKeyHex) {
  const aesKey    = decrypt(getBytes(userPrivKeyHex), getBytes(encUserAesKeyHex));
  const cryptoKey = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const encBytes  = new Uint8Array(encryptedFileBuffer);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: encBytes.slice(0, 12) }, cryptoKey, encBytes.slice(12));
  return new Uint8Array(decrypted);
}

async function reencryptAesKeyForDoctor(encUserAesKeyHex, userPrivKeyHex, doctorDerivedPubKey) {
  const rawAesKey = decrypt(getBytes(userPrivKeyHex), getBytes(encUserAesKeyHex));
  return hexlify(encrypt(getBytes(doctorDerivedPubKey), rawAesKey));
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UserDashboard() {
  const navigate  = useNavigate();
  const { state } = useLocation();
  const address   = state?.address   || "";
  const user      = state?.user      || null;
  const publicKey = state?.publicKey || "";

  const [activeTab, setActiveTab] = useState("store");

  // Doctors
  const [doctors, setDoctors]               = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // ── Store tab
  const [storeFile, setStoreFile]       = useState(null);
  const [storeLabel, setStoreLabel]     = useState("");
  const [storing, setStoring]           = useState(false);
  const [storeStep, setStoreStep]       = useState("");
  const [storeError, setStoreError]     = useState("");
  const [storeSuccess, setStoreSuccess] = useState("");

  // ── Share tab
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [uploading, setUploading]           = useState(false);
  const [uploadStep, setUploadStep]         = useState("");
  const [uploadError, setUploadError]       = useState("");
  const [uploadSuccess, setUploadSuccess]   = useState("");

  // ── My Files tab
  const [patientRecords, setPatientRecords]               = useState([]);
  const [loadingPatientRecords, setLoadingPatientRecords] = useState(false);
  const [revoking, setRevoking]                           = useState(null);
  const [decryptingId, setDecryptingId]                   = useState(null);
  const [decryptedUrls, setDecryptedUrls]                 = useState({});
  const [decryptErrors, setDecryptErrors]                 = useState({});

  // ── Self-stored records
  const [selfStored, setSelfStored]               = useState([]);
  const [loadingSelfStored, setLoadingSelfStored] = useState(false);

  // ── Record Requests tab
  const [recordRequests, setRecordRequests]   = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  // per-request approval state: { [requestId]: { step, error, success, loading } }
  const [approvalState, setApprovalState]     = useState({});

  // ─── DB helpers ───────────────────────────────────────────────────────────

  const fetchDbRecordsMap = async () => {
    try {
      const r = await fetch(`${API}/records`);
      if (!r.ok) return {};
      const all = await r.json();
      const map = {};
      for (const rec of all) map[rec.ipfsHash] = rec;
      return map;
    } catch { return {}; }
  };

  // ─── fetchSelfStored ──────────────────────────────────────────────────────
  const fetchSelfStored = useCallback(async () => {
    if (!address) return;
    setLoadingSelfStored(true);
    try {
      const contract = await getMedicalContract();
      const raw      = await contract.getAccessDataByPatient(address);
      const dbMap    = await fetchDbRecordsMap();

      const results = raw
        .filter(r => (!r.doctor || r.doctor === ZERO_ADDR) && !r.revoked)
        .map(r => {
          const db = dbMap[r.ipfsHash];
          return {
            ipfsHash:          r.ipfsHash,
            fileName:          db?.fileName || r.ipfsHash,
            tokenId:           db?.tokenId  ?? null,
            userDerivedPubKey: db?.userDerivedPubKey || null,
          };
        });

      setSelfStored(results);
    } catch (e) { console.error("fetchSelfStored:", e); }
    setLoadingSelfStored(false);
  }, [address]);

  // ─── fetchPatientRecords ──────────────────────────────────────────────────
  const fetchPatientRecords = useCallback(async () => {
    if (!address) return;
    setLoadingPatientRecords(true);
    try {
      const contract = await getMedicalContract();
      const raw      = await contract.getAccessDataByPatient(address);
      const dbMap    = await fetchDbRecordsMap();

      const records = raw.map(r => {
        const db           = dbMap[r.ipfsHash];
        const isSelfStored = !r.doctor || r.doctor === ZERO_ADDR;
        const docMatch     = !isSelfStored
          ? doctors.find(d => d.walletAddress?.toLowerCase() === r.doctor?.toLowerCase())
          : null;
        return {
          patient:           r.patient,
          doctor:            r.doctor,
          ipfsHash:          r.ipfsHash,
          revoked:           r.revoked,
          fileName:          db?.fileName          || r.ipfsHash.slice(0, 14) + "…",
          tokenId:           db?.tokenId           ?? null,
          userDerivedPubKey: db?.userDerivedPubKey || null,
          doctorName:        docMatch?.name        || null,
          isSelfStored,
        };
      });
      setPatientRecords(records);
    } catch (e) { console.error("fetchPatientRecords:", e); }
    setLoadingPatientRecords(false);
  }, [address, doctors]);

  // ─── fetchDoctors ──────────────────────────────────────────────────────────
  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const data = await (await fetch(`${API}/doctors`)).json();
      const withChain = await Promise.all(
        data.map(async doc => {
          try { return { ...doc, onChainVerified: await isDoctorVerified(doc.walletAddress) }; }
          catch { return { ...doc, onChainVerified: false }; }
        })
      );
      setDoctors(withChain);
    } catch (e) { console.error("fetchDoctors:", e); }
    setLoadingDoctors(false);
  }, []);

  // ─── fetchRecordRequests ───────────────────────────────────────────────────
  const fetchRecordRequests = useCallback(async () => {
    if (!publicKey && !address) return;
    setLoadingRequests(true);
    try {
      const res  = await fetch(`${API}/requests/user/${publicKey || address}`);
      if (!res.ok) { setRecordRequests([]); setLoadingRequests(false); return; }
      const data = await res.json();
      setRecordRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error("fetchRecordRequests:", e); setRecordRequests([]); }
    setLoadingRequests(false);
  }, [address, publicKey]);

  // ─── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDoctors();
    fetchSelfStored();
  }, [fetchDoctors, fetchSelfStored]);

  // Fetch patient records once doctors are loaded (needed for isAlreadySharedWith)
  useEffect(() => {
    if (doctors.length > 0) fetchPatientRecords();
  }, [doctors]);

  // ─── Tab switch side-effects ──────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "upload")   fetchSelfStored();
    if (activeTab === "view")     fetchPatientRecords();
    if (activeTab === "requests") {
      fetchRecordRequests();
      fetchSelfStored();
      fetchPatientRecords();
    }
  }, [activeTab]);

  // ─── Derived: names already used ──────────────────────────────────────────
  const usedFileNames = new Set(
    selfStored
      .filter(r => r.fileName !== r.ipfsHash)
      .map(r => r.fileName.trim().toLowerCase())
  );
  const labelConflict = storeLabel.trim().length > 0
    && usedFileNames.has(storeLabel.trim().toLowerCase());

  // ─── Derived: group self-stored by fileName ───────────────────────────────
  const groupedSelfStored = selfStored.reduce((acc, r) => {
    const key = r.fileName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // ─── Derived: group all patient records by fileName ───────────────────────
  const groupedPatientRecords = patientRecords.reduce((acc, r) => {
    const k = r.fileName;
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});

  // ─── Helper: is a record already shared with a specific doctor? ───────────
  const isAlreadySharedWith = (recordName, doctorWalletAddress) => {
    return patientRecords.some(r =>
      !r.isSelfStored &&
      !r.revoked &&
      r.fileName?.trim().toLowerCase() === recordName?.trim().toLowerCase() &&
      r.doctor?.toLowerCase() === doctorWalletAddress?.toLowerCase()
    );
  };

  // ─── Core share logic (reused by Share tab + Request approval) ────────────
  const performShare = async ({ sourceRecord, doctorWalletAddress, doctorDerivedPubKey, doctorName, onStep }) => {
    onStep("Deriving your decryption keys (sign in MetaMask)…");
    const { privateKey: userPrivKey } = await deriveUserKeypair(address);

    onStep("Fetching encrypted bundle from IPFS…");
    const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${sourceRecord.ipfsHash}`);
    if (!ipfsRes.ok) throw new Error("IPFS fetch failed");
    const bundle = JSON.parse(await ipfsRes.text());
    if (!bundle.user_encAesKey) throw new Error("Bundle is missing user_encAesKey.");

    onStep("Re-encrypting AES key for doctor…");
    if (!doctorDerivedPubKey) throw new Error("Doctor's derived public key not found.");
    const doctor_encAesKey = await reencryptAesKeyForDoctor(
      bundle.user_encAesKey, userPrivKey, doctorDerivedPubKey
    );

    const newBundle = JSON.stringify({
      encrypted_file:   bundle.encrypted_file,
      user_encAesKey:   bundle.user_encAesKey,
      doctor_encAesKey,
      mimeType:         bundle.mimeType,
      originalName:     bundle.originalName,
    });

    onStep("Uploading shared bundle to IPFS…");
    const fd = new FormData();
    fd.append("file", new Blob([newBundle], { type: "application/json" }), `shared.enc.json`);
    const uploadRes = await fetch(`${API}/ipfs/upload`, { method: "POST", body: fd });
    if (!uploadRes.ok) throw new Error("IPFS upload failed");
    const { cid } = await uploadRes.json();

    onStep("Minting access NFT (approve in MetaMask)…");
    const contract = await getMedicalContract();
    const tx       = await contract.mintAccessNFT(address, doctorWalletAddress, cid);
    const receipt  = await tx.wait();

    let tokenId = null;
    for (const log of receipt.logs ?? []) {
      try {
        const p = contract.interface.parseLog(log);
        if (p?.name === "Transfer") { tokenId = Number(p.args.tokenId); break; }
      } catch {}
    }

    onStep("Saving metadata to database…");
    await fetch(`${API}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId,
        fileName:          sourceRecord.fileName,
        ipfsHash:          cid,
        userPubKey:        publicKey,
        userDerivedPubKey: sourceRecord.userDerivedPubKey || user?.derivedpubkey || "",
        userName:          user?.name || "Unknown",
      }),
    });

    return { tokenId, doctorName };
  };

  // ─── STORE handler ─────────────────────────────────────────────────────────
  const handleStore = async () => {
    if (!storeFile || !storeLabel.trim() || labelConflict) return;
    setStoring(true); setStoreError(""); setStoreSuccess("");
    try {
      setStoreStep("Sign in MetaMask to derive your encryption keys…");
      const { privateKey: userPrivKey, publicKey: userDerivedPubKey } = await deriveUserKeypair(address);

      setStoreStep("Encrypting your file…");
      const { encryptedFile, encUserAesKeyHex } = await encryptFileForUser(storeFile, userDerivedPubKey);

      const bundle = JSON.stringify({
        encrypted_file:   uint8ToBase64(encryptedFile),
        user_encAesKey:   encUserAesKeyHex,
        doctor_encAesKey: null,
        mimeType:         storeFile.type,
        originalName:     storeFile.name,
      });

      setStoreStep("Uploading encrypted bundle to IPFS…");
      const fd = new FormData();
      fd.append("file", new Blob([bundle], { type: "application/json" }), `${storeFile.name}.enc.json`);
      const ipfsRes = await fetch(`${API}/ipfs/upload`, { method: "POST", body: fd });
      if (!ipfsRes.ok) throw new Error("IPFS upload failed");
      const { cid } = await ipfsRes.json();

      setStoreStep("Registering on blockchain (approve in MetaMask)…");
      const contract = await getMedicalContract();
      const tx       = await contract.justStore(cid);
      const receipt  = await tx.wait();

      let tokenId = null;
      for (const log of receipt.logs ?? []) {
        try {
          const p = contract.interface.parseLog(log);
          if (p?.name === "Transfer") { tokenId = Number(p.args.tokenId); break; }
        } catch {}
      }

      setStoreStep("Saving metadata to database…");
      await fetch(`${API}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId, fileName: storeLabel.trim(), ipfsHash: cid,
          userPubKey: publicKey, userDerivedPubKey, userName: user?.name || "Unknown",
        }),
      });

      await fetchSelfStored();
      setStoreSuccess(`"${storeLabel.trim()}" stored! Token #${tokenId}`);
      setStoreFile(null); setStoreLabel(""); setStoreStep("");
    } catch (e) {
      console.error(e);
      setStoreError(e.message || "Store failed. Please try again.");
      setStoreStep("");
    }
    setStoring(false);
  };

  // ─── SHARE handler (Share tab) ─────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedRecord || !selectedDoctor) return;
    setUploading(true); setUploadError(""); setUploadSuccess("");
    try {
      await performShare({
        sourceRecord:        selectedRecord,
        doctorWalletAddress: selectedDoctor.walletAddress,
        doctorDerivedPubKey: selectedDoctor.derivedpubkey,
        doctorName:          selectedDoctor.name,
        onStep:              setUploadStep,
      });
      setUploadSuccess(`"${selectedRecord.fileName}" shared with Dr. ${selectedDoctor.name}!`);
      setSelectedRecord(null); setSelectedDoctor(null); setUploadStep("");
      await fetchSelfStored();
      await fetchPatientRecords();
    } catch (e) {
      console.error(e);
      setUploadError(e.message || "Upload failed. Please try again.");
      setUploadStep("");
    }
    setUploading(false);
  };

  // ─── APPROVE REQUEST handler ───────────────────────────────────────────────
  const handleApproveRequest = async (req) => {
    const reqId = req._id;

    // Find the self-stored record matching the requested recordName
    const sourceRecord = selfStored.find(
      r => r.fileName?.trim().toLowerCase() === req.recordName?.trim().toLowerCase()
    );
    if (!sourceRecord) {
      setApprovalState(prev => ({
        ...prev,
        [reqId]: { loading: false, step: "", error: `Could not find stored record "${req.recordName}". Make sure it is stored on-chain.`, success: null },
      }));
      return;
    }

    // Find the doctor to get derivedpubkey
    const doctor = doctors.find(
      d => d.walletAddress?.toLowerCase() === req.doctorPubkey?.toLowerCase()
    );
    const doctorDerivedPubKey = doctor?.derivedpubkey || req.doctorDerivedPubkey || null;

    setApprovalState(prev => ({ ...prev, [reqId]: { loading: true, step: "", error: null, success: null } }));

    try {
      await performShare({
        sourceRecord,
        doctorWalletAddress: req.doctorPubkey,
        doctorDerivedPubKey,
        doctorName:          req.doctorName,
        onStep: (step) => setApprovalState(prev => ({ ...prev, [reqId]: { ...prev[reqId], step } })),
      });

      // Mark request as approved in backend
      await fetch(`${API}/requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });

      setApprovalState(prev => ({
        ...prev,
        [reqId]: { loading: false, step: "", error: null, success: `Shared with Dr. ${req.doctorName}!` },
      }));

      // Refresh so My Files and badges update
      await fetchSelfStored();
      await fetchPatientRecords();
      await fetchRecordRequests();
    } catch (e) {
      console.error("Approve error:", e);
      setApprovalState(prev => ({
        ...prev,
        [reqId]: { loading: false, step: "", error: e.message || "Approval failed.", success: null },
      }));
    }
  };

  // ─── REVOKE handler ────────────────────────────────────────────────────────
  const handleRevoke = async (tokenId) => {
    if (tokenId == null) return;
    setRevoking(tokenId);
    try {
      const contract = await getMedicalContract();
      const tx = await contract.revokeAccess(tokenId);
      await tx.wait();
      setPatientRecords(prev => prev.map(r => r.tokenId === tokenId ? { ...r, revoked: true } : r));
    } catch (e) { console.error("Revoke failed:", e); }
    setRevoking(null);
  };

  // ─── DECRYPT & VIEW handler ────────────────────────────────────────────────
  const handleDecryptAndView = async (record) => {
    const key = record.ipfsHash;
    if (decryptedUrls[key]) { window.open(decryptedUrls[key].url, "_blank"); return; }
    setDecryptingId(key);
    setDecryptErrors(prev => ({ ...prev, [key]: null }));
    try {
      const { privateKey: userPrivKey } = await deriveUserKeypair(address);
      const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${key}`);
      if (!ipfsRes.ok) throw new Error(`IPFS fetch failed (${ipfsRes.status})`);
      const bundle = JSON.parse(await ipfsRes.text());
      if (!bundle.user_encAesKey) throw new Error("No user_encAesKey in bundle.");
      if (!bundle.encrypted_file) throw new Error("No encrypted_file in bundle.");
      const decryptedBytes = await decryptFileForUser(
        base64ToUint8(bundle.encrypted_file).buffer, bundle.user_encAesKey, userPrivKey
      );
      const url = URL.createObjectURL(new Blob([decryptedBytes], { type: bundle.mimeType || "application/octet-stream" }));
      setDecryptedUrls(prev => ({ ...prev, [key]: { url } }));
      window.open(url, "_blank");
    } catch (e) {
      console.error("Decrypt error:", e);
      setDecryptErrors(prev => ({ ...prev, [key]: e.message || "Decryption failed." }));
    }
    setDecryptingId(null);
  };

  // ─── Derived: pending request count for tab badge ─────────────────────────
  const pendingCount = recordRequests.filter(r => r.status === "pending").length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      <div style={S.orb1} /><div style={S.orb2} /><div style={S.gridBg} />
      <div style={S.container}>

        {/* Nav */}
        <nav style={S.nav}>
          <span style={S.logo}>Health<span style={{ color: "#8b5cf6" }}>Chain</span></span>
          <div style={S.navRight}>
            <span style={S.networkBadge}>⬡ Sepolia</span>
            {address && <span style={S.addrBadge}>{address.slice(0,6)}…{address.slice(-4)}</span>}
            <button style={S.logoutBtn} onClick={() => navigate("/")}>Disconnect</button>
          </div>
        </nav>

        {/* Header */}
        <div style={S.header}>
          <div style={S.avatarWrap}><span style={{ fontSize: 34 }}>👤</span></div>
          <div>
            <h1 style={S.welcome}>{user?.name ? `Welcome, ${user.name}` : "Patient Dashboard"}</h1>
            <p style={S.subtitle}>{user?.email || "Your health data, fully owned by you"}</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {[
            { key: "store",    icon: "🗃️", label: "Store Document"    },
            { key: "upload",   icon: "📤", label: "Share with Doctor" },
            { key: "view",     icon: "📂", label: "My Files"          },
            { key: "requests", icon: "📨", label: "Record Requests"   },
          ].map(t => (
            <button key={t.key}
              style={{ ...S.tabBtn, ...(activeTab === t.key ? S.tabBtnActive : {}) }}
              onClick={() => setActiveTab(t.key)}
            >
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.key === "requests" && pendingCount > 0 && (
                <span style={S.tabBadge}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════ STORE TAB ══════════ */}
        {activeTab === "store" && (
          <Panel title="Store a Document"
            subtitle="Encrypt and store your medical file privately on IPFS. Only you can read it.">

            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>Document Name</label>
              <div style={{ ...S.inputWrap, borderColor: labelConflict ? "rgba(239,68,68,0.6)" : storeLabel ? "rgba(139,92,246,0.55)" : "rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: 15, opacity: 0.45 }}>✦</span>
                <input
                  style={S.input}
                  placeholder="e.g. Blood Test Report — Jan 2025"
                  value={storeLabel}
                  onChange={e => { setStoreLabel(e.target.value); setStoreError(""); }}
                  disabled={storing}
                />
              </div>
              {labelConflict && (
                <span style={{ fontSize: 12, color: "#f87171", marginTop: 2 }}>
                  ⚠️ You already have a document named "{storeLabel.trim()}". Choose a different name.
                </span>
              )}
            </div>

            <FileDropZone file={storeFile} onChange={setStoreFile} disabled={storing} color="#8b5cf6" />

            {storing    && storeStep && <StepBanner step={storeStep} color="#8b5cf6" />}
            {storeError             && <ErrorBox msg={storeError} />}
            {storeSuccess           && <SuccessBox msg={storeSuccess} />}

            <button
              style={{ ...S.actionBtn, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                opacity: (!storeFile || !storeLabel.trim() || storing || labelConflict) ? 0.45 : 1,
                cursor:  (!storeFile || !storeLabel.trim() || storing || labelConflict) ? "not-allowed" : "pointer" }}
              onClick={handleStore}
              disabled={!storeFile || !storeLabel.trim() || storing || labelConflict}
            >
              {storing
                ? <BtnInner icon={<Spinner color="#fff" />} text={storeStep || "Storing…"} />
                : <BtnInner icon="🔒" text="Encrypt & Store" />}
            </button>

            <InfoNote icon="🔐">
              Your file is encrypted with <strong style={{ color: "#8b5cf6" }}>your derived key</strong> before
              upload. The IPFS bundle holds your encrypted AES key and ciphertext — nobody else can read it.
            </InfoNote>
          </Panel>
        )}

        {/* ══════════ SHARE TAB ══════════ */}
        {activeTab === "upload" && (
          <Panel title="Share with a Doctor"
            subtitle="Pick one of your stored documents first, then choose a verified doctor to share it with.">

            {/* STEP 1 — Select a document */}
            <div style={S.stepHeader}>
              <div style={S.stepCircle}>1</div>
              <SectionLabel>Select a Document</SectionLabel>
            </div>

            {loadingSelfStored ? (
              <CenterBox><Spinner color="#06b6d4" size={22} /><Muted>Loading from blockchain…</Muted></CenterBox>
            ) : Object.keys(groupedSelfStored).length === 0 ? (
              <EmptyNote icon="📭" text="No stored documents found on-chain. Store a file first." />
            ) : (
              <div style={S.selectGrid}>
                {Object.entries(groupedSelfStored).map(([groupName, entries]) => {
                  const isRawHash     = groupName === entries[0].ipfsHash;
                  const groupSelected = entries.some(e => e.ipfsHash === selectedRecord?.ipfsHash);
                  return (
                    <div key={groupName} style={{
                      ...S.groupCard,
                      borderColor: groupSelected ? "#06b6d4" : "rgba(255,255,255,0.07)",
                      background:  groupSelected ? "rgba(6,182,212,0.05)" : "rgba(255,255,255,0.02)",
                    }}>
                      <div style={S.groupCardHeader}>
                        <span style={{ fontSize: 18 }}>📄</span>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={S.groupCardName}>
                            {isRawHash ? groupName.slice(0, 20) + "…" : groupName}
                          </div>
                          {!isRawHash && entries.length > 1 && (
                            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                              {entries.length} versions on-chain
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                        {entries.map(entry => {
                          const isSel = selectedRecord?.ipfsHash === entry.ipfsHash;
                          return (
                            <div key={entry.ipfsHash}
                              style={{ ...S.subRow,
                                borderColor: isSel ? "#06b6d4" : "rgba(255,255,255,0.05)",
                                background:  isSel ? "rgba(6,182,212,0.1)" : "rgba(255,255,255,0.02)",
                                cursor: "pointer" }}
                              onClick={() => {
                                setSelectedRecord(isSel ? null : entry);
                                setSelectedDoctor(null);
                                setUploadError(""); setUploadSuccess("");
                              }}
                            >
                              <span style={{ fontSize: 12, fontFamily: "monospace", color: "#475569", flex: 1 }}>
                                {entry.ipfsHash.slice(0, 24)}…
                              </span>
                              {isSel && <span style={{ color: "#06b6d4", fontSize: 13 }}>✓ selected</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 2 — Select a doctor: only visible after a record is picked */}
            {selectedRecord && (
              <>
                <div style={{ ...S.stepHeader, marginTop: 4 }}>
                  <div style={S.stepCircle}>2</div>
                  <SectionLabel>Select a Doctor</SectionLabel>
                </div>

                {loadingDoctors ? (
                  <CenterBox><Spinner color="#8b5cf6" size={22} /><Muted>Loading doctors…</Muted></CenterBox>
                ) : doctors.filter(d => d.onChainVerified).length === 0 ? (
                  <EmptyNote icon="🩺" text="No verified doctors found." />
                ) : (
                  <div style={S.selectGrid}>
                    {doctors.filter(d => d.onChainVerified).map(doc => {
                      const alreadyShared = isAlreadySharedWith(selectedRecord.fileName, doc.walletAddress);
                      const isSelected    = selectedDoctor?._id === doc._id;
                      return (
                        <div key={doc._id}
                          style={{
                            ...S.selectCard,
                            borderColor: alreadyShared ? "rgba(16,185,129,0.35)"
                                       : isSelected    ? "#8b5cf6"
                                       : "rgba(255,255,255,0.07)",
                            background:  alreadyShared ? "rgba(16,185,129,0.05)"
                                       : isSelected    ? "rgba(139,92,246,0.12)"
                                       : "rgba(255,255,255,0.02)",
                            cursor:  alreadyShared ? "default" : "pointer",
                            opacity: alreadyShared ? 0.72 : 1,
                          }}
                          onClick={() => { if (!alreadyShared) setSelectedDoctor(isSelected ? null : doc); }}
                        >
                          <span style={{ fontSize: 20 }}>🩺</span>
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={S.cardName}>{doc.name}</div>
                            <div style={S.cardMono}>{doc.email}</div>
                          </div>
                          {alreadyShared ? (
                            <span style={S.alreadySharedBadge}>✓ Already Shared</span>
                          ) : (
                            <>
                              <StatusPill verified small />
                              {isSelected && <span style={{ color: "#8b5cf6", fontSize: 18 }}>✓</span>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {(selectedRecord || selectedDoctor) && (
              <div style={S.summaryBox}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>
                  {selectedRecord
                    ? <><strong style={{ color: "#06b6d4" }}>{selectedRecord.fileName === selectedRecord.ipfsHash ? selectedRecord.ipfsHash.slice(0,18)+"…" : selectedRecord.fileName}</strong>
                        <span style={{ color: "#334155", fontSize: 11 }}> ({selectedRecord.ipfsHash.slice(0,12)}…)</span></>
                    : <span style={{ color: "#475569" }}>No file selected</span>}
                  {"  →  "}
                  {selectedDoctor
                    ? <strong style={{ color: "#8b5cf6" }}>Dr. {selectedDoctor.name}</strong>
                    : <span style={{ color: "#475569" }}>No doctor selected</span>}
                </span>
              </div>
            )}

            {uploading   && uploadStep && <StepBanner step={uploadStep} color="#8b5cf6" />}
            {uploadError              && <ErrorBox msg={uploadError} />}
            {uploadSuccess            && <SuccessBox msg={uploadSuccess} />}

            <button
              style={{ ...S.actionBtn, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                opacity: (!selectedRecord || !selectedDoctor || uploading) ? 0.45 : 1,
                cursor:  (!selectedRecord || !selectedDoctor || uploading) ? "not-allowed" : "pointer" }}
              onClick={handleUpload}
              disabled={!selectedRecord || !selectedDoctor || uploading}
            >
              {uploading
                ? <BtnInner icon={<Spinner color="#fff" />} text={uploadStep || "Sharing…"} />
                : <BtnInner icon="📤" text="Encrypt & Share" />}
            </button>

            <InfoNote icon="🔑">
              The encrypted file blob is <strong style={{ color: "#8b5cf6" }}>copied as-is</strong>.
              Only the AES key is re-encrypted for the doctor. Your private key never leaves your browser.
            </InfoNote>
          </Panel>
        )}

        {/* ══════════ MY FILES TAB ══════════ */}
        {activeTab === "view" && (
          <Panel title="My Files"
            subtitle="All your on-chain medical records — stored privately or shared with doctors.">

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={S.refreshBtn} onClick={fetchPatientRecords}>
                {loadingPatientRecords ? <Spinner color="#94a3b8" size={12} /> : "↻"} Refresh
              </button>
            </div>

            {loadingPatientRecords ? (
              <CenterBox><Spinner color="#8b5cf6" size={28} /><Muted>Fetching on-chain records…</Muted></CenterBox>
            ) : Object.keys(groupedPatientRecords).length === 0 ? (
              <div style={S.emptyCard}>
                <span style={{ fontSize: 44 }}>🔒</span>
                <h3 style={{ color: "#f0f4ff", margin: "14px 0 8px", fontWeight: 700 }}>No Records Yet</h3>
                <p style={{ color: "#64748b", fontSize: 14, maxWidth: 340, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
                  Store a document first, then optionally share it with a doctor.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {Object.entries(groupedPatientRecords).map(([fileName, entries]) => (
                  <div key={fileName} style={S.fileGroup}>
                    <div style={S.fileGroupHeader}>
                      <span style={{ fontSize: 20 }}>📄</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15 }}>{fileName}</span>
                      <span style={{ color: "#475569", fontSize: 12, marginLeft: "auto" }}>
                        {entries.length} record{entries.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      {entries.map((entry, i) => {
                        const isDecrypted  = !!decryptedUrls[entry.ipfsHash];
                        const isDecrypting = decryptingId === entry.ipfsHash;
                        const decryptErr   = decryptErrors[entry.ipfsHash];
                        return (
                          <div key={i} style={{ ...S.recordRow, opacity: entry.revoked ? 0.38 : 1 }}>
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {entry.isSelfStored
                                ? <span style={S.selfBadge}>🗃️ Self-stored (private)</span>
                                : <span style={S.sharedBadge}>📤 Shared with&nbsp;
                                    <strong style={{ color: "#8b5cf6" }}>
                                      Dr. {entry.doctorName || entry.doctor?.slice(0,8)+"…"}
                                    </strong>
                                  </span>
                              }
                              {entry.revoked && <span style={S.revokedBadge}>Revoked</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                              {entry.isSelfStored && !entry.revoked && (
                                <>
                                  <button
                                    style={{ ...S.decryptBtn,
                                      opacity:     isDecrypting ? 0.6 : 1,
                                      cursor:      isDecrypting ? "wait" : "pointer",
                                      background:  isDecrypted ? "rgba(16,185,129,0.1)"  : "rgba(139,92,246,0.1)",
                                      borderColor: isDecrypted ? "rgba(16,185,129,0.3)"  : "rgba(139,92,246,0.3)",
                                      color:       isDecrypted ? "#10b981" : "#8b5cf6" }}
                                    onClick={() => handleDecryptAndView(entry)}
                                    disabled={isDecrypting}
                                  >
                                    {isDecrypting
                                      ? <><Spinner color="#8b5cf6" size={11} />&nbsp;Decrypting…</>
                                      : isDecrypted ? "🔓 Open" : "🔓 Decrypt & View"}
                                  </button>
                                  {decryptErr && <span style={{ color: "#f87171", fontSize: 11 }}>⚠️ {decryptErr}</span>}
                                </>
                              )}
                              {!entry.isSelfStored && !entry.revoked && entry.tokenId != null && (
                                <button style={{ ...S.revokeBtn, opacity: revoking === entry.tokenId ? 0.5 : 1 }}
                                  onClick={() => handleRevoke(entry.tokenId)}
                                  disabled={revoking === entry.tokenId}>
                                  {revoking === entry.tokenId
                                    ? <><Spinner color="#f87171" size={11} />&nbsp;Revoking…</>
                                    : "Revoke"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* ══════════ RECORD REQUESTS TAB ══════════ */}
        {activeTab === "requests" && (
          <Panel title="Record Requests"
            subtitle="Doctors who have requested access to your records. Approve to securely share the file with them.">

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={S.refreshBtn} onClick={() => { fetchRecordRequests(); fetchPatientRecords(); fetchSelfStored(); }}>
                {loadingRequests ? <Spinner color="#94a3b8" size={12} /> : "↻"} Refresh
              </button>
            </div>

            {loadingRequests ? (
              <CenterBox><Spinner color="#8b5cf6" size={28} /><Muted>Loading requests…</Muted></CenterBox>
            ) : recordRequests.length === 0 ? (
              <div style={S.emptyCard}>
                <span style={{ fontSize: 44 }}>📭</span>
                <h3 style={{ color: "#f0f4ff", margin: "14px 0 8px", fontWeight: 700 }}>No Requests Yet</h3>
                <p style={{ color: "#64748b", fontSize: 14, maxWidth: 340, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
                  When a doctor requests access to one of your records, it will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recordRequests.map(req => {
                  const reqId         = req._id;
                  const aState        = approvalState[reqId] || {};
                  const alreadyShared = isAlreadySharedWith(req.recordName, req.doctorPubkey);
                  const isApproved    = req.status === "approved" || alreadyShared || !!aState.success;
                  const isRejected    = req.status === "rejected";
                  const isPending     = !isApproved && !isRejected;

                  return (
                    <div key={reqId} style={{
                      ...S.requestCard,
                      borderColor: isApproved ? "rgba(16,185,129,0.25)"
                                 : isRejected ? "rgba(239,68,68,0.2)"
                                 : "rgba(255,255,255,0.07)",
                      background:  isApproved ? "rgba(16,185,129,0.04)"
                                 : isRejected ? "rgba(239,68,68,0.03)"
                                 : "rgba(255,255,255,0.02)",
                    }}>

                      {/* Top row */}
                      <div style={S.requestCardTop}>
                        <div style={S.reqFileIcon}>
                          <span style={{ fontSize: 20 }}>📄</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {req.recordName}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
                            Requested by{" "}
                            <strong style={{ color: "#94a3b8" }}>Dr. {req.doctorName}</strong>
                            <span style={{ color: "#334155" }}> · {new Date(req.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {/* Status badge */}
                        {isApproved && <span style={S.approvedBadge}>✓ Shared</span>}
                        {isRejected && <span style={S.rejectedBadge}>✕ Rejected</span>}
                        {isPending  && <span style={S.pendingReqBadge}>⏳ Pending</span>}
                      </div>

                      {/* Progress / feedback */}
                      {aState.step    && !aState.success && <StepBanner step={aState.step} color="#8b5cf6" />}
                      {aState.error   && <ErrorBox msg={aState.error} />}
                      {aState.success && <SuccessBox msg={aState.success} />}

                      {/* Approve button — only for pending requests not yet loading */}
                      {isPending && !aState.loading && !aState.success && (
                        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                          <button
                            style={{ ...S.approveBtn }}
                            onClick={() => handleApproveRequest(req)}
                          >
                            <BtnInner icon="🔓" text="Approve & Encrypt" />
                          </button>
                        </div>
                      )}

                      {/* While processing */}
                      {aState.loading && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Spinner color="#8b5cf6" size={13} />
                          <span style={{ color: "#64748b", fontSize: 13 }}>{aState.step || "Processing…"}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

      </div>
      <style>{`@keyframes hc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Panel({ title, subtitle, children }) {
  return (
    <div style={S.panel}>
      <div style={S.panelHeader}>
        <h2 style={S.panelTitle}>{title}</h2>
        <p style={S.panelSubtitle}>{subtitle}</p>
      </div>
      <div style={S.panelBody}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={S.sectionLabel}>{children}</div>;
}

function SelectCard({ children, selected, onClick, color }) {
  return (
    <div style={{ ...S.selectCard,
      borderColor: selected ? color : "rgba(255,255,255,0.07)",
      background:  selected ? `${color}12` : "rgba(255,255,255,0.02)",
      cursor: "pointer" }}
      onClick={onClick}>
      {children}
    </div>
  );
}

function FileDropZone({ file, onChange, disabled, color }) {
  const [drag, setDrag] = useState(false);
  return (
    <div style={{ ...S.dropzone,
        borderColor: drag ? color : file ? color+"80" : "rgba(255,255,255,0.08)",
        background:  drag ? color+"08" : "rgba(255,255,255,0.02)",
        cursor: disabled ? "not-allowed" : "pointer" }}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled && e.dataTransfer.files[0]) onChange(e.dataTransfer.files[0]); }}
      onClick={() => !disabled && document.getElementById("ud-file-input").click()}
    >
      <input id="ud-file-input" type="file" style={{ display: "none" }}
        onChange={e => onChange(e.target.files[0])} disabled={disabled} />
      {file ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
          <span style={{ fontSize: 22 }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{file.name}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{(file.size/1024).toFixed(1)} KB</div>
          </div>
          <button style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18 }}
            onClick={e => { e.stopPropagation(); onChange(null); }}>✕</button>
        </div>
      ) : (
        <><span style={{ fontSize: 30 }}>📁</span>
        <p style={{ color: "#475569", margin: 0, fontSize: 13 }}>Drop a file or <span style={{ color }}>browse</span></p></>
      )}
    </div>
  );
}

function StepBanner({ step, color }) {
  return (
    <div style={{ ...S.stepBanner, borderColor: color+"25", background: color+"08" }}>
      <Spinner color={color} size={13} />
      <span style={{ fontSize: 13, color: "#94a3b8" }}>{step}</span>
    </div>
  );
}
function ErrorBox({ msg }) {
  return <div style={S.errorBox}><span>⚠️</span><span>{msg}</span></div>;
}
function SuccessBox({ msg }) {
  return <div style={S.successBox}><span>✅</span><span style={{ color: "#10b981", fontSize: 13 }}>{msg}</span></div>;
}
function InfoNote({ icon, children }) {
  return (
    <div style={S.infoNote}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}
function EmptyNote({ icon, text }) {
  return (
    <div style={S.emptyNote}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ color: "#64748b", fontSize: 13 }}>{text}</span>
    </div>
  );
}
function CenterBox({ children }) {
  return <div style={S.centerBox}>{children}</div>;
}
function StatusPill({ verified = true, small }) {
  return (
    <span style={{ display: "inline-block", whiteSpace: "nowrap", flexShrink: 0,
      padding: small ? "2px 8px" : "4px 12px", borderRadius: 100,
      fontSize: small ? 11 : 12, fontWeight: 600,
      background: verified ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
      color:      verified ? "#10b981" : "#f59e0b",
      border:     `1px solid ${verified ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}` }}>
      {verified ? "✓ Verified" : "⏳ Pending"}
    </span>
  );
}
function Muted({ children }) {
  return <span style={{ color: "#64748b", fontSize: 13 }}>{children}</span>;
}
function Spinner({ color = "#fff", size = 14 }) {
  return (
    <span style={{ width: size, height: size,
      border: `2px solid ${color}30`, borderTopColor: color,
      borderRadius: "50%", display: "inline-block",
      animation: "hc-spin 0.7s linear infinite", flexShrink: 0 }} />
  );
}
function BtnInner({ icon, text }) {
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {typeof icon === "string" ? <span>{icon}</span> : icon}{text}
    </span>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: { minHeight: "100vh", background: "#060a12", fontFamily: "'DM Sans','Segoe UI',sans-serif", position: "relative", overflow: "auto" },
  orb1: { position: "fixed", top: "-10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  orb2: { position: "fixed", bottom: "-10%", left: "-5%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(6,182,212,0.06) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 },
  gridBg: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(rgba(139,92,246,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.02) 1px,transparent 1px)", backgroundSize: "60px 60px" },
  container: { maxWidth: 860, margin: "0 auto", padding: "0 24px 80px", position: "relative", zIndex: 1 },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 36 },
  logo: { fontSize: 22, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.5px" },
  navRight: { display: "flex", alignItems: "center", gap: 10 },
  networkBadge: { background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#8b5cf6", padding: "5px 12px", borderRadius: 100, fontSize: 12 },
  addrBadge: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "5px 12px", borderRadius: 100, fontSize: 12, fontFamily: "monospace" },
  logoutBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  header: { display: "flex", alignItems: "center", gap: 18, marginBottom: 32 },
  avatarWrap: { width: 72, height: 72, borderRadius: 20, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  welcome: { fontSize: 26, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  subtitle: { fontSize: 14, color: "#64748b", margin: 0 },
  tabBar: { display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" },
  tabBtn: { display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b", padding: "11px 20px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600 },
  tabBtnActive: { background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.35)", color: "#8b5cf6" },
  tabBadge: { background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 100, lineHeight: "16px", minWidth: 16, textAlign: "center" },
  panel: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, overflow: "hidden" },
  panelHeader: { padding: "24px 28px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  panelTitle:    { fontSize: 18, fontWeight: 800, color: "#f0f4ff", margin: "0 0 4px" },
  panelSubtitle: { fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 },
  panelBody:     { padding: "22px 28px", display: "flex", flexDirection: "column", gap: 14 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" },
  stepHeader: { display: "flex", alignItems: "center", gap: 10 },
  stepCircle: { width: 24, height: 24, borderRadius: "50%", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)", color: "#8b5cf6", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel:  { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" },
  inputWrap: { display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: 12, padding: "12px 14px" },
  input: { background: "none", border: "none", outline: "none", color: "#f0f4ff", fontSize: 14, width: "100%" },
  selectGrid: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" },
  selectCard: { display: "flex", alignItems: "center", gap: 12, border: "1px solid", borderRadius: 12, padding: "12px 14px" },
  cardName: { color: "#e2e8f0", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cardMono: { color: "#475569", fontSize: 11, fontFamily: "monospace", marginTop: 2 },
  groupCard: { border: "1px solid", borderRadius: 12, padding: "12px 14px" },
  groupCardHeader: { display: "flex", alignItems: "center", gap: 10 },
  groupCardName: { color: "#e2e8f0", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  subRow: { display: "flex", alignItems: "center", gap: 8, border: "1px solid", borderRadius: 8, padding: "6px 10px" },
  dropzone: { border: "1.5px dashed", borderRadius: 14, padding: "22px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minHeight: 100, justifyContent: "center" },
  actionBtn: { width: "100%", border: "none", borderRadius: 12, padding: "14px 0", color: "#fff", fontWeight: 700, fontSize: 15 },
  infoNote: { display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px" },
  stepBanner: { display: "flex", alignItems: "center", gap: 10, border: "1px solid", borderRadius: 10, padding: "10px 14px" },
  errorBox: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px", color: "#fca5a5", fontSize: 13, display: "flex", gap: 8, alignItems: "center" },
  successBox: { display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px" },
  summaryBox: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px" },
  emptyNote: { display: "flex", alignItems: "center", gap: 12, padding: "18px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" },
  centerBox: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 32px", gap: 8 },
  fileGroup: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 18px" },
  fileGroupHeader: { display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.05)" },
  recordRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 14px", gap: 10, flexWrap: "wrap" },
  selfBadge:    { fontSize: 13, color: "#64748b" },
  sharedBadge:  { fontSize: 13, color: "#94a3b8" },
  revokedBadge: { display: "inline-block", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 },
  decryptBtn: { display: "flex", alignItems: "center", gap: 6, border: "1px solid", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600 },
  rawLink: { color: "#475569", fontSize: 12, textDecoration: "none", fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" },
  revokeBtn: { display: "flex", alignItems: "center", gap: 5, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 },
  refreshBtn: { display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#64748b", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12 },
  // ── Record Requests tab ────────────────────────────────────────────────────
  requestCard:    { border: "1px solid", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 },
  requestCardTop: { display: "flex", alignItems: "center", gap: 12 },
  reqFileIcon:    { width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)", display: "flex", alignItems: "center", justifyContent: "center" },
  approveBtn:     { display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", border: "none", color: "#fff", padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  approvedBadge:   { background: "rgba(16,185,129,0.1)",  border: "1px solid rgba(16,185,129,0.3)",  color: "#10b981", padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, flexShrink: 0 },
  rejectedBadge:   { background: "rgba(239,68,68,0.1)",   border: "1px solid rgba(239,68,68,0.2)",   color: "#f87171", padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, flexShrink: 0 },
  pendingReqBadge: { background: "rgba(245,158,11,0.1)",  border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", padding: "4px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, flexShrink: 0 },
  alreadySharedBadge: { background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, flexShrink: 0 },
};