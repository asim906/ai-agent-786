import os
import requests
import json
import time

# ==============================
# Configuration
# ==============================

# API Key priority: Environment Variable > Hardcoded fall-back
API_KEY = os.getenv("OPENROUTER_API_KEY", "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")
API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Persistence file for history (session state)
HISTORY_FILE = "conversation_history.json"

# ==============================
# State Management
# ==============================

def load_history():
    """Loads existing conversation history from disk."""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading history: {e}")
    return []

def save_history(history):
    """Saves conversation history to disk."""
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=4)
    except Exception as e:
        print(f"Error saving history: {e}")

# ==============================
# Function to query AI (Improved)
# ==============================
def query_ai_agent(prompt: str, history: list, max_tokens: int = 1500):
    """
    Sends a prompt and its history to the model via OpenRouter API.
    Handles errors robustly and returns the response text.
    """
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://whatsapp-ai-agent.app",  # Identifies your app to OpenRouter
        "X-Title": "WhatsApp AI Agent",
    }

    # Construct the message list including history
    messages = [{"role": "system", "content": "You are a helpful assistant."}]
    messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7
    }

    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=35)
        response.raise_for_status()
        data = response.json()

        # 1. Check for OpenRouter internal error blocks
        if "error" in data:
            return f"AI API Error: {data['error'].get('message', 'Unknown error')}"

        # 2. Check for empty choices (common in filter/quota issues)
        if not data.get("choices"):
            return "AI Error: The model returned an empty response. Check your OpenRouter credits or model status."

        # 3. Extract and return content
        reply = data["choices"][0]["message"]["content"].strip()
        
        # Update history with the new exchange
        history.append({"role": "user", "content": prompt})
        history.append({"role": "assistant", "content": reply})
        
        # Only keep last 10 exchanges (20 messages) to avoid token bloat
        if len(history) > 20: 
            history[:] = history[-20:]

        return reply

    except requests.exceptions.HTTPError as e:
        # Handle specific HTTP errors (like 401, 429)
        try:
            err_json = response.json()
            msg = err_json.get("error", {}).get("message", str(e))
        except:
            msg = str(e)
        return f"AI Connection Failure: {msg}"
    except requests.exceptions.RequestException as e:
        return f"Network/Request error: {e}"
    except (KeyError, IndexError) as e:
        return f"Unexpected API response format: {e}"

# ==============================
# Example usage (Production Style)
# ==============================
if __name__ == "__main__":
    print("--- WhatsApp AI Agent Initialized ---")
    
    # Reload state from last session
    conversation_history = load_history()
    if conversation_history:
        print(f"Resumed session with {len(conversation_history)//2} previous exchanges.")
    
    print("Type 'exit' to quit or 'clear' to reset history.")
    
    while True:
        try:
            user_input = input("\nYou: ").strip()
            
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit"]:
                print("Saving state and exiting. Goodbye!")
                save_history(conversation_history)
                break
            if user_input.lower() == "clear":
                conversation_history = []
                save_history([])
                print("History cleared.")
                continue
            
            # Show "loading" state if this were a UI
            print("Thinking...")
            
            reply = query_ai_agent(user_input, conversation_history)
            
            print(f"\nAI Agent says:\n{reply}")
            
            # Save after every successful reply to ensure persistence if crashed/restarted
            save_history(conversation_history)

        except (KeyboardInterrupt, EOFError):
            save_history(conversation_history)
            print("\nSession saved. Goodbye!")
            break
