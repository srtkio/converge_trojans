"""Citizen photos: validate, store, look up. Served by GET /photos/{id}."""
import base64
import binascii
import re
import uuid

from fastapi import HTTPException
from sqlmodel import Session

from app.db import now
from app.models import Photo

MAX_PHOTO_BYTES = 5 * 1024 * 1024
# Cap on the encoded string so oversized uploads fail fast with 413 before decoding.
MAX_PHOTO_B64 = MAX_PHOTO_BYTES * 4 // 3 + 16
PHOTO_ID = re.compile(r"^ph_[0-9a-f]{16}$")


def _matches(raw: bytes, media_type: str) -> bool:
    """The bytes must really be the declared image type, so /photos never serves HTML or scripts."""
    if media_type == "image/jpeg":
        return raw.startswith(b"\xff\xd8\xff")
    if media_type == "image/png":
        return raw.startswith(b"\x89PNG\r\n\x1a\n")
    if media_type == "image/gif":
        return raw.startswith((b"GIF87a", b"GIF89a"))
    if media_type == "image/webp":
        return len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
    return False


def decode(data_b64: str, media_type: str) -> bytes:
    """Validate an uploaded photo: 413 if over 5 MB, 422 if not valid base64 or not the declared type."""
    too_big = f"Photo too large (max {MAX_PHOTO_BYTES // (1024 * 1024)} MB)"
    if len(data_b64) > MAX_PHOTO_B64:
        raise HTTPException(413, too_big)
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "photo.data is not valid base64") from None
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(413, too_big)
    if not _matches(raw, media_type):
        raise HTTPException(422, f"photo.data is not a valid {media_type} image")
    return raw


# --- metadata stripping (privacy): phone photos carry EXIF GPS and device details --------------


def _strip_jpeg(raw: bytes) -> bytes:
    """Drop APP1 (EXIF/XMP), APP3-APP13/APP15, COM, non-ICC APP2 (e.g. MPF) and anything after
    the image's EOI (appended thumbnails or depth maps). Pixel data is copied unchanged."""
    n = len(raw)
    out = bytearray(b"\xff\xd8")
    i = 2
    while i < n:
        if raw[i] != 0xFF:
            raise ValueError("bad JPEG marker")
        while i < n and raw[i] == 0xFF:  # fill bytes
            i += 1
        if i >= n:
            break
        marker = raw[i]
        i += 1
        if marker == 0xD9:  # EOI: stop; trailing appended images are dropped
            out += b"\xff\xd9"
            return bytes(out)
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:  # standalone markers
            out += bytes((0xFF, marker))
            continue
        if i + 2 > n:
            raise ValueError("truncated JPEG segment")
        length = int.from_bytes(raw[i:i + 2], "big")
        segment = raw[i:i + length]
        keep = not (
            marker in (0xE1, 0xFE)
            or 0xE3 <= marker <= 0xED
            or marker == 0xEF
            or (marker == 0xE2 and not segment[2:14].startswith(b"ICC_PROFILE"))
        )
        if keep:
            out += bytes((0xFF, marker)) + segment
        i += length
        if marker == 0xDA:  # SOS: copy entropy-coded data up to the next real marker
            start = i
            while i < n - 1:
                if raw[i] == 0xFF and raw[i + 1] != 0x00 and not 0xD0 <= raw[i + 1] <= 0xD7:
                    break
                i += 1
            out += raw[start:i]
    raise ValueError("JPEG has no end marker")


_PNG_METADATA = {b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME"}


def _strip_png(raw: bytes) -> bytes:
    out = bytearray(raw[:8])
    i = 8
    while i + 12 <= len(raw):
        length = int.from_bytes(raw[i:i + 4], "big")
        ctype = raw[i + 4:i + 8]
        end = i + 12 + length
        if ctype not in _PNG_METADATA:
            out += raw[i:end]
        i = end
        if ctype == b"IEND":
            return bytes(out)
    raise ValueError("PNG has no IEND chunk")


def _strip_webp(raw: bytes) -> bytes:
    out = bytearray()
    i = 12
    while i + 8 <= len(raw):
        fourcc = raw[i:i + 4]
        size = int.from_bytes(raw[i + 4:i + 8], "little")
        end = i + 8 + size + (size & 1)
        chunk = bytearray(raw[i:end])
        if fourcc == b"VP8X" and len(chunk) > 8:
            chunk[8] &= ~0x0C & 0xFF  # clear the EXIF (0x08) and XMP (0x04) flags
        if fourcc not in (b"EXIF", b"XMP "):
            out += chunk
        i = end
    return b"RIFF" + (len(out) + 4).to_bytes(4, "little") + b"WEBP" + bytes(out)


def strip_metadata(raw: bytes, media_type: str) -> bytes:
    """Remove location/device metadata without re-encoding. 422 if the file is malformed."""
    try:
        if media_type == "image/jpeg":
            return _strip_jpeg(raw)
        if media_type == "image/png":
            return _strip_png(raw)
        if media_type == "image/webp":
            return _strip_webp(raw)
        return raw  # GIF has no EXIF
    except (ValueError, IndexError):
        raise HTTPException(422, f"photo.data is not a valid {media_type} image") from None


def store(session: Session, raw: bytes, media_type: str) -> Photo:
    raw = strip_metadata(raw, media_type)
    photo = Photo(id=f"ph_{uuid.uuid4().hex[:16]}", media_type=media_type, size_bytes=len(raw), data=raw,
                  created_at=now(session))
    session.add(photo)
    session.flush()
    return photo


def get(session: Session, photo_id: str) -> Photo | None:
    if not PHOTO_ID.match(photo_id):
        return None
    return session.get(Photo, photo_id)
