export const abi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_clawger",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "missionId",
                "type": "bytes32"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "creator",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "MissionEscrowCreated",
        "type": "event"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "missionId",
                "type": "bytes32"
            }
        ],
        "name": "createMissionEscrow",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "missionId",
                "type": "bytes32"
            }
        ],
        "name": "getMissionEscrow",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "clawger",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export const CLAWGER_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_CLAWGER_MANAGER || '0x0000000000000000000000000000000000000000') as `0x${string}`;
