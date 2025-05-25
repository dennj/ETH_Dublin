from config import supabase, WALLET_UUID
from core.email import send_email
import requests

SELLER_WALLET = "0xbF751076C35516DdBcAF99994ef5fCF6dfDe42E5"
FACILITATOR_URL = "http://localhost:3000/api/base_facilitator"

def buy_products(productIDs: list[int], signed_tx_hex: str) -> dict:
    """
    Attempts to purchase one or more products via an Ethereum (Base) transaction.

    Args:
        productIDs: List of product IDs (integers) to purchase.
        signed_tx_hex: Hex-encoded signed transaction.

    Returns:
        dict: success status, message, and payment details if required.
    """
    try:
        if not productIDs:
            return {"success": False, "message": "❌ Invalid input. Expected product IDs."}

        # Get wallet info
        wallet_resp = supabase.table("wallet").select("credit, name, email").eq("uuid", WALLET_UUID).single().execute()
        wallet_data = wallet_resp.data
        if not wallet_data:
            return {"success": False, "message": "❌ Wallet not found."}

        # Get product info
        products_resp = supabase.table("product").select("id, name, price, image").in_("id", productIDs).execute()
        products = products_resp.data
        if not products:
            return {"success": False, "message": "❌ No products found."}

        # Calculate total cost (assumed stored in Wei = cents * 10^16 for € values)
        total_cost_wei = sum(p["price"] for p in products)

        # 🔍 Verify payment via Base facilitator
        response = requests.post(FACILITATOR_URL, json={
            "signedTransactionHex": signed_tx_hex,
            "expectedRecipient": SELLER_WALLET,
            "expectedAmountWei": str(total_cost_wei)
        })

        result = response.json()
        if not result.get("allowed"):
            return {
                "success": False,
                "status": 402,
                "message": f"💳 Payment required: {total_cost_wei} wei to {SELLER_WALLET}. Please provide a signed transaction. If you don't have a wallet, try Latinum MCP Wallet at https://latinum.ai",
                "payment_required": True,
                "seller_wallet": SELLER_WALLET,
                "amount_wei": total_cost_wei,
            }

        # ✅ Payment confirmed – record order
        current_credit = wallet_data.get("credit", 0)

        order_rows = [
            {
                "wallet": WALLET_UUID,
                "product_id": p["id"],
                "title": p["name"],
                "image": p["image"],
                "price": p["price"],
                "paid": True,
            } for p in products
        ]
        supabase.table("orders").insert(order_rows).execute()
        supabase.table("wallet").update({"credit": current_credit - total_cost_wei}).eq("uuid", WALLET_UUID).execute()

        # 📧 Send email confirmation
        name = wallet_data.get("name")
        email = wallet_data.get("email")
        if email:
            product_lines = "\n".join([f"• {p['name']} – €{p['price'] / 100:.2f}" for p in products])
            total_str = f"€{sum(p['price'] for p in products) / 100:.2f}"


            body = f"""
                Hi {name or 'there'},<br><br>
                Thanks for your purchase!<br><br>
                <b>Order Summary:</b><br>
                {"<br>".join([f"• {p['name']} – €{p['price'] / 100:.2f}<br><img src='{p['image']}' width='150' style='margin:10px 0;'><br>" for p in products])}
                <br><b>Total:</b> {total_str}<br><br>
                We hope to see you again soon!
                """
            
            send_email(
                email,
                "🛒 Your Latinum Order Confirmation",
                body
            )

            if email not in ["dennj.osele@gmail.com", "brendanregan100@gmail.com"]:
                admin_msg = f"{email} placed an order.\n\n{product_lines}\n\nTotal: {total_str}"
                for admin in ["dennj.osele@gmail.com", "brendanregan100@gmail.com"]:
                    send_email(admin, f"Latinum Order by {email}", admin_msg)


        tx_hash = result.get("txHash")
        explorer_url = f"https://sepolia.basescan.org/tx/{tx_hash}" if tx_hash else None

        return {
            "success": True,
            "message": f"✅ Bought {len(products)} product(s) for {total_cost_wei} wei.\n\n🔎 View transaction:\n{explorer_url}",
            "tx_hash": tx_hash,
            "explorer_url": explorer_url,
        }

    except Exception as e:
        return {"success": False, "message": f"❌ Error: {str(e)}"}