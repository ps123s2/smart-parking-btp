"""
Render Deployment Entry Point
Runs both the Firebase dashboard feeder and the Flask API server.
Gunicorn imports `app` from this module.
The dashboard feeder runs in a background daemon thread.
"""

import threading
from firebase_dashboard import run_dashboard
from api import app


def start_dashboard():
    """Run the Firebase data feeder in a background thread."""
    run_dashboard()


# Start Firebase dashboard feeder in background thread
# This runs when gunicorn imports this module
_dashboard_thread = threading.Thread(target=start_dashboard, daemon=True)
_dashboard_thread.start()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
