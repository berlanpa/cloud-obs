import torch
import numpy as np
from ultralytics import YOLO
from typing import List, Dict, Tuple
from loguru import logger


class YOLODetector:
    """YOLO object detector with tracking and motion estimation."""

    def __init__(self, model_name: str = 'yolov8n', confidence: float = 0.5, iou: float = 0.45):
        self.model = YOLO(f'{model_name}.pt')
        self.confidence = confidence
        self.iou = iou
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'

        # Track centroids for motion estimation
        self.prev_centroids: Dict[str, Dict[str, Tuple[float, float]]] = {}

        logger.info(f"YOLO initialized with {model_name} on {self.device}")

    def detect(self, frame: np.ndarray, cam_id: str) -> Dict:
        """
        Run detection on a frame.

        Returns:
            Dictionary with detections, counts, motion scores, etc.
        """
        results = self.model(
            frame,
            conf=self.confidence,
            iou=self.iou,
            device=self.device,
            verbose=False
        )[0]

        detections = []
        object_counts = {}
        centroids = {}

        boxes = results.boxes
        if boxes is not None and len(boxes) > 0:
            for i, box in enumerate(boxes):
                cls_id = int(box.cls[0])
                cls_name = results.names[cls_id]
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].cpu().numpy()

                # Calculate centroid
                cx = (xyxy[0] + xyxy[2]) / 2
                cy = (xyxy[1] + xyxy[3]) / 2

                detection = {
                    'class': cls_name,
                    'confidence': conf,
                    'bbox': [float(x) for x in xyxy],
                    'centroid': [float(cx), float(cy)],
                    'area': float((xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1]))
                }

                detections.append(detection)
                object_counts[cls_name] = object_counts.get(cls_name, 0) + 1

                # Store centroid for motion tracking
                det_id = f"{cls_name}_{i}"
                centroids[det_id] = (cx, cy)

        # Calculate motion score
        motion_score = self._calculate_motion(cam_id, centroids)

        # Calculate occupancy (percentage of frame covered by bboxes)
        total_area = sum(d['area'] for d in detections)
        frame_area = frame.shape[0] * frame.shape[1]
        occupancy = min(1.0, total_area / frame_area) if frame_area > 0 else 0.0

        # Find faces and calculate max confidence
        face_detections = [d for d in detections if 'person' in d['class'].lower() or 'face' in d['class'].lower()]
        face_conf_max = max([d['confidence'] for d in face_detections], default=0.0)
        face_area = sum(d['area'] for d in face_detections) / frame_area if frame_area > 0 else 0.0

        # Update previous centroids
        self.prev_centroids[cam_id] = centroids

        return {
            'detections': detections,
            'object_counts': object_counts,
            'motion_score': motion_score,
            'bbox_occupancy': occupancy,
            'face_conf_max': face_conf_max,
            'face_area': face_area,
            'total_objects': len(detections)
        }

    def _calculate_motion(self, cam_id: str, current_centroids: Dict) -> float:
        """Calculate motion score based on centroid displacement."""
        if cam_id not in self.prev_centroids or not self.prev_centroids[cam_id]:
            return 0.0

        prev = self.prev_centroids[cam_id]

        # Simple approach: calculate average displacement
        displacements = []
        for obj_id, (cx, cy) in current_centroids.items():
            if obj_id in prev:
                px, py = prev[obj_id]
                dist = np.sqrt((cx - px)**2 + (cy - py)**2)
                displacements.append(dist)

        if not displacements:
            return 0.0

        # Normalize to 0-1 range (assuming max displacement of 100 pixels is "high")
        avg_displacement = np.mean(displacements)
        motion_score = min(1.0, avg_displacement / 100.0)

        return float(motion_score)

    def batch_detect(self, frames: List[Tuple[np.ndarray, str]]) -> List[Dict]:
        """
        Batch detection for multiple frames from different cameras.

        Args:
            frames: List of (frame, cam_id) tuples

        Returns:
            List of detection results, one per frame
        """
        if not frames:
            return []

        # Extract frames and cam_ids
        frame_array = [f[0] for f in frames]
        cam_ids = [f[1] for f in frames]

        # Batch inference
        results_batch = self.model(
            frame_array,
            conf=self.confidence,
            iou=self.iou,
            device=self.device,
            verbose=False
        )

        # Process each result
        outputs = []
        for results, cam_id in zip(results_batch, cam_ids):
            # Reuse single-frame detection logic
            detections = []
            object_counts = {}
            centroids = {}

            boxes = results.boxes
            if boxes is not None and len(boxes) > 0:
                for i, box in enumerate(boxes):
                    cls_id = int(box.cls[0])
                    cls_name = results.names[cls_id]
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy()

                    cx = (xyxy[0] + xyxy[2]) / 2
                    cy = (xyxy[1] + xyxy[3]) / 2

                    detection = {
                        'class': cls_name,
                        'confidence': conf,
                        'bbox': [float(x) for x in xyxy],
                        'centroid': [float(cx), float(cy)],
                        'area': float((xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1]))
                    }

                    detections.append(detection)
                    object_counts[cls_name] = object_counts.get(cls_name, 0) + 1
                    centroids[f"{cls_name}_{i}"] = (cx, cy)

            motion_score = self._calculate_motion(cam_id, centroids)

            frame_h, frame_w = frame_array[0].shape[:2]
            total_area = sum(d['area'] for d in detections)
            frame_area = frame_h * frame_w
            occupancy = min(1.0, total_area / frame_area) if frame_area > 0 else 0.0

            face_detections = [d for d in detections if 'person' in d['class'].lower()]
            face_conf_max = max([d['confidence'] for d in face_detections], default=0.0)
            face_area = sum(d['area'] for d in face_detections) / frame_area if frame_area > 0 else 0.0

            self.prev_centroids[cam_id] = centroids

            outputs.append({
                'detections': detections,
                'object_counts': object_counts,
                'motion_score': motion_score,
                'bbox_occupancy': occupancy,
                'face_conf_max': face_conf_max,
                'face_area': face_area,
                'total_objects': len(detections)
            })

        return outputs
