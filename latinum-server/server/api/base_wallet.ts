// server/api/402wallet.ts

/*
Base Mainnet Wallet API - Signs transactions for Base (Ethereum L2)

Test with:
curl -X POST http://localhost:3000/api/base_wallet \
  -H "Content-Type: application/json" \
  -d '{
    "targetWallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "amountWei": "1000000000000000"
  }'
*/

import { readBody, eventHandler } from 'h3'
import { ethers } from 'ethers'

// Base Mainnet RPC URL
// const BASE_RPC_URL = 'https://mainnet.base.org'
const BASE_RPC_URL = 'https://sepolia.base.org'
const SEPOLIA_CHAIN_ID = 84532

const SECRET_PHRASE = 'HERE YOU NEED A SECRET PHRASE'
const PRIVATE_KEY_HEX = ethers.Wallet.fromPhrase(SECRET_PHRASE).privateKey

// Initialize wallet
let wallet: ethers.Wallet

try {
    wallet = new ethers.Wallet(PRIVATE_KEY_HEX)
    console.log('WALLET: 💰 Initialized wallet address:', wallet.address)
}
catch (err) {
    console.error('❌ Invalid private key format. Please provide a valid hex private key with 0x prefix')
    process.exit(1)
}

export default eventHandler(async (event) => {
    try {
        console.log('WALLET: 📥 Received 402 signing request...')

        const { amountWei, targetWallet } = await readBody(event)

        console.log('WALLET: 🔍 Inputs:', {
            amountWei,
            targetWallet,
        })

        // Validate inputs
        if (!amountWei || !targetWallet) {
            console.warn('WALLET: ⚠️ Missing required fields')
            return {
                success: false,
                error: 'Missing targetWallet or amountWei',
            }
        }

        // Validate Ethereum address format
        if (!ethers.isAddress(targetWallet)) {
            console.warn('WALLET: ⚠️ Invalid Ethereum address format')
            return {
                success: false,
                error: 'Invalid targetWallet address format',
            }
        }

        // Validate amount is a valid number
        let amountBigInt: bigint
        try {
            amountBigInt = BigInt(amountWei)
            if (amountBigInt <= 0n) {
                throw new Error('Amount must be positive')
            }
        }
        catch (err) {
            console.warn('WALLET: ⚠️ Invalid amount format')
            return {
                success: false,
                error: 'Invalid amountWei format - must be a positive integer string',
            }
        }

        // Connect to Base mainnet
        const provider = new ethers.JsonRpcProvider(BASE_RPC_URL)
        const connectedWallet = wallet.connect(provider)

        console.log('WALLET: 🌐 Connected to ' + BASE_RPC_URL)

        // Get current network conditions
        const [nonce, feeData, balance] = await Promise.all([
            provider.getTransactionCount(wallet.address),
            provider.getFeeData(),
            provider.getBalance(wallet.address),
        ])

        console.log('WALLET: 💸 Current wallet balance:', ethers.formatEther(balance), 'ETH')
        console.log('WALLET: 🔢 Current nonce:', nonce)

        // Check if wallet has sufficient balance
        const gasLimit = 21000n // Standard ETH transfer
        const estimatedCost = amountBigInt + (gasLimit * (feeData.maxFeePerGas || feeData.gasPrice || 0n))

        if (balance < estimatedCost) {
            console.error('WALLET: ❌ Insufficient balance')
            return {
                success: false,
                error: `Insufficient balance. Required: ${ethers.formatEther(estimatedCost)} ETH, Available: ${ethers.formatEther(balance)} ETH`,
            }
        }

        console.log('WALLET: 🛠️ Building and signing transaction...')

        // Build transaction
        const transaction: ethers.TransactionRequest = {
            type: 2, // EIP-1559 transaction
            to: targetWallet,
            value: amountBigInt,
            gasLimit: gasLimit,
            maxFeePerGas: feeData.maxFeePerGas,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
            nonce: nonce,
            chainId: SEPOLIA_CHAIN_ID, // Base Sepolia chain ID
        }

        // Sign transaction
        const signedTransaction = await connectedWallet.signTransaction(transaction)

        console.log('WALLET: ✅ Transaction signed')
        console.log(`WALLET: 📦 Signed tx: ${signedTransaction}`)

        // Calculate transaction hash (for reference)
        const txHash = ethers.keccak256(signedTransaction)

        return {
            success: true,
            signedTransactionHex: signedTransaction,
            from: wallet.address,
            to: targetWallet,
            amountWei: amountWei,
            estimatedGasUsed: gasLimit.toString(),
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            chainId: SEPOLIA_CHAIN_ID,
            transactionHash: txHash,
            message: `Transaction signed successfully. Amount: ${ethers.formatEther(amountBigInt)} ETH`,
        }
    }
    catch (err: any) {
        console.error('❌ Signing Error:', err)

        // Provide more specific error messages
        if (err.code === 'NETWORK_ERROR') {
            return {
                success: false,
                error: 'Failed to connect to Base mainnet',
            }
        }

        if (err.code === 'INVALID_ARGUMENT') {
            return {
                success: false,
                error: 'Invalid transaction parameters',
            }
        }

        return {
            success: false,
            error: err.message || 'Unknown error',
        }
    }
})
