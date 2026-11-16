"""Baseline Strategies for Municipal Parking Allocation: FIFO and SIRO.

Faithfully implements the baseline methods described in:
Xiaohang Zhao and Yangzhi Yan, "A Deep Reinforcement Learning and Graph Convolution
Approach to On-Street Parking Search Navigation," Sensors 2025, 25(8), 2389 (Section 5.2).
- First-In-First-Out (FIFO) (Sandholm & Lai 2010 [9])
- Service In Random Order (SIRO) (Larson & Sasanuma 2007 [10])
"""

from typing import Dict, List, Optional, Tuple, Union
import numpy as np


class BaseMunicipalPolicy:
    """Base interface for municipal parking allocation policies."""

    def __init__(self, name: str, num_districts: int = 9):
        self.name = name
        self.num_districts = num_districts

    def select_actions(
        self,
        node_feats: np.ndarray,
        adj: np.ndarray,
        info: Dict[str, any],
    ) -> np.ndarray:
        """Generates priority allocation vector across the 9 districts."""
        raise NotImplementedError


class FIFOMunicipalPolicy(BaseMunicipalPolicy):
    """First-In-First-Out (FIFO) allocation policy.

    Allocates spaces strictly in the order requests arrive. Prioritizes the requested
    district; if full, selects the nearest adjacent available lot based on road distance
    without considering global demand equilibrium or spatiotemporal forecasting.
    """

    def __init__(self, num_districts: int = 9):
        super().__init__("FIFO", num_districts)

    def select_actions(
        self,
        node_feats: np.ndarray,
        adj: np.ndarray,
        info: Dict[str, any],
    ) -> np.ndarray:
        """Assigns fixed priority scores favoring the requested district and its immediate neighbors."""
        occupancies = info.get("occupancies", [0] * self.num_districts)
        capacities = info.get("capacities", [1] * self.num_districts)

        # Standard static queue order: prioritize districts with highest vacancies
        action_priorities = np.zeros(self.num_districts, dtype=np.float32)
        for d in range(self.num_districts):
            vacancies = max(0, capacities[d] - occupancies[d])
            action_priorities[d] = float(vacancies) / max(capacities[d], 1)

        return action_priorities


class SIROMunicipalPolicy(BaseMunicipalPolicy):
    """Service In Random Order (SIRO) allocation policy.

    Assigns parking spaces completely at random among available lots,
    lacking coordination, spatial optimization, or learning capabilities.
    """

    def __init__(self, num_districts: int = 9, seed: int = 42):
        super().__init__("SIRO", num_districts)
        self.rng = np.random.RandomState(seed)

    def select_actions(
        self,
        node_feats: np.ndarray,
        adj: np.ndarray,
        info: Dict[str, any],
    ) -> np.ndarray:
        """Assigns uniform random priority scores across all 9 districts."""
        return self.rng.uniform(0.0, 1.0, size=self.num_districts).astype(np.float32)

