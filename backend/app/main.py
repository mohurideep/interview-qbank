from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .settings import settings
from .routes.questions import router as questions_router
from .routes.auth import router as auth_router

app = FastAPI(title="Interview QBank API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(questions_router)
app.include_router(auth_router)

@app.get("/health")
def health():
    return {"ok": True}
