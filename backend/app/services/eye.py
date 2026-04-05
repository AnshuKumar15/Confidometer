import os
import urllib.request
from typing import Any, Optional, cast

import cv2
import mediapipe as mp

mp_solutions = cast(Any, getattr(mp, "solutions", None))
mp_face_mesh = cast(Any, getattr(mp_solutions, "face_mesh", None))

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models_data")
DNN_PROTO = os.path.join(MODEL_DIR, "deploy.prototxt")
DNN_MODEL = os.path.join(MODEL_DIR, "res10_300x300_ssd_iter_140000_fp16.caffemodel")

DNN_PROTO_URL = (
    "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
)
DNN_MODEL_URL = (
    "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/"
    "res10_300x300_ssd_iter_140000_fp16.caffemodel"
)


def _haar_file_path(file_name: str) -> str:
    cv2_base_dir = os.path.dirname(cv2.__file__)
    return os.path.join(cv2_base_dir, "data", file_name)


def _download_if_missing(url: str, target_path: str) -> bool:
    if os.path.exists(target_path):
        return True

    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    try:
        urllib.request.urlretrieve(url, target_path)
        return True
    except Exception as err:
        print(f"[WARN] Unable to download model file {target_path}: {err}")
        return False


def _load_face_dnn() -> Optional[Any]:
    proto_ok = _download_if_missing(DNN_PROTO_URL, DNN_PROTO)
    model_ok = _download_if_missing(DNN_MODEL_URL, DNN_MODEL)
    if not (proto_ok and model_ok):
        return None

    try:
        return cv2.dnn.readNetFromCaffe(DNN_PROTO, DNN_MODEL)
    except Exception as err:
        print(f"[WARN] Failed to load DNN face model: {err}")
        return None


def _largest_face_with_dnn(frame: Any, net: Any) -> Optional[tuple[int, int, int, int]]:
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(
        cv2.resize(frame, (300, 300)),
        scalefactor=1.0,
        size=(300, 300),
        mean=(104.0, 177.0, 123.0),
    )
    net.setInput(blob)
    detections = net.forward()

    best_box: Optional[tuple[int, int, int, int]] = None
    best_area = 0

    for i in range(detections.shape[2]):
        confidence = float(detections[0, 0, i, 2])
        if confidence < 0.55:
            continue

        box = detections[0, 0, i, 3:7] * [w, h, w, h]
        start_x, start_y, end_x, end_y = box.astype("int")

        start_x = max(0, min(start_x, w - 1))
        start_y = max(0, min(start_y, h - 1))
        end_x = max(0, min(end_x, w - 1))
        end_y = max(0, min(end_y, h - 1))

        bw = max(0, end_x - start_x)
        bh = max(0, end_y - start_y)
        area = bw * bh
        if area > best_area and bw > 20 and bh > 20:
            best_area = area
            best_box = (start_x, start_y, bw, bh)

    return best_box


def _largest_face_with_haar(gray_frame: Any, face_cascade: Any) -> Optional[tuple[int, int, int, int]]:
    faces = face_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=5)
    if len(faces) == 0:
        return None
    return cast(tuple[int, int, int, int], max(faces, key=lambda f: f[2] * f[3]))


def _is_looking_from_face_roi(face_roi_gray: Any, face_width: int, eye_cascade: Any) -> bool:
    eyes = eye_cascade.detectMultiScale(face_roi_gray, scaleFactor=1.1, minNeighbors=8)
    if len(eyes) < 2:
        return False

    largest_eyes = sorted(eyes, key=lambda e: e[2] * e[3], reverse=True)[:2]
    eye_centers_x = [ex + (ew / 2.0) for ex, _ey, ew, _eh in largest_eyes]
    eyes_mid_x = sum(eye_centers_x) / len(eye_centers_x)
    normalized_mid_x = eyes_mid_x / max(float(face_width), 1.0)

    return 0.35 <= normalized_mid_x <= 0.65


def _analyze_eye_contact_opencv(video_path: str) -> float:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.0

    eye_cascade = cv2.CascadeClassifier(_haar_file_path("haarcascade_eye.xml"))
    face_cascade = cv2.CascadeClassifier(
        _haar_file_path("haarcascade_frontalface_default.xml")
    )
    face_dnn = _load_face_dnn()

    total_frames = 0
    looking_frames = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        total_frames += 1
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        face_box = None
        if face_dnn is not None:
            face_box = _largest_face_with_dnn(frame, face_dnn)
        if face_box is None:
            face_box = _largest_face_with_haar(gray, face_cascade)

        if face_box is None:
            continue

        x, y, w, h = face_box
        face_roi_gray = gray[y:y + h, x:x + w]
        if face_roi_gray.size == 0:
            continue

        if _is_looking_from_face_roi(face_roi_gray, w, eye_cascade):
            looking_frames += 1

    cap.release()

    if total_frames == 0:
        return 0.0

    return round((looking_frames / total_frames) * 100.0, 2)


def _analyze_eye_contact_mediapipe(video_path: str) -> float:
    cap = cv2.VideoCapture(video_path)
    total_frames = 0
    looking_frames = 0

    with mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
    ) as face_mesh:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            total_frames += 1
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb_frame)

            if results.multi_face_landmarks:
                face_landmarks = results.multi_face_landmarks[0]
                nose = face_landmarks.landmark[1]

                if 0.4 < nose.x < 0.6:
                    looking_frames += 1

    cap.release()

    if total_frames == 0:
        return 0.0

    return round((looking_frames / total_frames) * 100.0, 2)


def analyze_eye_contact(video_path: str) -> float:
    if mp_face_mesh is not None:
        try:
            return _analyze_eye_contact_mediapipe(video_path)
        except Exception as err:
            print(f"[WARN] MediaPipe eye analysis failed, using OpenCV fallback: {err}")

    print("[INFO] Using OpenCV-based eye contact analysis")
    return _analyze_eye_contact_opencv(video_path)