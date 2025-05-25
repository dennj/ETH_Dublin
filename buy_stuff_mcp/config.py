import os
from dotenv import load_dotenv
import resend
import openai
from supabase import create_client, Client as SupabaseClient

load_dotenv()

# Global config access
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
WALLET_UUID = os.environ["WALLET_UUID"]

openai.api_key = os.environ["OPENAI_API_KEY"]
resend.api_key = os.environ["RESEND_KEY"]
supabase: SupabaseClient = create_client(SUPABASE_URL, SUPABASE_KEY) 