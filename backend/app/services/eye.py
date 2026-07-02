from typing import Any, cast
import cv2
import mediapipe as mp

mp_solutions = cast(Any, getattr(mp, "solutions", None))
mp_face_mesh = cast(Any, getattr(mp_solutions, "face_mesh", None))

LEFT_EYE_LEFT = 33
LEFT_EYE_RIGHT = 133
LEFT_IRIS = 468

RIGHT_EYE_LEFT = 362
RIGHT_EYE_RIGHT = 263
RIGHT_IRIS = 473


def _analyze_eye_contact_mediapipe(video_path: str) -> float:
    cap = cv2.VideoCapture(video_path)

    total_frames = 0
    looking_frames = 0
    frame_idx = 0
    frame_skip = 5

    if mp_face_mesh is None:
        return 0.0

    with mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as face_mesh:

        while cap.isOpened():
            ret, frame = cap.read()

            if not ret:
                break

            frame_idx += 1

            if frame_idx % frame_skip != 0:
                continue

            total_frames += 1

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb)

            if not results.multi_face_landmarks:
                continue

            landmarks = results.multi_face_landmarks[0].landmark

            try:
                left_eye_width = (
                    landmarks[LEFT_EYE_RIGHT].x
                    - landmarks[LEFT_EYE_LEFT].x
                )

                right_eye_width = (
                    landmarks[RIGHT_EYE_LEFT].x
                    - landmarks[RIGHT_EYE_RIGHT].x
                )

                if abs(left_eye_width) < 1e-6 or abs(right_eye_width) < 1e-6:
                    continue

                left_ratio = (
                    landmarks[LEFT_IRIS].x
                    - landmarks[LEFT_EYE_LEFT].x
                ) / left_eye_width

                right_ratio = (
                    landmarks[RIGHT_IRIS].x
                    - landmarks[RIGHT_EYE_RIGHT].x
                ) / right_eye_width

                if (
                    0.35 <= left_ratio <= 0.65
                    and
                    0.35 <= right_ratio <= 0.65
                ):
                    looking_frames += 1

            except IndexError:
                continue

    cap.release()

    if total_frames == 0:
        return 0.0

    return round(
        (looking_frames / total_frames) * 100.0,
        2,
    )


def analyze_eye_contact(video_path: str) -> float:
    if mp_face_mesh is not None:
        try:
            return _analyze_eye_contact_mediapipe(video_path)
        except Exception as err:
            print(f"[WARN] MediaPipe eye analysis failed: {err}")
    return 0.0