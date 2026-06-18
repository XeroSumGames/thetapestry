"""Identify *which* cat a crop is, by nearest-neighbour over reference photos.

There is deliberately **no training step**. You drop ~15 photos of each cat
into ``reference_photos/<CatName>/``; we embed them with a pretrained CNN
(ResNet-50 features) and match each live crop by cosine similarity to the
closest cat. Adding a new cat later is just a new folder.

Honest caveat: cats that look very alike (e.g. two solid-black cats) are
genuinely hard to tell apart from pixels alone. If you see mix-ups:
  - add more varied reference photos (different poses / lighting), and
  - raise ``min_confidence`` so uncertain matches log as "unknown" rather
    than guessing wrong.
"""
from __future__ import annotations

import glob
import os
from typing import List, Optional, Tuple

import numpy as np

_IMAGE_GLOBS = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")


class CatIdentifier:
    def __init__(self, reference_dir: str, min_confidence: float = 0.55):
        self.reference_dir = reference_dir
        self.min_confidence = min_confidence
        self._model = None
        self._preprocess = None
        self._ref_embeddings: Optional[np.ndarray] = None  # (N, D), L2-normalised
        self._ref_labels: List[str] = []

    # -- model + embedding ------------------------------------------------
    def _ensure_model(self) -> None:
        if self._model is not None:
            return
        import torch
        from torchvision import models

        weights = models.ResNet50_Weights.IMAGENET1K_V2
        net = models.resnet50(weights=weights)
        net.fc = torch.nn.Identity()  # expose the 2048-d pooled feature vector
        net.eval()
        self._torch = torch
        self._model = net
        self._preprocess = weights.transforms()

    def _embed(self, pil_images: list) -> np.ndarray:
        """Return L2-normalised embeddings for a list of PIL RGB images."""
        self._ensure_model()
        torch = self._torch
        batch = torch.stack([self._preprocess(im) for im in pil_images])
        with torch.no_grad():
            feats = self._model(batch).cpu().numpy()
        norms = np.linalg.norm(feats, axis=1, keepdims=True) + 1e-9
        return feats / norms

    # -- reference index --------------------------------------------------
    def build_reference_index(self) -> None:
        from PIL import Image

        all_embeddings: List[np.ndarray] = []
        labels: List[str] = []
        for cat_dir in sorted(glob.glob(os.path.join(self.reference_dir, "*"))):
            if not os.path.isdir(cat_dir):
                continue
            name = os.path.basename(cat_dir)
            paths: List[str] = []
            for pattern in _IMAGE_GLOBS:
                paths.extend(glob.glob(os.path.join(cat_dir, pattern)))
            if not paths:
                continue
            images = [Image.open(p).convert("RGB") for p in sorted(set(paths))]
            all_embeddings.append(self._embed(images))
            labels.extend([name] * len(images))

        if not all_embeddings:
            raise RuntimeError(
                f"No reference photos found under {self.reference_dir!r}. "
                "Create one folder per cat (e.g. reference_photos/Shadow/) and "
                "drop ~15 photos of that cat in it."
            )
        self._ref_embeddings = np.concatenate(all_embeddings, axis=0)
        self._ref_labels = labels

    # -- inference --------------------------------------------------------
    def identify_crop(self, crop_bgr: np.ndarray) -> Tuple[str, float]:
        """Identify a cat crop (OpenCV BGR array).

        Returns ``(name, confidence)`` where confidence is the mean cosine
        similarity to that cat's reference photos. Below ``min_confidence``
        the name is ``"unknown"``.
        """
        from PIL import Image

        if self._ref_embeddings is None:
            self.build_reference_index()

        rgb = crop_bgr[:, :, ::-1]  # BGR -> RGB
        pil = Image.fromarray(np.ascontiguousarray(rgb))
        emb = self._embed([pil])[0]
        sims = self._ref_embeddings @ emb  # cosine sims (vectors are normalised)

        best_name, best_score = "unknown", -1.0
        for name in sorted(set(self._ref_labels)):
            mask = np.array([label == name for label in self._ref_labels])
            score = float(sims[mask].mean())
            if score > best_score:
                best_name, best_score = name, score

        if best_score < self.min_confidence:
            return "unknown", best_score
        return best_name, best_score
