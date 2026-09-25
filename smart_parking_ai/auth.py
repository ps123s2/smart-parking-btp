"""
Simple Authentication Service for Smart Parking AI
No database required - stores users in JSON file
"""

import json
import hashlib
import secrets
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

# Users storage file
USERS_FILE = Path(__file__).parent.parent / "users.json"


def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_token() -> str:
    """Generate a secure token"""
    return secrets.token_urlsafe(32)


def load_users() -> Dict:
    """Load users from JSON file"""
    if USERS_FILE.exists():
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    return {}


def save_users(users: Dict):
    """Save users to JSON file"""
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def register_user(email: str, password: str, name: str) -> Dict[str, Any]:
    """
    Register a new user
    Returns: {success: bool, message: str, user: dict}
    """
    email = email.strip().lower()
    
    if not email or "@" not in email:
        return {"success": False, "message": "Invalid email address"}
    
    if not password or len(password) < 6:
        return {"success": False, "message": "Password must be at least 6 characters"}
    
    if not name or len(name) < 2:
        return {"success": False, "message": "Name must be at least 2 characters"}
    
    users = load_users()
    
    if email in users:
        return {"success": False, "message": "Email already registered"}
    
    # Create new user
    user_id = f"user_{len(users) + 1}"
    users[email] = {
        "id": user_id,
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": "customer",
        "token": generate_token(),
        "created_at": datetime.now().isoformat(),
        "co2_saved": 0.0,
        "bookings": []
    }
    
    save_users(users)
    
    return {
        "success": True,
        "message": "Account created successfully",
        "user": {
            "id": user_id,
            "email": email,
            "name": name,
            "token": users[email]["token"],
            "role": "customer",
            "co2_saved": 0.0
        }
    }


def login_user(email: str, password: str) -> Dict[str, Any]:
    """
    Login a user
    Returns: {success: bool, message: str, user: dict}
    """
    email = email.strip().lower()
    users = load_users()
    
    if email not in users:
        return {"success": False, "message": "User not found"}
    
    user = users[email]
    if user["password"] != hash_password(password):
        return {"success": False, "message": "Wrong password"}
    
    # Generate new token on login
    new_token = generate_token()
    user["token"] = new_token
    save_users(users)
    
    return {
        "success": True,
        "message": "Logged in successfully",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "token": new_token,
            "role": user["role"],
            "co2_saved": user["co2_saved"]
        }
    }


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify a token and return user data if valid"""
    users = load_users()
    
    for email, user in users.items():
        if user["token"] == token:
            return {
                "id": user["id"],
                "email": email,
                "name": user["name"],
                "role": user["role"],
                "co2_saved": user["co2_saved"]
            }
    
    return None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user data by email"""
    users = load_users()
    email = email.strip().lower()
    
    if email in users:
        user = users[email]
        return {
            "id": user["id"],
            "email": email,
            "name": user["name"],
            "role": user["role"],
            "co2_saved": user["co2_saved"]
        }
    
    return None


def update_co2_saved(email: str, co2_amount: float):
    """Update CO2 saved for a user"""
    users = load_users()
    email = email.strip().lower()
    
    if email in users:
        users[email]["co2_saved"] += co2_amount
        save_users(users)
        return True
    
    return False
