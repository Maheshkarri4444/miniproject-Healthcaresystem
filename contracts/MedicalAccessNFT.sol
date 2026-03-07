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

    modifier onlyDoctorOrAdmin(address doctor) {
        require(msg.sender == doctor || msg.sender == admin, "Not authorized");
        _;
    }

    modifier onlyPatientOrAdmin(address patient) {
        require(msg.sender == patient || msg.sender == admin, "Not authorized");
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
        string calldata _ipfsHash
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
            revoked: false
        });

        return tokenId;
    }

    function justStore(string calldata _ipfsHash) external returns (uint256) {
        tokenCounter++;
        uint256 tokenId = tokenCounter;

        _mint(msg.sender, tokenId);

        accessData[tokenId] = AccessData({
            patient: msg.sender,
            doctor: address(0),
            ipfsHash: _ipfsHash,
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

    function getAccessDataByDoctor(
        address doctor
    ) external view onlyDoctorOrAdmin(doctor) returns (AccessData[] memory) {
        uint256 count = 0;

        for (uint256 i = 1; i <= tokenCounter; i++) {
            if (accessData[i].doctor == doctor && !accessData[i].revoked) {
                count++;
            }
        }

        AccessData[] memory results = new AccessData[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= tokenCounter; i++) {
            if (accessData[i].doctor == doctor && !accessData[i].revoked) {
                results[index] = accessData[i];
                index++;
            }
        }

        return results;
    }

    function getAccessDataByPatient(
        address patient
    ) external view onlyPatientOrAdmin(patient) returns (AccessData[] memory) {
        uint256 count = 0;

        // count records
        for (uint256 i = 1; i <= tokenCounter; i++) {
            if (accessData[i].patient == patient && !accessData[i].revoked) {
                count++;
            }
        }

        AccessData[] memory results = new AccessData[](count);
        uint256 index = 0;

        // collect records
        for (uint256 i = 1; i <= tokenCounter; i++) {
            if (accessData[i].patient == patient && !accessData[i].revoked) {
                results[index] = accessData[i];
                index++;
            }
        }

        return results;
    }

    function revokeAllForDoctor(address doctor) external {
        require(msg.sender == admin, "Only admin");

        for (uint256 i = 1; i <= tokenCounter; i++) {
            if (accessData[i].doctor == doctor) {
                accessData[i].revoked = true;
            }
        }
    }
}
