# STAGE 8.1 — CAMPUS GRAPH AND OBSERVATION ADAPTER REPORT

**Date:** 2026-11-16  
**Module Created:** `smart_parking_ai/campus_adapter.py`  
**Test Suite:** `test_campus_adapter.py` (5 passing tests in 0.016s)  
**Status:** **`VERIFIED & COMPLETE`**

---

## 1. Overview and Purpose

The **Campus Graph and Observation Adapter** ([smart_parking_ai/campus_adapter.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/campus_adapter.py)) creates an isolated mathematical and operational bridge between the physical campus parking facility (IIIT Sri City layout) and the paper-aligned MARL-GCN neural architecture.

It converts real-time Firebase binary stall states, active booking reservations, and physical aisle travel distances into standardized, normalized tensor representations compatible with the trained `best_maddpg_stabilized_seed_42.pt` checkpoint.

---

## 2. Campus Topology and Adjacency Specification

The adapter represents the actual 5-stall parking grid ([smart_parking_ai/models/gnn.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart_parking_ai/models/gnn.py) and [smart-parking-app/src/types/parking.ts](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/smart-parking-app/src/types/parking.ts)):

| Slot ID | Stall Label | Distance from Entrance | Aisle Location | Connected Neighbors |
| :---: | :---: | :---: | :---: | :--- |
| `slot1` | A1 | 85.0 meters | Row A (North aisle) | `slot2` (A2) |
| `slot2` | A2 | 70.0 meters | Row A (North aisle) | `slot1` (A1), `slot3` (A3), `slot5` (B2) |
| `slot3` | A3 | 85.0 meters | Row A (North aisle) | `slot2` (A2) |
| `slot4` | B1 | 55.0 meters | Row B (South aisle) | `slot5` (B2) |
| `slot5` | B2 | 35.0 meters | Row B (South aisle) | `slot4` (B1), `slot2` (A2 via central junction) |

### Adjacency Matrix ($A \in \mathbb{R}^{5 \times 5}$):
Includes self-loops on the main diagonal ($A_{ii} = 1.0$) for intra-partition GAT self-attention:
$$A = \begin{bmatrix}
1 & 1 & 0 & 0 & 0 \\
1 & 1 & 1 & 0 & 1 \\
0 & 1 & 1 & 0 & 0 \\
0 & 0 & 0 & 1 & 1 \\
0 & 1 & 0 & 1 & 1
\end{bmatrix}$$

---

## 3. Standardization and Normalization Rules

Each stall is transformed into an 8-dimensional feature vector matching the GAT input specification:

| Feature Index | Semantic Attribute | Campus Formulation | Normalization Rule |
| :---: | :--- | :--- | :--- |
| `0` | Stall Relative Index | $i \in \{0, 1, 2, 3, 4\}$ | $i / (N - 1) \in [0.0, 1.0]$ |
| `1` | Stall Capacity | $\sigma_i = 1$ parking space | $1.0 / 120.0 = 0.00833$ (matching municipal scale) |
| `2` | Occupancy Ratio | Sensor state OR active booking | $1.0$ if occupied/booked; $0.0$ if vacant |
| `3` | Normalized ETA | Distance / walking speed ($1.4\text{ m/s}$) | $\min((\text{ETA}_{\text{min}} / 60.0), 1.0)$ |
| `4` | Cruising Vehicle Count | Active requests en route to stall | $\text{count} / 50.0$ |
| `5` | Forecasted Demand | Exponential trend indicator | $\text{score} / 100.0 \in [0.0, 1.0]$ |
| `6` | Normalized Distance | Physical distance in meters | $\min(\text{distance} / 200.0, 1.0)$ |
| `7` | Previous Action Priority | Action from previous step | $a_{t-1}^i \in [0.0, 1.0]$ |

---

## 4. Defensive Action Masking & Allocation Decoding

The policy hypernetwork generates continuous priority scores $a_t \in [0, 1]^5$. To prevent double-booking or assigning occupied spaces:
1. **Defensive Masking:**
   $$\tilde{a}_t^i = \begin{cases} a_t^i & \text{if stall } i \text{ is vacant AND has no active booking} \\ -\infty & \text{if stall } i \text{ is occupied or actively reserved} \end{cases}$$
2. **Allocation Selection:**
   The assigned stall is the available stall with highest neural priority:
   $$i^* = \arg\max_{i \in \{1 \dots 5\}} \tilde{a}_t^i$$
3. **Capacity Exhaustion Handling:**
   If all stalls are occupied or booked ($\forall i, \tilde{a}_t^i = -\infty$), the adapter returns:
   ```json
   {
     "status": "no_available_stalls",
     "allocated_stall": null,
     "allocated_label": null,
     "top3_slots": []
   }
   ```
   This strictly prevents assigning an occupied bay to an arriving vehicle.

---

## 5. Verification Test Suite Summary

Executed test suite ([test_campus_adapter.py](file:///Users/psimonpeter/Downloads/smart-parking-btp-main/test_campus_adapter.py)):
- `test_graph_construction`: Validated $5 \times 5$ shape, self-loops, symmetry, and aisle connectivity. **Passed.**
- `test_observation_dimensions`: Validated tensor shape `(1, 5, 8)`, adjacency shape `(1, 5, 5)`, and availability boolean masking. **Passed.**
- `test_action_decoding_and_masking`: Verified that an occupied stall with the highest raw neural score ($0.9$) is masked out ($-\infty$), correctly assigning the highest available stall. **Passed.**
- `test_all_occupied_handling`: Verified that when all 5 stalls are occupied, the adapter returns `no_available_stalls` without errors. **Passed.**
- `test_missing_and_corrupt_firebase_data`: Verified that `None`, empty, or truncated states default safely to unbooked states with zero runtime exceptions. **Passed.**

Total: **5 tests passed in 0.016s**.

