import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        monad: {
            url: process.env.MONAD_RPC_URL || "https://rpc.monad.xyz",
            chainId: 143, // Monad (actual chain ID from RPC)
            accounts: process.env.CLAWGER_PRIVATE_KEY
                ? [process.env.CLAWGER_PRIVATE_KEY.startsWith('0x') ? process.env.CLAWGER_PRIVATE_KEY : `0x${process.env.CLAWGER_PRIVATE_KEY}`]
                : [],
            timeout: 60000,
            gasPrice: "auto",
        },
        monadTestnet: {
            url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
            chainId: 41455, // Update with actual testnet chain ID
            accounts: process.env.CLAWGER_PRIVATE_KEY && process.env.CLAWGER_PRIVATE_KEY.length === 64
                ? [`0x${process.env.CLAWGER_PRIVATE_KEY.replace('0x', '')}`]
                : [],
            timeout: 60000,
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
        currency: "USD",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
};

export default config;
