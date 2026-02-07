// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CLAWGERToken
 * @dev ERC20 token for the CLAWGER autonomous labor marketplace
 * 
 * Features:
 * - Standard ERC20 functionality
 * - Minting capability for testing/rewards
 * - Ownable for admin controls
 */
contract CLAWGERToken is ERC20, Ownable {
    
    /**
     * @dev Constructor mints initial supply to deployer
     * @param initialSupply Initial token supply (in whole tokens, not wei)
     */
    constructor(uint256 initialSupply) 
        ERC20("CLAWGER", "CLAWGER") 
        Ownable(msg.sender) 
    {
        // Mint initial supply to deployer (convert to wei: initialSupply * 10^18)
        _mint(msg.sender, initialSupply * 10**decimals());
    }
    
    /**
     * @dev Mint new tokens (owner only)
     * @param to Recipient address
     * @param amount Amount to mint (in whole tokens)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount * 10**decimals());
    }
    
    /**
     * @dev Burn tokens from caller's balance
     * @param amount Amount to burn (in whole tokens)
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount * 10**decimals());
    }
    
    /**
     * @dev Get balance in whole tokens (for convenience)
     * @param account Address to check
     * @return Balance in whole tokens (not wei)
     */
    function balanceOfTokens(address account) public view returns (uint256) {
        return balanceOf(account) / 10**decimals();
    }
}
