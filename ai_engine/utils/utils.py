"""Utility helpers for the AI engine."""
from __future__ import annotations

import base64
from typing import Dict

import cv2
import numpy as np


def decode_base64_frame(payload: Dict[str, str]):
    encoded = payload.get("frame") or payload.get("image")
    if not isinstance(encoded, str):
        raise ValueError("Missing base64 frame data")
    if encoded.startswith("data:") and "," in encoded:
        encoded = encoded.split(",", 1)[1]
    frame_bytes = base64.b64decode(encoded)
    np_buffer = np.frombuffer(frame_bytes, dtype=np.uint8)
    frame = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Invalid frame data")
    return frame


MOOD_COLORS = {
    "happy": "#facc15",
    "sad": "#60a5fa",
    "angry": "#ef4444",
    "confused": "#fb923c",
    "neutral": "#22d3ee",
    "curious": "#a855f7",
    "frustrated": "#f97316",
}


def mood_color(emotion: str) -> str:
    return MOOD_COLORS.get(emotion.lower(), MOOD_COLORS["neutral"])
