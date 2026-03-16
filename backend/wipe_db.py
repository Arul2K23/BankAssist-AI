import os
import shutil
from dotenv import load_dotenv
load_dotenv()

from app.db.session import engine, Base

print("Starting full database wipe...")

# Drop all tables in Postgres and recreate them empty
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print("PostgreSQL tables successfully dropped and recreated.")

# Clean up Qdrant Vector Data
qdrant_path = "data/qdrant_db"
if os.path.exists(qdrant_path):
    shutil.rmtree(qdrant_path)
    os.makedirs(qdrant_path, exist_ok=True)
    print("AI Neural Index (Qdrant) wiped.")

# Clean up Uploaded PDF Files
uploads_path = "data/uploads"
if os.path.exists(uploads_path):
    shutil.rmtree(uploads_path)
    os.makedirs(uploads_path, exist_ok=True)
    print("Uploaded documents deleted.")

print("All data has been completely erased. You have a completely clean slate.")
