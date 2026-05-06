"""VERIDOC FastAPI Application — Main Entry Point"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
from routers import tenders, bidders, evaluation, reports

# ─── Create directories ────────────────────────────────────────────────────────
os.makedirs("uploads/tenders", exist_ok=True)
os.makedirs("uploads/bidders", exist_ok=True)

# ─── Init DB ───────────────────────────────────────────────────────────────────
init_db()

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="VERIDOC API",
    description="AI-Powered Government Tender Evaluation System",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───────────────────────────────────────────────────────────────────
app.include_router(tenders.router)
app.include_router(bidders.router)
app.include_router(evaluation.router)
app.include_router(reports.router)

# ─── Static Files (uploaded docs) ─────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def root():
    return {
        "system": "VERIDOC",
        "version": "1.0.0",
        "description": "AI-Powered Government Tender Evaluation Platform",
        "built_for": "CRPF — Central Reserve Police Force",
        "docs": "/api/docs",
        "status": "operational",
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "VERIDOC API"}
