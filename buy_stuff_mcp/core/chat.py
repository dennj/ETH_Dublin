from openai.types.chat import ChatCompletionMessageParam
from collections.abc import Sequence
import openai

def call_chat(messages: Sequence[ChatCompletionMessageParam]) -> str:
    response = openai.chat.completions.create(
        model="o4-mini",
        messages=messages,
    )
    return response.choices[0].message.content or ""