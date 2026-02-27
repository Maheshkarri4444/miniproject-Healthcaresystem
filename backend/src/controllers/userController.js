const User = require("../models/User");

exports.createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  const users = await User.find();
  res.json(users);
};

exports.getUserByPubkey = async (req, res) => {
  const user = await User.findOne({ pubkey: req.params.pubkey });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};