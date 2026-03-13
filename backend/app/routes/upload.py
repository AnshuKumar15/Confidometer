import os
from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.speech import Speech
from app.utils.security import get_current_user
from fastapi import BackgroundTasks
from app.services.processor import process_speech

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    contents = await file.read()

    with open(file_path, "wb") as f:
        f.write(contents)

    speech = Speech(
        user_id=current_user.id,
        video_path=file_path,
        status="processing"
    )

    db.add(speech)
    db.commit()
    db.refresh(speech)

    # 🔥 Trigger background processing
    background_tasks.add_task(process_speech, speech.id)

    return {
        "message": "Video uploaded successfully",
        "speech_id": speech.id,
        "status": "processing"
    }