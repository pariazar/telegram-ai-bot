from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from g4f.client import Client

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (replace with your frontend URL for production)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    messages: List[Message]
    model: str
    max_tokens: int
    temperature: float
    stop: Optional[List[str]] = None
    n: int

@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    authorization: str = Header(None),
    sec_ch_ua: str = Header(None),
    sec_ch_ua_mobile: str = Header(None),
    sec_ch_ua_platform: str = Header(None),
    x_stainless_os: str = Header(None),
    x_stainless_runtime_version: str = Header(None),
    x_stainless_package_version: str = Header(None),
    x_stainless_runtime: str = Header(None),
    x_stainless_arch: str = Header(None),
    x_stainless_lang: str = Header(None),
    referer: str = Header(None),
    user_agent: str = Header(None),
    accept: str = Header(None),
    content_type: str = Header(None),
):
    # Validate the authorization token (if needed)
    if authorization != "Bearer sk-1234567890abcdef":
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Extract the user's message content
    user_message = request.messages[0].content

    client = Client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": user_message}],
        web_search = False
    )

    # Mock the improved text (this is where you would call your AI model)
    improved_text = response.choices[0].message.content

    # Return the response in the expected format
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": improved_text,
                }
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=11434)