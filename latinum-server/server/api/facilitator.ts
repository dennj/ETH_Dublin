// server/api/facilitator.ts

/*
# Facilitator API - Base Mainnet

The /api/facilitator endpoint validates Base (Ethereum L2) transactions submitted as proof of payment for MCP paywalled services. It accepts a signedTransactionHex, an expectedRecipient, and an expectedAmountWei.

Upon request, it:
    1. Decodes and relays the hex-encoded transaction to the Base mainnet.
    2. Waits for confirmation with configurable block confirmations.
    3. Retrieves the transaction receipt and parses transfer details.
    4. Verifies the destination and value match the declared intent.

If the payment is valid and settled, it returns { allowed: true, txHash }. Otherwise, it rejects the request. This API acts as a stateless validator, enabling agents to fulfill 402-challenged MCP calls with cryptographically verifiable payments.
*/

import { readBody, eventHandler } from 'h3'
import { ethers } from 'ethers'

// Base Mainnet RPC URL - you can also use other providers like Alchemy or Infura
// const BASE_RPC_URL = 'https://mainnet.base.org'
const BASE_RPC_URL = 'https://sepolia.base.org'

// Number of block confirmations to wait for
const CONFIRMATIONS = 3

export const config = {
    runtime: 'nodejs',
}

export default eventHandler(async (event) => {
    try {
        console.log('FACILITATOR: 📥 Incoming facilitator request...')

        const {
            signedTransactionHex,
            expectedRecipient,
            expectedAmountWei,
        } = await readBody(event)

        console.log('FACILITATOR: 🔍 Payload received:', {
            expectedRecipient,
            expectedAmountWei,
            signedTransactionHex: signedTransactionHex,
        })

        if (!signedTransactionHex || !expectedRecipient || !expectedAmountWei) {
            console.warn('FACILITATOR: ⚠️ Missing required fields in request')
            return { allowed: false, error: 'Missing required fields' }
        }

        // Connect to Base mainnet
        const provider = new ethers.JsonRpcProvider(BASE_RPC_URL)

        // Validate addresses
        if (!ethers.isAddress(expectedRecipient)) {
            console.error('FACILITATOR: ❌ Invalid recipient address')
            return { allowed: false, error: 'Invalid recipient address' }
        }

        console.log('FACILITATOR: 🚀 Sending raw transaction to Base...')

        // Send the transaction
        const txResponse = await provider.broadcastTransaction(signedTransactionHex)
        const txHash = txResponse.hash

        console.log('FACILITATOR: ⏳ Waiting for confirmation...', { txHash })

        // Wait for confirmations
        const receipt = await txResponse.wait(CONFIRMATIONS)

        if (!receipt || receipt.status !== 1) {
            console.error('FACILITATOR: ❌ Transaction failed or reverted')
            return { allowed: false, error: 'Transaction failed' }
        }

        console.log('FACILITATOR: 🔎 Fetching and parsing transaction...')

        // Get the full transaction details
        const tx = await provider.getTransaction(txHash)

        if (!tx) {
            console.error('FACILITATOR: ❌ Could not fetch transaction details')
            return { allowed: false, error: 'Could not fetch transaction' }
        }

        // Verify the transaction details
        const expectedAmount = BigInt(expectedAmountWei)
        const actualRecipient = tx.to?.toLowerCase()
        const actualAmount = tx.value

        console.log('FACILITATOR: 🔬 Inspecting transaction:', {
            actualRecipient,
            actualAmount: actualAmount.toString(),
            expectedRecipient: expectedRecipient.toLowerCase(),
            expectedAmount: expectedAmount.toString(),
        })

        // Check if this is a direct ETH transfer
        const isValidTransfer = (
            actualRecipient === expectedRecipient.toLowerCase()
            && actualAmount === expectedAmount
        )

        // If not a direct ETH transfer, check for ERC20 token transfers
        if (!isValidTransfer && receipt.logs.length > 0) {
            console.log('FACILITATOR: 🪙 Checking for ERC20 token transfers...')

            // ERC20 Transfer event signature
            const TRANSFER_EVENT_SIG = ethers.id('Transfer(address,address,uint256)')

            const validTokenTransfer = receipt.logs.some((log) => {
                if (log.topics[0] !== TRANSFER_EVENT_SIG) return false

                try {
                    // Decode the transfer event
                    const from = ethers.getAddress('0x' + log.topics[1].slice(26))
                    const to = ethers.getAddress('0x' + log.topics[2].slice(26))
                    const value = BigInt(log.data)

                    console.log('FACILITATOR: 🪙 Found token transfer:', {
                        from,
                        to,
                        value: value.toString(),
                        token: log.address,
                    })

                    return (
                        to.toLowerCase() === expectedRecipient.toLowerCase()
                        && value === expectedAmount
                    )
                }
                catch (e) {
                    console.error('FACILITATOR: ⚠️ Error parsing token transfer:', e)
                    return false
                }
            })

            if (validTokenTransfer) {
                console.log('✅ Valid token transfer confirmed:', txHash)
                return {
                    allowed: true,
                    txHash,
                    type: 'token',
                }
            }
        }

        if (!isValidTransfer) {
            console.warn('FACILITATOR: ⚠️ Transaction found, but transfer does not match expected values')
            return { allowed: false, error: 'Transfer mismatch or invalid format' }
        }

        console.log('✅ Transaction valid and confirmed:', txHash)

        return {
            allowed: true,
            txHash,
            type: 'eth',
        }
    }
    catch (err: any) {
        console.error('❌ Facilitator error:', err)

        // Provide more specific error messages
        if (err.code === 'INVALID_ARGUMENT') {
            return {
                allowed: false,
                error: 'Invalid transaction format',
            }
        }

        if (err.code === 'NETWORK_ERROR') {
            return {
                allowed: false,
                error: 'Network connection error',
            }
        }

        if (err.code === 'NONCE_EXPIRED') {
            return {
                allowed: false,
                error: 'Transaction nonce already used',
            }
        }

        return {
            allowed: false,
            error: err.message || 'Internal Server Error',
        }
    }
})
