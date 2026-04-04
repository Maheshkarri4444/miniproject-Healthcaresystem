const Request = require("../models/Request");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── CREATE REQUEST + send email to user ─────────────────────────────────────
const createRequest = async (req, res) => {
  try {
    const {
      userName, userEmail, userPubkey, userDerivedPubkey,
      doctorName, doctorPubkey, doctorDerivedPubkey,
      recordName, recordTokenId,
    } = req.body;

    // Validate required fields
    if (!userName || !userEmail || !userPubkey || !userDerivedPubkey ||
        !doctorName || !doctorPubkey || !doctorDerivedPubkey || !recordName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const request = await Request.create({
      userName, userEmail, userPubkey, userDerivedPubkey,
      doctorName, doctorPubkey, doctorDerivedPubkey,
      recordName, recordTokenId: recordTokenId ?? null,
    });

    // ── Send email to user via Resend ─────────────────────────────────────────
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "HealthChain <noreply@yourdomain.com>",
        to: userEmail,
        subject: `Dr. ${doctorName} has requested access to your medical record`,
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #060a12; color: #e2e8f0; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.1)); padding: 32px 36px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                Health<span style="color: #06b6d4;">Chain</span>
              </div>
              <p style="margin: 8px 0 0; color: #64748b; font-size: 13px;">Blockchain-secured medical records</p>
            </div>

            <!-- Body -->
            <div style="padding: 32px 36px;">
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #f0f4ff;">
                Record Access Request
              </h2>
              <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6;">
                A verified doctor on HealthChain is requesting access to one of your medical records.
              </p>

              <!-- Info card -->
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px 22px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 40%;">Doctor</td>
                    <td style="padding: 8px 0; color: #e2e8f0; font-size: 14px; font-weight: 600;">Dr. ${doctorName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Record</td>
                    <td style="padding: 8px 0; color: #06b6d4; font-size: 14px; font-weight: 700;">${recordName}</td>
                  </tr>
                  ${recordTokenId != null ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Token ID</td>
                    <td style="padding: 8px 0; color: #8b5cf6; font-size: 14px; font-weight: 600;">#${recordTokenId}</td>
                  </tr>` : ""}
                </table>
              </div>

              <!-- Action note -->
              <div style="background: rgba(6,182,212,0.06); border: 1px solid rgba(6,182,212,0.2); border-radius: 10px; padding: 14px 16px; margin-bottom: 28px;">
                <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                  🔐 <strong style="color: #06b6d4;">Action required:</strong> Log in to your HealthChain dashboard to approve or ignore this request. Only you can grant access to your encrypted records.
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; color: #334155; line-height: 1.6;">
                If you did not expect this request or do not recognise this doctor, you can safely ignore this email. Your records remain encrypted and inaccessible without your approval.
              </p>
            </div>

            <!-- Footer -->
            <div style="padding: 20px 36px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
              <p style="margin: 0; font-size: 11px; color: #1e293b;">
                This is an automated notification from HealthChain · Sepolia Testnet
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      // Email failure should NOT block the request creation
      console.error("Resend email error:", emailErr.message);
    }

    res.status(201).json({ success: true, request });
  } catch (err) {
    console.error("createRequest:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
};

// ─── GET ALL REQUESTS ─────────────────────────────────────────────────────────
const getAllRequests = async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET REQUESTS BY USER PUBKEY ──────────────────────────────────────────────
const getRequestsByUserPubkey = async (req, res) => {
  try {
    const requests = await Request.find({ userPubkey: req.params.userPubkey }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET REQUESTS BY DOCTOR PUBKEY ───────────────────────────────────────────
const getRequestsByDoctorPubkey = async (req, res) => {
  try {
    const requests = await Request.find({ doctorPubkey: req.params.doctorPubkey }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createRequest,
  getAllRequests,
  getRequestsByUserPubkey,
  getRequestsByDoctorPubkey,
};