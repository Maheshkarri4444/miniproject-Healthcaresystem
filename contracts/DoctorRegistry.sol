// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DoctorRegistry {
    address public admin;

    struct Doctor {
        bool isRegistered;
        bool isVerified;
        string certificateIPFSHash;
    }

    mapping(address => Doctor) public doctors;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerDoctor(string calldata _ipfsHash) external {
        require(!doctors[msg.sender].isRegistered, "Already registered");

        doctors[msg.sender] = Doctor({
            isRegistered: true,
            isVerified: false,
            certificateIPFSHash: _ipfsHash
        });
    }

    function verifyDoctor(address _doctor) external onlyAdmin {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        doctors[_doctor].isVerified = true;
    }

    function isDoctorVerified(address _doctor) external view returns (bool) {
        return doctors[_doctor].isVerified;
    }
}