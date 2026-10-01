"""Centralized configuration for the AI engine."""

import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
DEEPFACE_MODEL = os.getenv("DEEPFACE_MODEL", "Emotion")
FRAME_BATCH_INTERVAL = float(os.getenv("FRAME_BATCH_INTERVAL", "1.5"))
MAX_EVENT_HISTORY = int(os.getenv("MAX_EVENT_HISTORY", "40"))
