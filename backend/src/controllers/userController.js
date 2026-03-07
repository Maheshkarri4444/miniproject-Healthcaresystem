const User = require("../models/User");

const createUser = async (req, res) => {
  try {
    const { walletAddress, pubkey, name, phoneNumber, email } = req.body;
    const user = new User({
      walletAddress: walletAddress.toLowerCase(),
      pubkey,
      name,
      phoneNumber,
      email,
    });
    await user.save();
    res.status(201).json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserByPubkey = async (req, res) => {
  try {
    const user = await User.findOne({ pubkey: req.params.pubkey });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserByAddress = async (req, res) => {
  try {
    const user = await User.findOne({
      walletAddress: req.params.address.toLowerCase(),
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createUser, getAllUsers, getUserByPubkey, getUserByAddress };