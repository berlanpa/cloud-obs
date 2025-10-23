"""
Enhanced YOLO detector with YOLOv11 and TensorRT support.
Provides 5-10x faster inference compared to YOLOv8 PyTorch.
"""

import torch
import numpy as np
from ultralytics import YOLO
from typing import List, Dict, Tuple, Optional
from loguru import logger
from pathlib import Path
import time


class YOLODetectorV11:
    """
    Enhanced YOLO object detector with:
    - YOLOv11 support (latest, fastest)
    - TensorRT optimization
    - Batch processing for multiple cameras
    - Velocity/motion tracking
    """

    def __init__(
        self,
        model_name: str = 'yolo11n',
        use_tensorrt: bool = True,
        confidence: float = 0.5,
        iou: float = 0.45,
        engine_path: Optional[str] = None
    ):
        """
        Initialize YOLO detector.

        Args:
            model_name: Model variant (yolo11n, yolo11s, yolo11m, yolo11l)
            use_tensorrt: Use TensorRT engine for maximum speed
            confidence: Detection confidence threshold
            iou: IOU threshold for NMS
            engine_path: Path to pre-built TensorRT engine
        """
        self.model_name = model_name
        self.confidence = confidence
        self.iou = iou
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'

        # Track centroids and velocities for motion estimation
        self.prev_centroids: Dict[str, Dict[str, Tuple[float, float]]] = {}
        self.prev_timestamp: Dict[str, float] = {}

        # Load model
        if use_tensorrt and self.device == 'cuda':
            self.model = self._load_tensorrt_model(model_name, engine_path)
        else:
            self.model = self._load_pytorch_model(model_name)

        logger.info(f"YOLO {model_name} initialized on {self.device} (TensorRT: {use_tensorrt})")

    def _load_pytorch_model(self, model_name: str) -> YOLO:
        """Load standard PyTorch YOLO model."""
        try:
            # Try loading pre-downloaded model
            model_path = f"{model_name}.pt"
            model = YOLO(model_path)
            logger.info(f"Loaded PyTorch model: {model_path}")
            return model
        except Exception as e:
            logger.warning(f"Failed to load {model_name}.pt, downloading: {e}")
            model = YOLO(model_name)
            return model

    def _load_tensorrt_model(self, model_name: str, engine_path: Optional[str]) -> YOLO:
        """Load or build TensorRT engine for maximum performance."""
        if engine_path and Path(engine_path).exists():
            logger.info(f"Loading existing TensorRT engine: {engine_path}")
            return YOLO(engine_path)

        # Check for default engine location
        default_engine = f"/models/{model_name}.engine"
        if Path(default_engine).exists():
            logger.info(f"Loading TensorRT engine: {default_engine}")
            return YOLO(default_engine)

        # Export to TensorRT if not found
        logger.info(f"TensorRT engine not found, building from {model_name}.pt...")
        try:
            pt_model = YOLO(f"{model_name}.pt")

            # Export to TensorRT
            export_path = pt_model.export(
                format="engine",
                half=True,  # FP16 for speed
                device=0,
                workspace=4,  # 4GB workspace
                simplify=True,
                verbose=False
            )

            logger.info(f"TensorRT engine built: {export_path}")
            return YOLO(export_path)

        except Exception as e:
            logger.error(f"TensorRT export failed: {e}, falling back to PyTorch")
            return self._load_pytorch_model(model_name)

    def detect(self, frame: np.ndarray, cam_id: str, timestamp: Optional[float] = None) -> Dict:
        """
        Run detection on a single frame.

        Args:
            frame: RGB frame as numpy array (H, W, 3)
            cam_id: Camera identifier
            timestamp: Frame timestamp for velocity calculation

        Returns:
            Dictionary with detections, counts, motion, velocities, etc.
        """
        if timestamp is None:
            timestamp = time.time()

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
        velocities = {}

        boxes = results.boxes
        if boxes is not None and len(boxes) > 0:
            for i, box in enumerate(boxes):
                cls_id = int(box.cls[0])
                cls_name = results.names[cls_id]
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].cpu().numpy()

                # Calculate centroid
                cx = float((xyxy[0] + xyxy[2]) / 2)
                cy = float((xyxy[1] + xyxy[3]) / 2)
                area = float((xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1]))

                # Calculate velocity if we have previous data
                det_id = f"{cls_name}_{i}"
                velocity = self._calculate_velocity(cam_id, det_id, (cx, cy), timestamp)

                detection = {
                    'class': cls_name,
                    'confidence': conf,
                    'bbox': [float(x) for x in xyxy],
                    'centroid': [cx, cy],
                    'area': area,
                    'velocity': velocity  # pixels/second
                }

                detections.append(detection)
                object_counts[cls_name] = object_counts.get(cls_name, 0) + 1
                centroids[det_id] = (cx, cy)
                velocities[det_id] = velocity

        # Calculate overall motion score
        motion_score = self._calculate_motion_score(velocities)

        # Calculate occupancy
        total_area = sum(d['area'] for d in detections)
        frame_area = frame.shape[0] * frame.shape[1]
        occupancy = min(1.0, total_area / frame_area) if frame_area > 0 else 0.0

        # Find faces/people and calculate metrics
        person_detections = [d for d in detections if 'person' in d['class'].lower()]
        face_conf_max = max([d['confidence'] for d in person_detections], default=0.0)
        face_area = sum(d['area'] for d in person_detections) / frame_area if frame_area > 0 else 0.0

        # Update tracking state
        self.prev_centroids[cam_id] = centroids
        self.prev_timestamp[cam_id] = timestamp

        return {
            'detections': detections,
            'object_counts': object_counts,
            'motion_score': motion_score,
            'bbox_occupancy': occupancy,
            'face_conf_max': face_conf_max,
            'face_area': face_area,
            'total_objects': len(detections),
            'avg_velocity': np.mean(list(velocities.values())) if velocities else 0.0,
            'max_velocity': max(velocities.values(), default=0.0)
        }

    def _calculate_velocity(
        self,
        cam_id: str,
        det_id: str,
        current_pos: Tuple[float, float],
        current_time: float
    ) -> float:
        """Calculate velocity in pixels/second."""
        if cam_id not in self.prev_centroids or det_id not in self.prev_centroids[cam_id]:
            return 0.0

        if cam_id not in self.prev_timestamp:
            return 0.0

        prev_pos = self.prev_centroids[cam_id][det_id]
        dt = current_time - self.prev_timestamp[cam_id]

        if dt <= 0:
            return 0.0

        # Calculate displacement
        dx = current_pos[0] - prev_pos[0]
        dy = current_pos[1] - prev_pos[1]
        distance = np.sqrt(dx**2 + dy**2)

        velocity = distance / dt
        return float(velocity)

    def _calculate_motion_score(self, velocities: Dict[str, float]) -> float:
        """
        Calculate normalized motion score from velocities.

        High velocity = high motion score.
        Normalized to 0-1 range.
        """
        if not velocities:
            return 0.0

        # Average velocity
        avg_vel = np.mean(list(velocities.values()))

        # Normalize: assume 50 pixels/sec is "moderate" motion
        # 100+ pixels/sec is high motion
        motion_score = min(1.0, avg_vel / 100.0)

        return float(motion_score)

    def batch_detect(
        self,
        frames: List[Tuple[np.ndarray, str, float]]
    ) -> List[Dict]:
        """
        Batch detection for multiple frames (5 cameras).

        Args:
            frames: List of (frame, cam_id, timestamp) tuples

        Returns:
            List of detection results, one per frame
        """
        if not frames:
            return []

        # Extract components
        frame_array = [f[0] for f in frames]
        cam_ids = [f[1] for f in frames]
        timestamps = [f[2] for f in frames]

        # Batch inference (much faster than sequential)
        start_time = time.time()
        results_batch = self.model(
            frame_array,
            conf=self.confidence,
            iou=self.iou,
            device=self.device,
            verbose=False
        )
        inference_time = (time.time() - start_time) * 1000

        logger.debug(f"Batch YOLO inference ({len(frames)} frames): {inference_time:.1f}ms")

        # Process each result
        outputs = []
        for results, cam_id, timestamp in zip(results_batch, cam_ids, timestamps):
            detections = []
            object_counts = {}
            centroids = {}
            velocities = {}

            boxes = results.boxes
            if boxes is not None and len(boxes) > 0:
                for i, box in enumerate(boxes):
                    cls_id = int(box.cls[0])
                    cls_name = results.names[cls_id]
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy()

                    cx = float((xyxy[0] + xyxy[2]) / 2)
                    cy = float((xyxy[1] + xyxy[3]) / 2)
                    area = float((xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1]))

                    det_id = f"{cls_name}_{i}"
                    velocity = self._calculate_velocity(cam_id, det_id, (cx, cy), timestamp)

                    detection = {
                        'class': cls_name,
                        'confidence': conf,
                        'bbox': [float(x) for x in xyxy],
                        'centroid': [cx, cy],
                        'area': area,
                        'velocity': velocity
                    }

                    detections.append(detection)
                    object_counts[cls_name] = object_counts.get(cls_name, 0) + 1
                    centroids[det_id] = (cx, cy)
                    velocities[det_id] = velocity

            motion_score = self._calculate_motion_score(velocities)

            frame_h, frame_w = frame_array[0].shape[:2]
            total_area = sum(d['area'] for d in detections)
            frame_area = frame_h * frame_w
            occupancy = min(1.0, total_area / frame_area) if frame_area > 0 else 0.0

            person_detections = [d for d in detections if 'person' in d['class'].lower()]
            face_conf_max = max([d['confidence'] for d in person_detections], default=0.0)
            face_area = sum(d['area'] for d in person_detections) / frame_area if frame_area > 0 else 0.0

            self.prev_centroids[cam_id] = centroids
            self.prev_timestamp[cam_id] = timestamp

            outputs.append({
                'detections': detections,
                'object_counts': object_counts,
                'motion_score': motion_score,
                'bbox_occupancy': occupancy,
                'face_conf_max': face_conf_max,
                'face_area': face_area,
                'total_objects': len(detections),
                'avg_velocity': np.mean(list(velocities.values())) if velocities else 0.0,
                'max_velocity': max(velocities.values(), default=0.0)
            })

        return outputs

    def export_tensorrt(self, output_path: str = "/models", workspace: int = 4):
        """
        Export current model to TensorRT engine.

        Args:
            output_path: Directory to save engine
            workspace: GPU workspace in GB
        """
        if isinstance(self.model, str) and self.model.endswith('.engine'):
            logger.info("Model is already a TensorRT engine")
            return

        logger.info(f"Exporting {self.model_name} to TensorRT...")

        export_path = self.model.export(
            format="engine",
            half=True,
            device=0,
            workspace=workspace,
            simplify=True,
            verbose=True
        )

        logger.info(f"TensorRT engine saved: {export_path}")
        return export_path
