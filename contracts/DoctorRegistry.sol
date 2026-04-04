// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DoctorRegistry {
    address public admin;

    struct Doctor {
        bool isRegistered;
        bool isVerified;
        bool isSuspended;
        string[] certificateIPFSHashes;
    }

    struct DoctorInfo {
        address doctorAddress;
        bool isVerified;
        bool isSuspended;
    }

    mapping(address => Doctor) public doctors;

    // Array to store all registered doctor addresses
    address[] public doctorList;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerDoctor(string[] calldata _ipfsHashes) external {
        require(!doctors[msg.sender].isRegistered, "Already registered");

        doctors[msg.sender] = Doctor({
            isRegistered: true,
            isVerified: false,
            isSuspended: false,
            certificateIPFSHashes: _ipfsHashes
        });

        doctorList.push(msg.sender);
    }

    function getDoctorCertificates(
        address _doctor
    ) external view returns (string[] memory) {
        return doctors[_doctor].certificateIPFSHashes;
    }

    function verifyDoctor(address _doctor) external onlyAdmin {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        doctors[_doctor].isVerified = true;
    }

    function isDoctorVerified(address _doctor) external view returns (bool) {
        return doctors[_doctor].isVerified && !doctors[_doctor].isSuspended;
    }

    // Function to return all doctors with verification status
    function getAllDoctors() external view returns (DoctorInfo[] memory) {
        uint256 length = doctorList.length;
        DoctorInfo[] memory doctorInfos = new DoctorInfo[](length);

        for (uint256 i = 0; i < length; i++) {
            address doctorAddr = doctorList[i];

            doctorInfos[i] = DoctorInfo({
                doctorAddress: doctorAddr,
                isVerified: doctors[doctorAddr].isVerified,
                isSuspended: doctors[doctorAddr].isSuspended
            });
        }

        return doctorInfos;
    }

    // Optional helper function to get total number of doctors
    function getDoctorCount() external view returns (uint256) {
        return doctorList.length;
    }

    function suspendDoctor(address _doctor) external onlyAdmin {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        require(!doctors[_doctor].isSuspended, "Already suspended");

        doctors[_doctor].isSuspended = true;
    }

    function unsuspendDoctor(address _doctor) external onlyAdmin {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        require(doctors[_doctor].isSuspended, "Not suspended");

        doctors[_doctor].isSuspended = false;
    }
}
