from typing import Any, Optional, cast
import os


import cv2
import mediapipe as mp
import numpy as np

# Load MediaPipe Tasks options
BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Resolve model path relative to file location
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(SERVICES_DIR)
MODEL_PATH = os.path.join(APP_DIR, "resources", "pose_landmarker.task")


def _largest_face(gray_frame: Any, face_cascade: Any) -> Optional[tuple[int, int, int, int]]:
    faces = face_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=5)
    if len(faces) == 0:
        return None
    return cast(tuple[int, int, int, int], max(faces, key=lambda f: f[2] * f[3]))


from app.utils.scoring_utils import bell_curve_score



def _gesture_from_motion(video_path: str) -> float:
    """OpenCV-based fallback: frame-differencing in estimated upper body ROI."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.0

    # Use os.path for cross-platform compatibility
    cv2_data_dir = os.path.join(os.path.dirname(cv2.__file__), "data")
    cascade_path = os.path.join(cv2_data_dir, "haarcascade_frontalface_default.xml")
    face_cascade = cv2.CascadeClassifier(cascade_path)

    previous_roi = None
    analyzed_frames = 0
    active_frames = 0
    frame_idx = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        if frame_idx % 2 != 0:  # Skip every other frame for performance
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        face = _largest_face(gray, face_cascade)
        if face is None:
            h_total, w_total = gray.shape
            roi_x1 = int(w_total * 0.2)
            roi_x2 = int(w_total * 0.8)
            roi_y1 = int(h_total * 0.25)
            roi_y2 = int(h_total * 0.8)
        else:
            x, y, w, h = face
            roi_x1 = max(0, x - int(0.6 * w))
            roi_x2 = min(gray.shape[1], x + w + int(0.6 * w))
            roi_y1 = min(gray.shape[0] - 1, y + h)
            roi_y2 = min(gray.shape[0], y + h + int(2.4 * h))

        if roi_y2 <= roi_y1 or roi_x2 <= roi_x1:
            continue

        roi = gray[roi_y1:roi_y2, roi_x1:roi_x2]
        if roi.size == 0:
            continue

        roi = cv2.GaussianBlur(roi, (5, 5), 0)
        roi = cv2.resize(roi, (160, 160))

        if previous_roi is not None:
            diff = cv2.absdiff(roi, previous_roi)
            _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
            motion_ratio = float(np.count_nonzero(thresh)) / float(thresh.size)

            analyzed_frames += 1
            if motion_ratio >= 0.01:
                active_frames += 1

        previous_roi = roi

    cap.release()

    if analyzed_frames == 0:
        return 0.0

    activity_ratio = active_frames / analyzed_frames
    return round(bell_curve_score(activity_ratio, ideal=0.50, width=0.35), 2)


def _gesture_from_mediapipe(video_path: str) -> float:
    """MediaPipe Pose-based gesture analysis tracking wrists + elbows."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.0

    # Track 4 upper-body landmark indices
    landmark_ids = {
        "left_wrist": 15,
        "right_wrist": 16,
        "left_elbow": 13,
        "right_elbow": 14,
    }

    prev_positions: dict[str, np.ndarray | None] = {k: None for k in landmark_ids}
    per_frame_movements: list[float] = []
    total_frames = 0
    frame_idx = 0

    if not os.path.exists(MODEL_PATH):
        print(f"[ERROR] Pose landmarker model not found at {MODEL_PATH}")
        return 0.0

    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=VisionRunningMode.IMAGE
    )

    with PoseLandmarker.create_from_options(options) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % 6 != 0:  # Skip to process 5 FPS on 30 FPS video
                continue

            total_frames += 1
            
            # Resize frame to 320px width to speed up CPU inference dramatically
            h, w = frame.shape[:2]
            target_w = 320
            target_h = int(h * (target_w / w))
            resized_frame = cv2.resize(frame, (target_w, target_h))
            
            rgb = cv2.cvtColor(resized_frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = pose.detect(mp_image)

            if not result.pose_landmarks:
                per_frame_movements.append(0.0)
                continue

            landmarks = result.pose_landmarks[0]
            frame_movement = 0.0
            visible_count = 0

            for name, lm_id in landmark_ids.items():
                try:
                    lm = landmarks[lm_id]
                    vis = getattr(lm, "visibility", 0.0)

                    if vis > 0.5:
                        current_pos = np.array([lm.x, lm.y])
                        if prev_positions[name] is not None:
                            # Divide delta by 3.0 to scale it relative to the 3x larger time step
                            delta = float(np.linalg.norm(current_pos - prev_positions[name])) / 3.0
                            frame_movement += delta
                            visible_count += 1
                        prev_positions[name] = current_pos
                    else:
                        prev_positions[name] = None
                except IndexError:
                    continue

            # Average movement per visible landmark in this frame
            if visible_count > 0:
                per_frame_movements.append(frame_movement / visible_count)
            else:
                per_frame_movements.append(0.0)

    cap.release()

    if total_frames == 0 or len(per_frame_movements) == 0:
        return 0.0

    avg_movement = float(np.mean(per_frame_movements))

    # Normalize score
    score = bell_curve_score(avg_movement, ideal=0.015, width=0.018)
    print(f"[DEBUG] Gesture avg movement/frame: {avg_movement:.5f} => score: {score:.1f}")
    return round(max(0.0, min(100.0, score)), 2)


def analyze_gesture(video_path: str) -> float:
    try:
        return _gesture_from_mediapipe(video_path)
    except Exception as err:
        print(f"[WARN] MediaPipe pose tasks analysis failed, using OpenCV fallback: {err}")

    print("[INFO] Using OpenCV-based gesture analysis")
    return _gesture_from_motion(video_path)