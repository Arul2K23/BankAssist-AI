import uvicorn
import sys
import traceback

if __name__ == "__main__":
    try:
        from app.main import app
        uvicorn.run(app, host="127.0.0.1", port=8000)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
