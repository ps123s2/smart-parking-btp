"""Firebase configuration for Smart Parking AI."""

import socket

# Fast fail-safe DNS fallback for regional Firebase Realtime Database
_FIREBASE_HOST = "smartparking-87cee-default-rtdb.asia-southeast1.firebasedatabase.app"
_FIREBASE_FALLBACK_IP = "35.186.236.207"

_orig_getaddrinfo = socket.getaddrinfo

def _fast_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host == _FIREBASE_HOST:
        return _orig_getaddrinfo(_FIREBASE_FALLBACK_IP, port, family, type, proto, flags)
    return _orig_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = _fast_getaddrinfo

FIREBASE_URL = "https://smartparking-87cee-default-rtdb.asia-southeast1.firebasedatabase.app/data.json"
