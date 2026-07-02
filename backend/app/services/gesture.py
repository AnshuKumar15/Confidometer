from typing import Any, Optional, cast

import cv2
import mediapipe as mp
import numpy as np

mp_solutions = cast(Any, getattr(mp, "solutions", None))
mp_pose = cast(Any, getattr(mp_solutions, "pose", None))


def _largest_face(gray_frame: Any, face_cascade: Any) -> Optional[tuple[int, int, int, int]]:
    faces = face_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=5)
    if len(faces) == 0:
        return None
    return cast(tuple[int, int, int, int], max(faces, key=lambda f: f[2] * f[3]))


def _gesture_from_motion(video_path: str) -> float:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.0

    cv2_base_dir = cv2.__file__.rsplit("\\", 1)[0]
    face_cascade = cv2.CascadeClassifier(
        cv2_base_dir + "\\data\\haarcascade_frontalface_default.xml"
    )

    previous_roi = None
    analyzed_frames = 0
    active_frames = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        face = _largest_face(gray, face_cascade)
        if face is None:
            # Fallback ROI for cases where face detector misses frames.
            h_total, w_total = gray.shape
            roi_x1 = int(w_total * 0.2)
            roi_x2 = int(w_total * 0.8)
            roi_y1 = int(h_total * 0.25)
            roi_y2 = int(h_total * 0.8)
        else:
            x, y, w, h = face

            # Estimate upper-body ROI from face position to track hand/arm movement.
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

    # Percentage of frames with meaningful gesture activity.
    return round((active_frames / analyzed_frames) * 100.0, 2)


def _gesture_from_mediapipe(video_path: str) -> float:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.0

    prev_left = None
    prev_right = None
    movement = 0.0
    total_frames = 0
    valid_frames = 0

    with mp_pose.Pose(static_image_mode=False) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            total_frames += 1
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb)

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark

                # Check visibility/confidence before using wrist landmarks
                left_lm = landmarks[mp_pose.PoseLandmark.LEFT_WRIST]
                right_lm = landmarks[mp_pose.PoseLandmark.RIGHT_WRIST]

                left_vis = getattr(left_lm, "visibility", 0.0)
                right_vis = getattr(right_lm, "visibility", 0.0)

                left_hand = np.array([left_lm.x, left_lm.y])
                right_hand = np.array([right_lm.x, right_lm.y])

                frame_had_visible = False

                if left_vis > 0.5:
                    frame_had_visible = True
                    if prev_left is not None:
                        movement += float(np.linalg.norm(left_hand - prev_left))
                    prev_left = left_hand
                else:
                    prev_left = None

                if right_vis > 0.5:
                    frame_had_visible = True
                    if prev_right is not None:
                        movement += float(np.linalg.norm(right_hand - prev_right))
                    prev_right = right_hand
                else:
                    prev_right = None

                if frame_had_visible:
                    valid_frames += 1

    cap.release()

    if total_frames == 0:
        return 0.0

    return round((movement / total_frames) * 100.0, 2)


def analyze_gesture(video_path: str) -> float:
    if mp_pose is not None:
        try:
            return _gesture_from_mediapipe(video_path)
        except Exception as err:
            print(f"[WARN] MediaPipe gesture analysis failed, using OpenCV fallback: {err}")

    print("[INFO] Using OpenCV-based gesture analysis")
    return _gesture_from_motion(video_path)