import base64
import json
import requests

def url_to_base64_image(url: str) -> tuple[str, str]:
    response = requests.get(url)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "image/jpeg")
    encoded = base64.b64encode(response.content).decode("utf-8")
    return encoded, content_type

def parse_ids(text: str) -> list[int]:
    try:
        match = next((part for part in text.splitlines() if "[" in part and "]" in part), "")
        return [int(n) for n in json.loads(match) if isinstance(n, int)]
    except Exception:
        return []

def fetch_json(url: str) -> dict:
    res = requests.get(url)
    res.raise_for_status()
    return res.json()
