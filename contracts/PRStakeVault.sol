// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PRStakeVault {
    address public immutable trustedAction;

    mapping(address => uint256) public deposits;
    mapping(address => uint256) public openPRCount;

    event Deposited(address indexed wallet, uint256 amount);
    event PROpened(address indexed wallet, uint256 openCount);
    event PRClosed(address indexed wallet, uint256 openCount);
    event DepositClaimed(address indexed wallet, uint256 amount);

    modifier onlyTrustedAction() {
        require(msg.sender == trustedAction, "Not trusted action");
        _;
    }

    constructor(address trustedActionAddress) {
        require(trustedActionAddress != address(0), "Invalid trusted action");
        trustedAction = trustedActionAddress;
    }

    function deposit() external payable {
        require(msg.value > 0, "No value sent");

        deposits[msg.sender] += msg.value;
        openPRCount[msg.sender] = 0;

        emit Deposited(msg.sender, msg.value);
    }

    function onPROpen(address wallet) external onlyTrustedAction {
        require(deposits[wallet] > 0, "No deposit");
        require(openPRCount[wallet] < 10, "Max 10 open PRs");

        openPRCount[wallet] += 1;
        emit PROpened(wallet, openPRCount[wallet]);
    }

    function onPRClose(address wallet) external onlyTrustedAction {
        require(openPRCount[wallet] > 0, "No open PRs");

        openPRCount[wallet] -= 1;
        emit PRClosed(wallet, openPRCount[wallet]);
    }

    function claimDeposit() external {
        require(openPRCount[msg.sender] == 0, "Open PRs remain");

        uint256 amount = deposits[msg.sender];
        require(amount > 0, "No deposit");

        deposits[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit DepositClaimed(msg.sender, amount);
    }
}
