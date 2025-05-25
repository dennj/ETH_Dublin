# Latinum Agentic Commerce: MCP Wallet + 402 Facilitator

**Latinum** is a payment middleware that enables MCP builders to monetize their services.

Over the past few months, developers have built thousands of MCP servers—but there's been no way to get paid. Latinum introduces an MCP-compatible wallet that allows agents to autonomously pay for the services they consume.

### Why It Matters

Imagine using a tool like **Cursor**, which relies on a dozen backend services (e.g., Figma, deployment platforms). Normally, you'd need to:

* Sign up for each service manually
* Manage billing
* Copy API tokens into the MCP config

With Latinum, all of that disappears. Agents can:

* Manage their own budget
* Generate signed transactions
* Pay per request with a single API call

This is just the beginning. In the coming years, most digital transactions—ordering groceries, booking a ride—will be made by agents on behalf of humans.

---

### 🧠 How It Works

When an agent like **Cursor** or **Claude** calls an MCP tool with a Paywall Service, the MCP responds with a payment requirement. The agent then:

1. Uses the **Latinum Wallet MCP** to generate a **signed transaction** on Base Network.
2. Repeats the request to the MCP, now including the signed payload.
3. The MCP verifies the payment by contacting the **Latinum Facilitator**, which:
   - Validates the transaction on Base Network
   - Confirms receipt of funds
4. If valid, the MCP proceeds to fulfill the original request.

This enables **autonomous, API-level payments** between agents and service providers.

![Latinum Flow](/structure.png)

---

## 📦 Project Structure

```
LATINUM-COLOSSEUM/
├── buy_stuff_mcp/                  # MCP server to search and buy products
│   ├── core/                       # Shared logic
│   │   ├── chat.py
│   │   ├── email.py
│   │   └── utils.py
│   ├── services/                   # Business logic for product buying
│   │   ├── product_buyer.py
│   │   └── product_finder.py
│   ├── config.py
│   ├── server.py                   # MCP entrypoint
│   └── requirements.txt
│
├── latinum-server/                # Nuxt-based 402 facilitator and wallet API
│   ├── server/api/
│   │   ├── base_wallet.ts           # Generates signed Ethereum/Base payment payloads
│   │   └── facilitator.ts         # Verifies and submits signed payments
│   └── package.json
│
├── latinum_wallet_mcp/           # MCP tool to generate base64 transactions
│   ├── server.py
│   └── requirements.txt
|
├── Subscriptions-NFT/           # OpenZeppelin code for an NFT token that expires after a month and can be used to recognize agents that pay for the subscription and can access the service. The facilitator part to use it is not completed in time for this Hackathon.
│
└── README.md
```

---

## ✨ Getting Started

### 1. Clone the Repo

```bash
git clone https://github.com/dennj/latinum-colosseum.git
cd latinum-colosseum
```

### 2. Run the Facilitator

```bash
cd latinum-server
npm install
```

Add your env:

```env
ETHEREUM_PRIVATE_KEY=your_hex_encoded_private_key
BASE_RPC_URL=https://sepolia.base.org
```

Then start the server:

```bash
npx nitro dev
```

---

## 🤖 MCP Configuration (Claude)

Update your Claude `claude.desktop.json` config to register the two MCPs:

```json
{
  "mcpServers": {
    "buy_stuff_server": {
      "command": "/Users/yourname/workspace/buy_stuff_mcp/.venv/bin/python",
      "args": [
        "/Users/yourname/workspace/buy_stuff_mcp/server.py"
      ]
    },
    "latinum_wallet_mcp": {
      "command": "/Users/yourname/workspace/latinum_wallet_mcp/.venv/bin/python",
      "args": [
        "/Users/yourname/workspace/latinum_wallet_mcp/server.py"
      ]
    }
  }
}
```

Use the right path.

Make sure both `latinum_wallet_mcp` and `buy_stuff_mcp` have working virtual environments and proper `.env` configuration.

---

## 🍚 Try It Out

Once both MCPs are running, open Claude and ask:

> *"Buy me some oranges."*

The agent will:

1. Discover the product
2. Request a signed payment payload from the wallet
3. Submit the signed payload to the facilitator
4. Complete the purchase ✅

![Claude Find](/claude_find.png)

![Claude Buy](/claude_buy.png)
