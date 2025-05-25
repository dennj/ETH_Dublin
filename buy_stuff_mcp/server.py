import asyncio

from google.adk.tools.function_tool import FunctionTool
from google.adk.tools.mcp_tool.conversion_utils import adk_to_mcp_tool_type
from mcp import types as mcp_types
from mcp.server.lowlevel import Server, NotificationOptions
from mcp.server.models import InitializationOptions
import mcp.server.stdio

# --- Import tool functions ---
from services.product_finder import find_products
from services.base_product_buyer import buy_products
from services.find_flight import find_flights
from core.utils import url_to_base64_image

# --- Wrap as ADK tools ---
find_tool = FunctionTool(find_products)
buy_tool = FunctionTool(buy_products)
find_flight_tool = FunctionTool(find_flights)

# --- MCP App ---
app: Server = Server("mcp-latinum")

@app.list_tools()
async def list_tools() -> list[mcp_types.Tool]:
    return [
        adk_to_mcp_tool_type(find_tool),
        adk_to_mcp_tool_type(buy_tool),
        adk_to_mcp_tool_type(find_flight_tool),
    ]

# 🏦 Ethereum-compatible seller address (Base Mainnet or Sepolia)
SELLER_WALLET = "0xbF751076C35516DdBcAF99994ef5fCF6dfDe42E5"

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[mcp_types.TextContent | mcp_types.ImageContent]:
    if name == find_tool.name:
        try:
            result = await find_tool.run_async(args=arguments, tool_context=None)
            
            # Debug logging
            print(f"Find tool result: {result}")
            
            if result.get("status") != "success":
                return [mcp_types.TextContent(type="text", text=result.get("message", "❌ Failed to find products"))]
            
            products = result.get("products", [])
            if not products:
                return [mcp_types.TextContent(type="text", text="No products found")]
            
            contents: list[mcp_types.TextContent | mcp_types.ImageContent] = []
            for product in products:
                try:
                    b64_data, mime_type = url_to_base64_image(product["image"])
                    wei_amount = int(product["price"] * 100)
                    
                    contents.append(mcp_types.TextContent(
                        type="text",
                        text=(
                            f"🛒 {product['name']}\n"
                            f"💰 Price: €{product['price']:.2f}\n"
                            f"UUID: {product['product_id']}\n"
                            f"Wallet: {SELLER_WALLET}\n"
                            f"Wei: {wei_amount}"
                        )
                    ))
                    contents.append(mcp_types.ImageContent(
                        type="image",
                        mimeType=mime_type,
                        data=b64_data
                    ))
                except Exception as e:
                    print(f"Error processing product {product.get('name', 'unknown')}: {e}")
                    # Add text-only content if image fails
                    contents.append(mcp_types.TextContent(
                        type="text",
                        text=f"🛒 {product['name']} (image unavailable)\n💰 Price: €{product['price']:.2f}"
                    ))
            
            return contents
            
        except Exception as e:
            print(f"Error in find_tool: {e}")
        return [mcp_types.TextContent(type="text", text=f"Error: {str(e)}")]

    elif name == buy_tool.name:
        result = await buy_tool.run_async(args=arguments, tool_context=None)
        return [mcp_types.TextContent(type="text", text=result.get("message", "Something went wrong."))]

    elif name == find_flight_tool.name:
        result = await find_flight_tool.run_async(args=arguments, tool_context=None)
        if result.get("status") != "success":
            return [mcp_types.TextContent(type="text", text=result.get("message", "❌ Failed to find flights"))]

        return [
            mcp_types.TextContent(
                type="text",
                text=f"✈️ {flight['carrier']} | {flight['price']}\n{flight['details']}"
            )
            for flight in result["flights"]
        ]

    return [mcp_types.TextContent(type="text", text="Tool not found")]

async def run():
    async with mcp.server.stdio.stdio_server() as (r, w):
        await app.run(
            r, w,
            InitializationOptions(
                server_name=app.name,
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                ),
            )
        )

if __name__ == "__main__":
    asyncio.run(run())