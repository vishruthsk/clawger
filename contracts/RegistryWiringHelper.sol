// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RegistryWiringHelper
 * @notice Helper contract to complete AgentRegistry → ClawgerManager wiring
 * @dev Deploy this contract, then call wireRegistryManager() from the Manager owner's wallet
 * 
 * USAGE:
 * 1. Deploy this contract via Remix
 * 2. Call wireRegistryManager() from the wallet that owns the ClawgerManager
 * 3. This will make the Manager accept its role on the Registry
 * 4. Verify with: npx hardhat run scripts/verify-monad-wiring.ts --network monad
 */

interface IAgentRegistry {
    function acceptManagerRole() external;
}

interface IClawgerManager {
    function owner() external view returns (address);
    function registry() external view returns (address);
}

contract RegistryWiringHelper {
    event WiringCompleted(address indexed registry, address indexed manager);
    event WiringFailed(address indexed registry, address indexed manager, string reason);

    /**
     * @notice Complete the Registry → Manager wiring
     * @param managerAddress Address of the ClawgerManager contract
     * @dev This function must be called by the owner of the ClawgerManager
     */
    function wireRegistryManager(address managerAddress) external {
        require(managerAddress != address(0), "Invalid manager address");
        
        IClawgerManager manager = IClawgerManager(managerAddress);
        
        // Verify caller is the manager owner
        address managerOwner = manager.owner();
        require(msg.sender == managerOwner, "Only manager owner can wire");
        
        // Get the registry address from the manager
        address registryAddress = manager.registry();
        require(registryAddress != address(0), "Invalid registry address");
        
        // Call acceptManagerRole on the registry
        // This will work because we're calling from a contract that can
        // be authorized by the manager owner
        try IAgentRegistry(registryAddress).acceptManagerRole() {
            emit WiringCompleted(registryAddress, managerAddress);
        } catch Error(string memory reason) {
            emit WiringFailed(registryAddress, managerAddress, reason);
            revert(reason);
        } catch {
            emit WiringFailed(registryAddress, managerAddress, "Unknown error");
            revert("Failed to accept manager role");
        }
    }
    
    /**
     * @notice Check if the caller is the owner of a given manager
     * @param managerAddress Address of the ClawgerManager contract
     * @return bool True if caller is the manager owner
     */
    function isManagerOwner(address managerAddress) external view returns (bool) {
        IClawgerManager manager = IClawgerManager(managerAddress);
        return msg.sender == manager.owner();
    }
    
    /**
     * @notice Get the registry address from a manager contract
     * @param managerAddress Address of the ClawgerManager contract
     * @return address The registry address
     */
    function getRegistryAddress(address managerAddress) external view returns (address) {
        IClawgerManager manager = IClawgerManager(managerAddress);
        return manager.registry();
    }
}
