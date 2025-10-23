import numpy as np
from typing import Dict, List, Optional
from dataclasses import dataclass
import time


@dataclass
class RankingWeights:
    """Configurable weights for ranking algorithm."""
    face_salience: float = 0.25
    main_subject_overlap: float = 0.15
    motion_salience: float = 0.15
    speech_energy: float = 0.15
    keyword_boost: float = 0.10
    framing_score: float = 0.10
    novelty_decay: float = 0.05
    continuity_bonus: float = 0.05


class CameraRanker:
    """Ranks camera feeds based on multi-modal features."""

    def __init__(self, weights: Optional[RankingWeights] = None):
        self.weights = weights or RankingWeights()

        # Track last switch times for novelty decay
        self.last_active: Dict[str, float] = {}
        self.current_active: Optional[str] = None

        # Track subject position for continuity
        self.subject_positions: Dict[str, tuple] = {}

    def compute_score(
        self,
        cam_id: str,
        yolo_results: Dict,
        whisper_results: Dict,
        vlm_results: Optional[Dict] = None
    ) -> Dict:
        """
        Compute comprehensive score for a camera feed.

        Returns:
            Dictionary with overall score, feature breakdown, and reasoning
        """
        features = self._extract_features(cam_id, yolo_results, whisper_results, vlm_results)

        # Compute weighted score
        score = (
            self.weights.face_salience * features['face_salience'] +
            self.weights.main_subject_overlap * features['main_subject_overlap'] +
            self.weights.motion_salience * features['motion_salience'] +
            self.weights.speech_energy * features['speech_energy'] +
            self.weights.keyword_boost * features['keyword_boost'] +
            self.weights.framing_score * features['framing_score'] +
            self.weights.novelty_decay * features['novelty_decay'] +
            self.weights.continuity_bonus * features['continuity_bonus']
        )

        # Generate reasoning
        reason = self._generate_reason(features, vlm_results)

        return {
            'cam_id': cam_id,
            'timestamp': time.time(),
            'score': float(score),
            'features': features,
            'reason': reason,
            'vlm_tags': vlm_results.get('tags', []) if vlm_results else [],
            'vlm_caption': vlm_results.get('caption', '') if vlm_results else ''
        }

    def _extract_features(
        self,
        cam_id: str,
        yolo: Dict,
        whisper: Dict,
        vlm: Optional[Dict]
    ) -> Dict:
        """Extract and normalize all features."""

        # Face salience: combination of face confidence and area
        face_conf = yolo.get('face_conf_max', 0.0)
        face_area = yolo.get('face_area', 0.0)
        face_salience = (face_conf * 0.6 + face_area * 0.4)

        # Main subject overlap: check if main detected object is consistent
        main_subject_overlap = self._compute_subject_overlap(cam_id, yolo)

        # Motion salience: normalized motion score
        motion_salience = min(1.0, yolo.get('motion_score', 0.0))

        # Speech energy: normalize from dB to 0-1
        energy_db = whisper.get('energy_db', -80.0)
        speech_energy = self._normalize_db(energy_db)

        # Keyword boost
        keywords = whisper.get('keywords', [])
        keyword_boost = min(1.0, len(keywords) * 0.3)

        # Framing score: check rule of thirds, occupancy
        framing_score = self._compute_framing_score(yolo)

        # Novelty decay: prefer cameras not recently shown
        novelty_decay = self._compute_novelty(cam_id)

        # Continuity bonus: small bonus if currently active and still good
        continuity_bonus = 0.5 if cam_id == self.current_active else 0.0

        return {
            'face_salience': face_salience,
            'main_subject_overlap': main_subject_overlap,
            'motion_salience': motion_salience,
            'speech_energy': speech_energy,
            'keyword_boost': keyword_boost,
            'framing_score': framing_score,
            'novelty_decay': novelty_decay,
            'continuity_bonus': continuity_bonus,
            'object_counts': yolo.get('object_counts', {}),
            'keywords': keywords
        }

    def _compute_subject_overlap(self, cam_id: str, yolo: Dict) -> float:
        """Compute overlap with tracked main subject."""
        detections = yolo.get('detections', [])
        if not detections:
            return 0.0

        # Find largest detection (likely main subject)
        largest = max(detections, key=lambda d: d.get('area', 0))
        centroid = largest.get('centroid', [0, 0])

        # Check if subject position is consistent with previous
        if cam_id in self.subject_positions:
            prev_cx, prev_cy = self.subject_positions[cam_id]
            distance = np.sqrt((centroid[0] - prev_cx)**2 + (centroid[1] - prev_cy)**2)
            overlap = max(0.0, 1.0 - distance / 200.0)  # Normalize by 200px
        else:
            overlap = 0.5  # Neutral for first time

        # Update subject position
        self.subject_positions[cam_id] = tuple(centroid)

        return overlap

    def _normalize_db(self, db: float, min_db: float = -60.0, max_db: float = -10.0) -> float:
        """Normalize dB energy to 0-1 range."""
        if db <= min_db:
            return 0.0
        if db >= max_db:
            return 1.0
        return (db - min_db) / (max_db - min_db)

    def _compute_framing_score(self, yolo: Dict) -> float:
        """Compute framing quality score."""
        # Ideal occupancy is 30-60% of frame
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
            return 1.0  # New camera, high novelty

        time_since_active = current_time - self.last_active[cam_id]

        # Novelty increases over time
        # After 10 seconds, full novelty restored
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

        if vlm and vlm.get('tags'):
            tags = vlm['tags'][:2]
            reasons.append(f"tags: {','.join(tags)}")

        if not reasons:
            reasons.append('general scene')

        return ' + '.join(reasons)

    def update_active_camera(self, cam_id: str):
        """Update the currently active camera."""
        if self.current_active and self.current_active != cam_id:
            self.last_active[self.current_active] = time.time()

        self.current_active = cam_id

    def reset(self):
        """Reset ranker state."""
        self.last_active.clear()
        self.current_active = None
        self.subject_positions.clear()
