"""Tiny, structurally valid image files for tests (no imaging library needed)."""


def _seg(marker: int, payload: bytes) -> bytes:
    return bytes((0xFF, marker)) + (len(payload) + 2).to_bytes(2, "big") + payload


JFIF = _seg(0xE0, b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00")
EXIF_GPS = _seg(0xE1, b"Exif\x00\x00MM\x00*GPSLatitude=28.9832N;GPSLongitude=77.0908E;Model=PhoneX")
ICC = _seg(0xE2, b"ICC_PROFILE\x00\x01\x01" + b"\x00" * 16)
MPF = _seg(0xE2, b"MPF\x00secondary-image-index")
COMMENT = _seg(0xFE, b"owner: Asha Test")
BODY = (
    _seg(0xDB, b"\x00" + bytes(range(1, 65)))  # DQT
    + _seg(0xC0, b"\x08\x00\x01\x00\x01\x01\x01\x11\x00")  # SOF0 1x1
    + _seg(0xC4, b"\x00" + bytes([0, 1] + [0] * 14) + b"\x00")  # DHT
    + _seg(0xDA, b"\x01\x01\x00\x00\x3f\x00")  # SOS
    + b"\x12\xff\x00\x34\xff\xd0\x56"  # scan data with a stuffed 0xFF and a restart marker
)


def jpeg(*, exif: bool = False, extras: bool = False, trailing: bytes = b"") -> bytes:
    """A 1x1 baseline JPEG; optionally with EXIF GPS, other metadata and data after EOI."""
    meta = (EXIF_GPS if exif else b"") + ((ICC + MPF + COMMENT) if extras else b"")
    return b"\xff\xd8" + JFIF + meta + BODY + b"\xff\xd9" + trailing


def png(*, text: bool = False) -> bytes:
    import zlib

    def chunk(ctype: bytes, data: bytes) -> bytes:
        return len(data).to_bytes(4, "big") + ctype + data + zlib.crc32(ctype + data).to_bytes(4, "big")

    ihdr = chunk(b"IHDR", (1).to_bytes(4, "big") * 2 + b"\x08\x02\x00\x00\x00")
    idat = chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00"))
    meta = chunk(b"tEXt", b"GPS\x0028.98,77.09") + chunk(b"eXIf", b"MM\x00*GPS") if text else b""
    return b"\x89PNG\r\n\x1a\n" + ihdr + meta + idat + chunk(b"IEND", b"")


def webp(*, exif: bool = False) -> bytes:
    def chunk(fourcc: bytes, data: bytes) -> bytes:
        pad = b"\x00" if len(data) % 2 else b""
        return fourcc + len(data).to_bytes(4, "little") + data + pad

    vp8x = chunk(b"VP8X", bytes([0x08 if exif else 0x00, 0, 0, 0]) + b"\x00\x00\x00" + b"\x00\x00\x00")
    vp8l = chunk(b"VP8L", b"\x2f\x00\x00\x00\x00")
    body = vp8x + vp8l + (chunk(b"EXIF", b"MM\x00*GPSLatitude") if exif else b"")
    return b"RIFF" + (len(body) + 4).to_bytes(4, "little") + b"WEBP" + body
