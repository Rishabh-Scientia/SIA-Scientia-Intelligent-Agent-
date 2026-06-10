import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# Initialize FastAPI app
app = FastAPI(
    title="SIA API",
    description="Backend API for SIA (Scientia Intelligent Agent)",
    version="1.0.0"
)

# CORS middleware config (helpful for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "https://rishabhscientia.app.n8n.cloud/webhook/0dcd0993-e4ce-4332-9777-972c05a2b358")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Request model
class ChatMessage(BaseModel):
    message: str

# API endpoint to forward messages to n8n webhook
@app.post("/api/chat")
async def chat_with_agent(chat_msg: ChatMessage):
    user_message = chat_msg.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    try:
        # Call n8n webhook synchronously in FastAPI's thread pool
        # This prevents blocking the main async event loop
        response = requests.post(
            N8N_WEBHOOK_URL,
            json={"message": user_message},
            timeout=45
        )
        response.raise_for_status()
        
        data = response.json()
        
        # Parse output from n8n
        if isinstance(data, list) and len(data) > 0 and "output" in data[0]:
            ai_response = data[0]["output"]
        elif isinstance(data, dict) and "output" in data:
            ai_response = data["output"]
        else:
            ai_response = "⚠️ Received response from n8n backend, but in an unrecognized format."
            
        return {"output": ai_response}
        
    except requests.exceptions.Timeout:
        return JSONResponse(
            status_code=504,
            content={"detail": "The agent request timed out. Please check if your n8n workflow is active."}
        )
    except requests.exceptions.RequestException as e:
        return JSONResponse(
            status_code=502,
            content={"detail": f"Failed to communicate with n8n backend: {str(e)}"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"An unexpected error occurred: {str(e)}"}
        )

# Fallback to serve index.html for any unhandled routes (for SPA style navigation)
@app.get("/")
async def read_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse(
        status_code=404,
        content={"detail": f"Frontend files not found. Please verify {index_path} exists."}
    )

# Mount static files (MUST be mounted after other routes to avoid overriding specific api routes)
if os.path.exists(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    # Create static directory if it doesn't exist yet
    os.makedirs(STATIC_DIR, exist_ok=True)
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
