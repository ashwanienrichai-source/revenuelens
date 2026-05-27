"""
RevenueLens AI — FastAPI Backend
Handles AI chat with Groq (primary) + Gemini (fallback)
Deploy to: backend/main.py on Render
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
import os
import json

app = FastAPI(title="RevenueLens AI API", version="1.0.0")

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://revenuelens.ashwaniandcompany.com",
        "https://revenuelens-seven.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ──────────────────────────────────────────────────────────────────
GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")
GROQ_MODEL      = "llama-3.3-70b-versatile"
GEMINI_MODEL    = "gemini-1.5-flash"

# ─── Request/Response Models ─────────────────────────────────────────────────
class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class RevenueContext(BaseModel):
    period: Optional[str] = None
    beginningARR: Optional[float] = None
    endingARR: Optional[float] = None
    newLogo: Optional[float] = None
    upsell: Optional[float] = None
    crossSell: Optional[float] = None
    downsell: Optional[float] = None
    churn: Optional[float] = None
    churnPartial: Optional[float] = None
    lapsed: Optional[float] = None
    returning: Optional[float] = None
    nrr: Optional[float] = None
    grr: Optional[float] = None
    totalCustomers: Optional[int] = None
    topMovers: Optional[List[Dict[str, Any]]] = None
    periodCount: Optional[int] = None

class ChatRequest(BaseModel):
    message: str
    mode: str = "consultant"  # consultant | insights | educator | advisor
    context: Optional[RevenueContext] = None
    history: Optional[List[Message]] = []

class ChatResponse(BaseModel):
    response: str
    provider: str  # "groq" or "gemini"
    mode: str

# ─── System Prompts ───────────────────────────────────────────────────────────
def build_system_prompt(mode: str, context: Optional[RevenueContext]) -> str:
    base = """You are RevenueLens AI — an elite revenue intelligence system built for CFOs, PE investors, and revenue leaders.

You combine:
- Deep SaaS financial expertise (ARR, NRR, GRR, cohorts, waterfall analysis)
- Private equity investment analysis mindset
- Executive-level communication (precise, concise, data-backed)
- Actionable decision intelligence

Rules:
- Always ground answers in the provided revenue data when available
- Never make up numbers — only use data from the context
- Be precise with metrics and percentages
- Speak like a CFO, not a data analyst
- Lead with the insight, follow with the reasoning
- Keep responses focused and executive-ready"""

    context_block = ""
    if context:
        ctx_parts = []
        if context.period:
            ctx_parts.append(f"Period: {context.period}")
        if context.beginningARR is not None:
            ctx_parts.append(f"Beginning ARR: ${context.beginningARR:,.0f}")
        if context.endingARR is not None:
            ctx_parts.append(f"Ending ARR: ${context.endingARR:,.0f}")
        if context.newLogo is not None:
            ctx_parts.append(f"New Logo: ${context.newLogo:,.0f}")
        if context.upsell is not None:
            ctx_parts.append(f"Upsell: ${context.upsell:,.0f}")
        if context.crossSell is not None:
            ctx_parts.append(f"Cross-sell: ${context.crossSell:,.0f}")
        if context.downsell is not None:
            ctx_parts.append(f"Downsell: ${context.downsell:,.0f}")
        if context.churn is not None:
            ctx_parts.append(f"Churn: ${context.churn:,.0f}")
        if context.nrr is not None:
            ctx_parts.append(f"NRR: {context.nrr:.1f}%")
        if context.grr is not None:
            ctx_parts.append(f"GRR: {context.grr:.1f}%")
        if context.totalCustomers is not None:
            ctx_parts.append(f"Total Customers: {context.totalCustomers}")

        if ctx_parts:
            context_block = "\n\nLIVE REVENUE DATA:\n" + "\n".join(ctx_parts)

    mode_prompts = {
        "consultant": f"""{base}{context_block}

MODE: AI Consultant
Answer questions about the business using the revenue data above.
Be direct, specific, and data-backed. If data is missing, say so clearly.""",

        "insights": f"""{base}{context_block}

MODE: AI Insights
Generate an executive-ready narrative analysis of the revenue data above.
Structure: What moved → What caused it → Business impact → Key risks → Opportunities.
Be concise — this is for a CFO's morning briefing.""",

        "educator": f"""{base}{context_block}

MODE: AI Educator
Explain SaaS financial metrics in plain English.
Always connect the explanation back to the user's own business data when available.
Make complex concepts accessible without dumbing them down.""",

        "advisor": f"""{base}{context_block}

MODE: Decision Advisor
Based on the revenue data, identify:
1. Top 3 immediate actions to take
2. Upsell/expansion opportunities
3. Churn risks to address
4. Strategic recommendations
Be specific and actionable — not generic advice.""",
    }

    return mode_prompts.get(mode, mode_prompts["consultant"])


# ─── Groq API Call ────────────────────────────────────────────────────────────
async def call_groq(system_prompt: str, messages: List[Dict], user_message: str) -> str:
    msgs = [{"role": "system", "content": system_prompt}]
    for m in messages[-6:]:  # last 6 messages for context
        msgs.append({"role": m["role"], "content": m["content"]})
    msgs.append({"role": "user", "content": user_message})

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "messages": msgs,
                "max_tokens": 1024,
                "temperature": 0.3,
            }
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ─── Gemini API Call ──────────────────────────────────────────────────────────
async def call_gemini(system_prompt: str, messages: List[Dict], user_message: str) -> str:
    # Build conversation history for Gemini
    contents = []
    for m in messages[-6:]:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    contents.append({"role": "user", "parts": [{"text": user_message}]})

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}",
            json={
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": contents,
                "generationConfig": {
                    "maxOutputTokens": 1024,
                    "temperature": 0.3,
                }
            }
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/")
async def health():
    return {"status": "ok", "service": "RevenueLens AI API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not GROQ_API_KEY and not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="No AI provider configured")

    system_prompt = build_system_prompt(req.mode, req.context)
    history = [m.dict() for m in (req.history or [])]

    # Try Groq first, fallback to Gemini
    if GROQ_API_KEY:
        try:
            response = await call_groq(system_prompt, history, req.message)
            return ChatResponse(response=response, provider="groq", mode=req.mode)
        except Exception as e:
            print(f"Groq failed: {e}, falling back to Gemini")

    if GEMINI_API_KEY:
        try:
            response = await call_gemini(system_prompt, history, req.message)
            return ChatResponse(response=response, provider="gemini", mode=req.mode)
        except Exception as e:
            print(f"Gemini failed: {e}")
            raise HTTPException(status_code=500, detail=f"All AI providers failed: {str(e)}")

    raise HTTPException(status_code=500, detail="No AI provider available")


@app.post("/insights")
async def generate_insights(context: RevenueContext):
    """Auto-generate executive insights from revenue data"""
    req = ChatRequest(
        message="Generate a comprehensive executive revenue intelligence briefing based on the data provided.",
        mode="insights",
        context=context,
        history=[]
    )
    return await chat(req)
