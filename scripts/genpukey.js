require("dotenv").config();
const { ethers } = require("hardhat");

const privateKey = process.env.PRIVATE_KEY; 
const wallet = new ethers.Wallet(privateKey);

console.log("Compressed Public Key:");
console.log(wallet.signingKey.compressedPublicKey);