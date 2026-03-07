const MedicalRecord = require("../models/MedicalRecord");

/**
 * Create new medical record metadata
 */
exports.createRecord = async (req, res) => {
  try {
    const {
      tokenId,
      fileName,
      ipfsHash,
      userPubKey,
      userDerivedPubKey,
      userName
    } = req.body;

    const record = new MedicalRecord({
      tokenId,
      fileName,
      ipfsHash,
      userPubKey,
      userDerivedPubKey,
      userName
    });

    await record.save();

    res.status(201).json({
      message: "Medical record stored successfully",
      record
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * Get all records
 */
exports.getAllRecords = async (req, res) => {
  try {
    const records = await MedicalRecord.find().sort({ createdAt: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * Get records by user public key
 */
exports.getRecordsByUser = async (req, res) => {
  try {
    const { pubkey } = req.params;

    const records = await MedicalRecord.find({
      userPubKey: pubkey
    }).sort({ createdAt: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * Get record by tokenId
 */
exports.getRecordByTokenId = async (req, res) => {
  try {
    const { tokenId } = req.params;

    const record = await MedicalRecord.findOne({ tokenId });

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};