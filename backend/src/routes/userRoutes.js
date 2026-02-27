const express = require("express");
const router = express.Router();
const {
  createUser,
  getAllUsers,
  getUserByPubkey
} = require("../controllers/userController");

router.post("/", createUser);
router.get("/", getAllUsers);
router.get("/:pubkey", getUserByPubkey);

module.exports = router;