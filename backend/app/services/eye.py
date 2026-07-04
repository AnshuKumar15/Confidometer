import os
import cv2
import mediapipe as mp
import numpy as np

# Load MediaPipe Tasks options
BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Resolve model path relative to file location
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(SERVICES_DIR)
MODEL_PATH = os.path.join(APP_DIR, "resources", "face_landmarker.task")

# ── Iris landmarks indices ──
LEFT_EYE_LEFT = 33
LEFT_EYE_RIGHT = 133
LEFT_IRIS = 468

RIGHT_EYE_LEFT = 362
RIGHT_EYE_RIGHT = 263
RIGHT_IRIS = 473

# ── Vertical eyelid landmarks indices ──
LEFT_EYE_TOP = 159
LEFT_EYE_BOTTOM = 145

RIGHT_EYE_TOP = 386
RIGHT_EYE_BOTTOM = 374

# ── Head pose estimation landmarks indices ──
# nose tip, chin, left eye outer, right eye outer, left mouth corner, right mouth corner
POSE_LANDMARK_IDS = [1, 199, 33, 263, 61, 291]

# 3D model points for a generic face, matching image coordinate system (Y goes down)
_MODEL_POINTS = np.array([
    (0.0, 0.0, 0.0),        # Nose tip
    (0.0, 63.6, -12.5),     # Chin (below nose => positive Y)
    (-43.3, -32.7, -26.0),  # Left eye outer corner (above nose => negative Y)
    (43.3, -32.7, -26.0),   # Right eye outer corner (above nose => negative Y)
    (-28.9, 28.9, -24.1),   # Left mouth corner (below nose => positive Y)
    (28.9, 28.9, -24.1),    # Right mouth corner (below nose => positive Y)
], dtype=np.float64)


def _estimate_head_pose(landmarks: list, frame_w: int, frame_h: int) -> tuple[float, float]:
    """
    Estimate head yaw and pitch using solvePnP.
    Returns (yaw_degrees, pitch_degrees).
    """
    image_points = np.array([
        (landmarks[idx].x * frame_w, landmarks[idx].y * frame_h)
        for idx in POSE_LANDMARK_IDS
    ], dtype=np.float64)

    focal_length = frame_w
    center = (frame_w / 2.0, frame_h / 2.0)
    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1), dtype=np.float64)

    success, rotation_vector, _ = cv2.solvePnP(
        _MODEL_POINTS, image_points, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not success:
        return 0.0, 0.0

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)

    # Decompose rotation matrix to Euler angles
    sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
    if sy > 1e-6:
        pitch = np.degrees(np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2]))
        yaw = np.degrees(np.arctan2(-rotation_matrix[2, 0], sy))
    else:
        pitch = np.degrees(np.arctan2(-rotation_matrix[1, 2], rotation_matrix[1, 1]))
        yaw = np.degrees(np.arctan2(-rotation_matrix[2, 0], sy))

    return float(yaw), float(pitch)


def _analyze_eye_contact_mediapipe(video_path: str) -> float:
    cap = cv2.VideoCapture(video_path)

    total_frames = 0
    looking_frames = 0
    frame_idx = 0
    frame_skip = 3  # Better temporal resolution

    if not os.path.exists(MODEL_PATH):
        print(f"[ERROR] Face landmarker model not found at {MODEL_PATH}")
        return 0.0

    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=VisionRunningMode.IMAGE
    )

    with FaceLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()

            if not ret:
                break

            frame_idx += 1

            if frame_idx % frame_skip != 0:
                continue

            total_frames += 1
            frame_h, frame_w = frame.shape[:2]

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect(mp_image)

            # No face detected → counts as NOT looking
            if not result.face_landmarks:
                continue

            landmarks = result.face_landmarks[0]

            try:
                # ── 1. Head pose check ──
                yaw, pitch = _estimate_head_pose(landmarks, frame_w, frame_h)

                # If head is turned too far, not looking at camera
                # Relaxed thresholds for typical webcam interview angles
                if abs(yaw) > 20.0 or abs(pitch) > 15.0:
                    continue

                # ── 2. Horizontal iris ratio ──
                # Use abs() to handle mirrored/flipped webcam video correctly
                left_eye_width = abs(landmarks[LEFT_EYE_RIGHT].x - landmarks[LEFT_EYE_LEFT].x)
                right_eye_width = abs(landmarks[RIGHT_EYE_LEFT].x - landmarks[RIGHT_EYE_RIGHT].x)

                if left_eye_width < 1e-6 or right_eye_width < 1e-6:
                    continue

                left_h_ratio = abs(landmarks[LEFT_IRIS].x - landmarks[LEFT_EYE_LEFT].x) / left_eye_width
                right_h_ratio = abs(landmarks[RIGHT_IRIS].x - landmarks[RIGHT_EYE_RIGHT].x) / right_eye_width

                # ── 3. Vertical iris ratio ──
                left_eye_height = abs(landmarks[LEFT_EYE_BOTTOM].y - landmarks[LEFT_EYE_TOP].y)
                right_eye_height = abs(landmarks[RIGHT_EYE_BOTTOM].y - landmarks[RIGHT_EYE_TOP].y)

                if left_eye_height < 1e-6 or right_eye_height < 1e-6:
                    continue

                left_v_ratio = abs(landmarks[LEFT_IRIS].y - landmarks[LEFT_EYE_TOP].y) / left_eye_height
                right_v_ratio = abs(landmarks[RIGHT_IRIS].y - landmarks[RIGHT_EYE_TOP].y) / right_eye_height

                # ── 4. Combined check: both horizontal AND vertical must be centered ──
                h_centered = (0.30 <= left_h_ratio <= 0.70) and (0.30 <= right_h_ratio <= 0.70)
                v_centered = (0.25 <= left_v_ratio <= 0.75) and (0.25 <= right_v_ratio <= 0.75)

                if h_centered and v_centered:
                    looking_frames += 1

            except (IndexError, Exception):
                continue

    cap.release()

    if total_frames == 0:
        return 0.0

    score = round(
        (looking_frames / total_frames) * 100.0,
        2,
    )
    print(f"[DEBUG] Eye contact: {looking_frames}/{total_frames} frames looking = {score}%")
    return score


def analyze_eye_contact(video_path: str) -> float:
    try:
        return _analyze_eye_contact_mediapipe(video_path)
    except Exception as err:
        print(f"[WARN] MediaPipe face landmarker tasks analysis failed: {err}")
    return 0.0