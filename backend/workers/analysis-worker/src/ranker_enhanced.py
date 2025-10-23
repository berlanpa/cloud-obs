"""
Enhanced camera ranker with ByteTrack continuity features and XGBoost support.
"""

import numpy as np
from typing import Dict, List, Optional
from dataclasses import dataclass
import time
from loguru import logger

# XGBoost support (optional)
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    logger.warning("XGBoost not available, using rule-based ranking only")


@dataclass
class RankingWeights:
    """Configurable weights for rule-based ranking algorithm."""
    face_salience: float = 0.20
    main_subject_overlap: float = 0.15
    motion_salience: float = 0.15
    speech_energy: float = 0.12
    keyword_boost: float = 0.10
    framing_score: float = 0.08
    novelty_decay: float = 0.05
    continuity_bonus: float = 0.10  # Increased for ByteTrack
    vlm_interest: float = 0.05  # NEW: from LLaVA interest score


class CameraRankerEnhanced:
    """
    Enhanced camera ranker with:
    - ByteTrack continuity features
    - LLaVA semantic understanding
    - Optional XGBoost ML ranking
    - Velocity/motion from YOLO
    """

    def __init__(
        self,
        weights: Optional[RankingWeights] = None,
        xgboost_model_path: Optional[str] = None,
        use_xgboost: bool = False
    ):
        """
        Initialize ranker.

        Args:
            weights: Weights for rule-based ranking
            xgboost_model_path: Path to trained XGBoost model
            use_xgboost: Use XGBoost if available
        """
        self.weights = weights or RankingWeights()
        self.use_xgboost = use_xgboost and XGBOOST_AVAILABLE

        # Load XGBoost model if requested
        self.xgb_model = None
        if self.use_xgboost and xgboost_model_path:
            try:
                self.xgb_model = xgb.Booster()
                self.xgb_model.load_model(xgboost_model_path)
                logger.info(f"Loaded XGBoost model from {xgboost_model_path}")
            except Exception as e:
                logger.error(f"Failed to load XGBoost model: {e}")
                self.use_xgboost = False

        # Track last switch times for novelty decay
        self.last_active: Dict[str, float] = {}
        self.current_active: Optional[str] = None

        # Track subject position for continuity
        self.subject_positions: Dict[str, tuple] = {}

        # Main subject tracking (from ByteTrack)
        self.main_subject_id: Optional[int] = None

        logger.info(f"Enhanced ranker initialized (XGBoost: {self.use_xgboost})")

    def compute_score(
        self,
        cam_id: str,
        yolo_results: Dict,
        whisper_results: Dict,
        vlm_results: Optional[Dict] = None,
        tracking_results: Optional[Dict] = None
    ) -> Dict:
        """
        Compute comprehensive score for a camera feed.

        Args:
            cam_id: Camera identifier
            yolo_results: YOLO detection results
            whisper_results: Whisper ASR results
            vlm_results: LLaVA VLM results
            tracking_results: ByteTrack tracking results

        Returns:
            Dictionary with overall score, feature breakdown, and reasoning
        """
        # Extract all features
        features = self._extract_features(
            cam_id,
            yolo_results,
            whisper_results,
            vlm_results,
            tracking_results
        )

        # Compute score
        if self.use_xgboost and self.xgb_model is not None:
            score = self._compute_xgboost_score(features)
            method = "xgboost"
        else:
            score = self._compute_rule_based_score(features)
            method = "rule-based"

        # Generate reasoning
        reason = self._generate_reason(features, vlm_results)

        return {
            'cam_id': cam_id,
            'timestamp': time.time(),
            'score': float(score),
            'features': features,
            'reason': reason,
            'method': method,
            'vlm_tags': vlm_results.get('tags', []) if vlm_results else [],
            'vlm_caption': vlm_results.get('caption', '') if vlm_results else '',
            'tracking_present': tracking_results is not None and tracking_results.get('track_count', 0) > 0
        }

    def _extract_features(
        self,
        cam_id: str,
        yolo: Dict,
        whisper: Dict,
        vlm: Optional[Dict],
        tracking: Optional[Dict]
    ) -> Dict:
        """Extract and normalize all features."""

        # Face salience: combination of face confidence and area
        face_conf = yolo.get('face_conf_max', 0.0)
        face_area = yolo.get('face_area', 0.0)
        face_salience = (face_conf * 0.6 + face_area * 0.4)

        # Main subject overlap: check consistency
        main_subject_overlap = self._compute_subject_overlap(cam_id, yolo, tracking)

        # Motion salience: use YOLO velocity data
        avg_velocity = yolo.get('avg_velocity', 0.0)
        max_velocity = yolo.get('max_velocity', 0.0)
        # Normalize velocities (assume 100 px/s is high motion)
        motion_salience = min(1.0, (avg_velocity * 0.5 + max_velocity * 0.5) / 100.0)

        # Speech energy: normalize from dB to 0-1
        energy_db = whisper.get('energy_db', -80.0)
        speech_energy = self._normalize_db(energy_db)

        # Keyword boost: from Whisper keyword detection
        keywords = whisper.get('keywords', [])
        keyword_boost = min(1.0, len(keywords) * 0.3)

        # Framing score: check rule of thirds, occupancy
        framing_score = self._compute_framing_score(yolo)

        # Novelty decay: prefer cameras not recently shown
        novelty_decay = self._compute_novelty(cam_id)

        # Continuity bonus: NEW - from ByteTrack
        continuity_bonus = self._compute_continuity_bonus(cam_id, tracking)

        # VLM interest: NEW - from LLaVA interest score
        vlm_interest = 0.0
        if vlm and 'interest_score' in vlm:
            # Interest score is 1-5, normalize to 0-1
            vlm_interest = (vlm['interest_score'] - 1) / 4.0

        return {
            'face_salience': face_salience,
            'main_subject_overlap': main_subject_overlap,
            'motion_salience': motion_salience,
            'speech_energy': speech_energy,
            'keyword_boost': keyword_boost,
            'framing_score': framing_score,
            'novelty_decay': novelty_decay,
            'continuity_bonus': continuity_bonus,
            'vlm_interest': vlm_interest,
            # Raw values for analysis
            'object_counts': yolo.get('object_counts', {}),
            'keywords': [kw['keyword'] if isinstance(kw, dict) else kw for kw in keywords],
            'avg_velocity': avg_velocity,
            'max_velocity': max_velocity,
            'track_count': tracking.get('track_count', 0) if tracking else 0
        }

    def _compute_rule_based_score(self, features: Dict) -> float:
        """Compute weighted score using rule-based approach."""
        score = (
            self.weights.face_salience * features['face_salience'] +
            self.weights.main_subject_overlap * features['main_subject_overlap'] +
            self.weights.motion_salience * features['motion_salience'] +
            self.weights.speech_energy * features['speech_energy'] +
            self.weights.keyword_boost * features['keyword_boost'] +
            self.weights.framing_score * features['framing_score'] +
            self.weights.novelty_decay * features['novelty_decay'] +
            self.weights.continuity_bonus * features['continuity_bonus'] +
            self.weights.vlm_interest * features['vlm_interest']
        )
        return float(score)

    def _compute_xgboost_score(self, features: Dict) -> float:
        """Compute score using trained XGBoost model."""
        try:
            # Convert features to XGBoost DMatrix format
            feature_vector = [
                features['face_salience'],
                features['main_subject_overlap'],
                features['motion_salience'],
                features['speech_energy'],
                features['keyword_boost'],
                features['framing_score'],
                features['novelty_decay'],
                features['continuity_bonus'],
                features['vlm_interest']
            ]

            dmatrix = xgb.DMatrix([feature_vector])
            score = self.xgb_model.predict(dmatrix)[0]

            return float(score)

        except Exception as e:
            logger.error(f"XGBoost prediction failed: {e}, falling back to rule-based")
            return self._compute_rule_based_score(features)

    def _compute_subject_overlap(
        self,
        cam_id: str,
        yolo: Dict,
        tracking: Optional[Dict]
    ) -> float:
        """
        Compute overlap with tracked main subject.
        Enhanced with ByteTrack data.
        """
        # If we have tracking data, use it
        if tracking and tracking.get('main_subject_present', False):
            # Check if this camera shows the main subject
            main_subject_id = tracking.get('main_subject_id')
            if main_subject_id == self.main_subject_id:
                # Continuity score from tracker
                return tracking.get('continuity_score', 0.5)

        # Fallback to basic YOLO-based overlap calculation
        detections = yolo.get('detections', [])
        if not detections:
            return 0.0

        # Find largest detection
        largest = max(detections, key=lambda d: d.get('area', 0))
        centroid = largest.get('centroid', [0, 0])

        # Check consistency with previous
        if cam_id in self.subject_positions:
            prev_cx, prev_cy = self.subject_positions[cam_id]
            distance = np.sqrt((centroid[0] - prev_cx)**2 + (centroid[1] - prev_cy)**2)
            overlap = max(0.0, 1.0 - distance / 200.0)
        else:
            overlap = 0.5

        # Update subject position
        self.subject_positions[cam_id] = tuple(centroid)

        return overlap

    def _compute_continuity_bonus(
        self,
        cam_id: str,
        tracking: Optional[Dict]
    ) -> float:
        """
        Compute continuity bonus from ByteTrack.

        High bonus if:
        - Currently active camera
        - Main subject still visible
        - Long tracklet (stable tracking)
        """
        bonus = 0.0

        # Bonus if currently active
        if cam_id == self.current_active:
            bonus += 0.3

        # Bonus from tracking continuity
        if tracking:
            continuity_score = tracking.get('continuity_score', 0.0)
            bonus += continuity_score * 0.7

        return min(1.0, bonus)

    def _normalize_db(self, db: float, min_db: float = -60.0, max_db: float = -10.0) -> float:
        """Normalize dB energy to 0-1 range."""
        if db <= min_db:
            return 0.0
        if db >= max_db:
            return 1.0
        return (db - min_db) / (max_db - min_db)

    def _compute_framing_score(self, yolo: Dict) -> float:
        """Compute framing quality score."""
        occupancy = yolo.get('bbox_occupancy', 0.0)

        if 0.3 <= occupancy <= 0.6:
            framing = 1.0
        elif occupancy < 0.3:
            framing = occupancy / 0.3
        else:
            framing = max(0.0, 1.0 - (occupancy - 0.6) / 0.4)

        return framing

    def _compute_novelty(self, cam_id: str) -> float:
        """Compute novelty score - prefer cameras not recently shown."""
        current_time = time.time()

        if cam_id not in self.last_active:
            return 1.0

        time_since_active = current_time - self.last_active[cam_id]
        novelty = min(1.0, time_since_active / 10.0)

        return novelty

    def _generate_reason(self, features: Dict, vlm: Optional[Dict]) -> str:
        """Generate human-readable reason for the score."""
        reasons = []

        if features['face_salience'] > 0.6:
            reasons.append('face visible')

        if features['motion_salience'] > 0.5:
            reasons.append('high motion')

        if features['speech_energy'] > 0.5:
            reasons.append('speech detected')

        if features['keyword_boost'] > 0:
            keywords = features.get('keywords', [])
            if keywords:
                reasons.append(f"keywords: {','.join(keywords[:2])}")

        if features['continuity_bonus'] > 0.5:
            reasons.append('subject tracked')

        if vlm:
            if vlm.get('interest_score', 0) >= 4:
                reasons.append('high interest')

            tags = vlm.get('tags', [])[:2]
            if tags:
                reasons.append(f"tags: {','.join(tags)}")

        if not reasons:
            reasons.append('general scene')

        return ' + '.join(reasons)

    def update_active_camera(self, cam_id: str, main_subject_id: Optional[int] = None):
        """
        Update the currently active camera.

        Args:
            cam_id: Camera ID
            main_subject_id: Main subject track ID from ByteTrack
        """
        if self.current_active and self.current_active != cam_id:
            self.last_active[self.current_active] = time.time()

        self.current_active = cam_id

        if main_subject_id is not None:
            self.main_subject_id = main_subject_id

    def reset(self):
        """Reset ranker state."""
        self.last_active.clear()
        self.current_active = None
        self.subject_positions.clear()
        self.main_subject_id = None
