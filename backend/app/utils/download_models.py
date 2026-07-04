import os
import urllib.request

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "resources")

MODELS = {
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "pose_landmarker.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
}

def download_models():
    os.makedirs(MODELS_DIR, exist_ok=True)
    for filename, url in MODELS.items():
        dest = os.path.join(MODELS_DIR, filename)
        if not os.path.exists(dest):
            print(f"Downloading {filename} from {url}...")
            try:
                urllib.request.urlretrieve(url, dest)
                print(f"Successfully downloaded {filename} to {dest}")
            except Exception as e:
                print(f"Error downloading {filename}: {e}")
        else:
            print(f"{filename} already exists at {dest}")

if __name__ == "__main__":
    download_models()
