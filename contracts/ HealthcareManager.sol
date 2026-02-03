// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DoctorRegistry.sol";
import "./MedicalAccessNFT.sol";

contract HealthcareManager {
    DoctorRegistry public doctorRegistry;
    MedicalAccessNFT public nft;

    event RecordRequested(address doctor, address patient);
    event RecordAccessed(address doctor, address patient, uint256 tokenId);

    constructor(address _doctorRegistry, address _nft) {
        doctorRegistry = DoctorRegistry(_doctorRegistry);
        nft = MedicalAccessNFT(_nft);
    }

    function requestRecord(address _patient) external {
        emit RecordRequested(msg.sender, _patient);
    }

    function accessRecord(uint256 tokenId) external {
        MedicalAccessNFT.AccessData memory data = nft.getAccessData(
            tokenId,
            msg.sender
        );

        require(data.doctor == msg.sender, "Not authorized doctor");

        emit RecordAccessed(msg.sender, data.patient, tokenId);
    }
}
