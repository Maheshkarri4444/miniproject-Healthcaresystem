const express = require("express");
const router = express.Router();
const {
  createUser,
  getAllUsers,
  getUserByPubkey,
  getUserByAddress,
} = require("../controllers/userController");

router.post("/", createUser);
router.get("/", getAllUsers);
router.get("/:pubkey", getUserByPubkey);
router.get("/address/:address", getUserByAddress);
module.exports = router;