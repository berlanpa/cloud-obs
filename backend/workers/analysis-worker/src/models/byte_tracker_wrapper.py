"""
ByteTrack wrapper for multi-object tracking.
Provides stable object IDs and continuity features for camera ranking.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from loguru import logger
import argparse

# ByteTrack imports
try:
    import sys
    sys.path.append('/Users/nadavshanun/Downloads/AI-OBS/workers/tracking/ByteTrack')

    from yolox.tracker.byte_tracker import BYTETracker, STrack
    BYTETRACK_AVAILABLE = True
except ImportError as e:
    logger.warning(f"ByteTrack not available: {e}")
    BYTETRACK_AVAILABLE = False


class ByteTrackWrapper:
    """
    Wrapper around ByteTrack for stable object tracking.

    Features:
    - Assigns stable IDs to detected objects
    - Tracks velocity and trajectory
    - Provides continuity features for ranking
    - Identifies "main subject" across frames
    """

    def __init__(
        self,
        track_thresh: float = 0.5,
        track_buffer: int = 30,
        match_thresh: float = 0.8,
        frame_rate: int = 10
    ):
        """
        Initialize ByteTrack.

        Args:
            track_thresh: Detection confidence threshold
            track_buffer: Frames to keep lost tracks
            match_thresh: IOU threshold for matching
            frame_rate: Processing frame rate
        """
        if not BYTETRACK_AVAILABLE:
            logger.error("ByteTrack not available, tracking disabled")
            self.tracker = None
            return

        # Create args namespace for ByteTrack
        self.args = argparse.Namespace(
            track_thresh=track_thresh,
            track_buffer=track_buffer,
            match_thresh=match_thresh,
            mot20=False
        )

        self.tracker = BYTETracker(self.args, frame_rate=frame_rate)
        self.frame_rate = frame_rate

        # Track main subject across cameras
        self.main_subject_id: Optional[int] = None
        self.main_subject_camera: Optional[str] = None

        # Per-camera trackers
        self.camera_trackers: Dict[str, BYTETracker] = {}

        logger.info(f"ByteTrack initialized (thresh={track_thresh}, buffer={track_buffer})")

    def update(
        self,
        cam_id: str,
        yolo_results: Dict,
        img_info: Tuple[int, int],
        img_size: Tuple[int, int]
    ) -> Dict:
        """
        Update tracker with new detections from a camera.

        Args:
            cam_id: Camera identifier
            yolo_results: YOLO detection results
            img_info: (height, width) of original image
            img_size: (height, width) of input size to YOLO

        Returns:
            Dictionary with tracked objects and features
        """
        if self.tracker is None:
            return self._fallback_response()

        # Get or create tracker for this camera
        if cam_id not in self.camera_trackers:
            self.camera_trackers[cam_id] = BYTETracker(self.args, frame_rate=self.frame_rate)

        tracker = self.camera_trackers[cam_id]

        # Convert YOLO detections to ByteTrack format
        # ByteTrack expects: [x1, y1, x2, y2, conf, class_id] or [x1, y1, x2, y2, conf]
        detections = yolo_results.get('detections', [])

        if not detections:
            # No detections, update with empty array
            output_stracks = tracker.update(
                np.empty((0, 5)),
                img_info,
                img_size
            )
            return {
                'tracks': [],
                'main_subject_present': False,
                'continuity_score': 0.0,
                'track_count': 0
            }

        # Convert to numpy array
        det_array = []
        for det in detections:
            bbox = det['bbox']  # [x1, y1, x2, y2]
            conf = det['confidence']
            det_array.append([bbox[0], bbox[1], bbox[2], bbox[3], conf])

        det_array = np.array(det_array, dtype=np.float32)

        # Update tracker
        try:
            output_stracks = tracker.update(det_array, img_info, img_size)
        except Exception as e:
            logger.error(f"ByteTrack update failed for {cam_id}: {e}")
            return self._fallback_response()

        # Extract track information
        tracks = []
        for track in output_stracks:
            if not track.is_activated:
                continue

            bbox = track.tlbr  # [x1, y1, x2, y2]
            track_info = {
                'track_id': track.track_id,
                'bbox': [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])],
                'score': float(track.score),
                'tracklet_length': track.tracklet_len,
                'frame_id': track.frame_id,
                'start_frame': track.start_frame
            }

            # Calculate velocity from Kalman filter
            if track.mean is not None:
                vx, vy = track.mean[4], track.mean[5]
                velocity = np.sqrt(vx**2 + vy**2)
                track_info['velocity'] = float(velocity)
            else:
                track_info['velocity'] = 0.0

            tracks.append(track_info)

        # Identify main subject
        main_subject_present, main_subject_id = self._identify_main_subject(tracks, cam_id)

        # Calculate continuity score
        continuity_score = self._calculate_continuity(tracks, main_subject_id)

        return {
            'tracks': tracks,
            'main_subject_present': main_subject_present,
            'main_subject_id': main_subject_id,
            'continuity_score': continuity_score,
            'track_count': len(tracks)
        }

    def _identify_main_subject(
        self,
        tracks: List[Dict],
        cam_id: str
    ) -> Tuple[bool, Optional[int]]:
        """
        Identify the main subject being tracked.

        Heuristics:
        - Longest tracklet length
        - Largest bbox area
        - Most central position
        """
        if not tracks:
            return False, None

        # Score each track
        scored_tracks = []
        for track in tracks:
            score = 0.0

            # Longer tracks are more likely to be the main subject
            score += track['tracklet_length'] / 100.0

            # Larger objects are more likely to be main subject
            bbox = track['bbox']
            area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
            score += area / 100000.0  # Normalize

            # Objects near center are more likely to be main subject
            cx = (bbox[0] + bbox[2]) / 2
            cy = (bbox[1] + bbox[3]) / 2
            # Assume 640x360 resolution (adjust if needed)
            center_dist = np.sqrt((cx - 320)**2 + (cy - 180)**2)
            centrality = max(0, 1.0 - center_dist / 400.0)
            score += centrality

            scored_tracks.append((score, track['track_id']))

        # Get highest scoring track
        if scored_tracks:
            scored_tracks.sort(reverse=True)
            main_id = scored_tracks[0][1]

            # Update global main subject
            self.main_subject_id = main_id
            self.main_subject_camera = cam_id

            return True, main_id

        return False, None

    def _calculate_continuity(
        self,
        tracks: List[Dict],
        main_subject_id: Optional[int]
    ) -> float:
        """
        Calculate continuity score.

        Higher score = better subject tracking continuity.
        """
        if not tracks:
            return 0.0

        if main_subject_id is None:
            return 0.0

        # Check if main subject is present
        main_track = next((t for t in tracks if t['track_id'] == main_subject_id), None)

        if main_track is None:
            return 0.0

        # Continuity based on tracklet length
        # Longer tracklet = better continuity
        tracklet_len = main_track['tracklet_length']
        continuity = min(1.0, tracklet_len / 30.0)  # Max out at 30 frames

        return continuity

    def get_main_subject_camera(self) -> Optional[str]:
        """Get the camera currently showing the main subject."""
        return self.main_subject_camera

    def reset(self, cam_id: Optional[str] = None):
        """Reset tracker state."""
        if cam_id is None:
            # Reset all trackers
            self.camera_trackers.clear()
            self.main_subject_id = None
            self.main_subject_camera = None
        elif cam_id in self.camera_trackers:
            # Reset specific camera
            del self.camera_trackers[cam_id]
            if self.main_subject_camera == cam_id:
                self.main_subject_id = None
                self.main_subject_camera = None

    def _fallback_response(self) -> Dict:
        """Return empty response when tracker unavailable."""
        return {
            'tracks': [],
            'main_subject_present': False,
            'continuity_score': 0.0,
            'track_count': 0
        }


class SimpleTracker:
    """
    Fallback simple tracker when ByteTrack is not available.
    Uses basic centroid matching.
    """

    def __init__(self):
        self.next_id = 0
        self.active_tracks: Dict[str, Dict] = {}
        self.max_distance = 50  # pixels

    def update(
        self,
        cam_id: str,
        yolo_results: Dict,
        img_info: Tuple[int, int],
        img_size: Tuple[int, int]
    ) -> Dict:
        """Simple centroid-based tracking."""
        detections = yolo_results.get('detections', [])

        if not detections:
            return {
                'tracks': [],
                'main_subject_present': False,
                'continuity_score': 0.0,
                'track_count': 0
            }

        tracks = []
        for det in detections:
            centroid = det['centroid']

            # Find closest existing track
            track_id = None
            min_dist = self.max_distance
            for tid, track in self.active_tracks.items():
                if track['cam_id'] != cam_id:
                    continue

                prev_centroid = track['centroid']
                dist = np.sqrt(
                    (centroid[0] - prev_centroid[0])**2 +
                    (centroid[1] - prev_centroid[1])**2
                )

                if dist < min_dist:
                    min_dist = dist
                    track_id = tid

            # Create new track if no match
            if track_id is None:
                track_id = self.next_id
                self.next_id += 1
                self.active_tracks[track_id] = {
                    'cam_id': cam_id,
                    'centroid': centroid,
                    'frames': 1
                }
            else:
                # Update existing track
                self.active_tracks[track_id]['centroid'] = centroid
                self.active_tracks[track_id]['frames'] += 1

            tracks.append({
                'track_id': track_id,
                'bbox': det['bbox'],
                'score': det['confidence'],
                'tracklet_length': self.active_tracks[track_id]['frames'],
                'velocity': 0.0
            })

        return {
            'tracks': tracks,
            'main_subject_present': len(tracks) > 0,
            'continuity_score': 0.5 if tracks else 0.0,
            'track_count': len(tracks)
        }
