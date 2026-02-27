// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./DoctorRegistry.sol";

contract MedicalAccessNFT is ERC721 {
    DoctorRegistry public doctorRegistry;
    uint256 public tokenCounter;
    address public admin;

    struct AccessData {
        address patient;
        address doctor;
        string ipfsHash;
        bytes encryptedAESKey;
        bool revoked;
    }

    mapping(uint256 => AccessData) public accessData;

    modifier onlyAdminOrPatient(uint256 tokenId) {
        require(
            msg.sender == admin || msg.sender == accessData[tokenId].patient,
            "Not authorized"
        );
        _;
    }

    constructor(address _registry) ERC721("MedicalAccessNFT", "MEDNFT") {
        admin = msg.sender;
        doctorRegistry = DoctorRegistry(_registry);
        tokenCounter = 0;
    }

    function mintAccessNFT(
        address _patient,
        address _doctor,
        string calldata _ipfsHash,
        bytes calldata _encryptedAESKey
    ) external returns (uint256) {
        require(
            doctorRegistry.isDoctorVerified(_doctor),
            "Doctor not verified"
        );
        tokenCounter++;
        uint256 tokenId = tokenCounter;

        _mint(_doctor, tokenId);

        accessData[tokenId] = AccessData({
            patient: _patient,
            doctor: _doctor,
            ipfsHash: _ipfsHash,
            encryptedAESKey: _encryptedAESKey,
            revoked: false
        });

        return tokenId;
    }

    function revokeAccess(
        uint256 tokenId
    ) external onlyAdminOrPatient(tokenId) {
        accessData[tokenId].revoked = true;
    }

    function getAccessData(
        uint256 tokenId,
        address caller
    ) external view returns (AccessData memory) {
        require(ownerOf(tokenId) == caller, "Not NFT owner");
        require(!accessData[tokenId].revoked, "Access revoked");
        return accessData[tokenId];
    }
}
