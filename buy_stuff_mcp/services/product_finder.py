"""
services/product_finder.py

This module defines an asynchronous function `find_products` that uses OpenAI's chat model to interpret a user's product
search query. It fetches product categories and products from a remote menu API, uses the LLM to determine relevant
categories and products, and returns a structured list of up to 6 matching products based on the user's intent.
"""

from openai.types.chat import ChatCompletionUserMessageParam, ChatCompletionSystemMessageParam
import json
from core.utils import fetch_json, parse_ids
from core.chat import call_chat

async def find_products(input_text: str) -> dict:
    try:
        input_text = input_text.strip()
        base_url = "https://ag35x.myshuppa.com/v1/menu/1189545"

        categories = fetch_json(base_url)["categories"]
        category_text = "\n".join([f"{c['id']} {c['name']}" for c in categories])

        messages: list[ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam] = [
            {"role": "system", "content": "You are helping categorize and select products based on the user's message."},
            {"role": "user", "content": f"User is looking for: {input_text}"},
            {"role": "system", "content": f"Which categories might match?\n{category_text}\nReturn only the matching IDs like [1, 2] or [N]."},
        ]

        category_response = call_chat(messages)
        category_ids = parse_ids(category_response)
        if not category_ids:
            return {"status": "no_match", "products": []}

        all_products = []
        for cat_id in category_ids:
            cat_data = fetch_json(f"{base_url}/{cat_id}")
            for sub in cat_data.get("subcategories", []):
                all_products.extend(sub.get("products", []))

        messages.append({
            "role": "system",
            "content": f"{json.dumps(all_products)}\nSelect the best matches (up to 6), return their product_id like [123, 456]",
        })
        product_response = call_chat(messages)
        selected_ids = parse_ids(product_response)

        selected = [
            {
                "type": "product",
                "product_id": p["product_id"],
                "image": p["thumb_image"],
                "name": p["product_name"],
                "price": p["full_price"],
            }
            for p in all_products if p["product_id"] in selected_ids
        ]
        return {"status": "success", "products": selected}
    except Exception as e:
        return {"status": "error", "message": str(e)}
