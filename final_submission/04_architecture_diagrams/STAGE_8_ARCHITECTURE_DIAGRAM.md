# STAGE 8 — SYSTEM ARCHITECTURE DIAGRAM

```mermaid
flowchart TD
    subgraph Client["React Native / Expo Client (smart-parking-app)"]
        UI["DashboardScreen.tsx / MapScreen.tsx"]
        Hook["useFirebaseParking.ts Hook"]
        APIClient["api.ts (allocateAISlot)"]
    end

    subgraph Firebase["Firebase Realtime Database"]
        FB_States["/data/states (Sensor Array: 0=free, 1=occupied)"]
        FB_Booked["/data/booked_slots (Active User Reservations)"]
        FB_Rec["/data/recommendation (Legacy Heuristic Recs)"]
    end

    subgraph Backend["Flask API Server (api.py)"]
        Route["POST /api/ai/allocate-slot"]
        FlagCheck{"ENABLE_AI_ALLOCATION == true?"}
        HeuristicFallback["Heuristic Allocator (select_best_slots in marl.py)"]
        SafetyGuard{"Stall Physically Vacant & Unbooked?"}
    end

    subgraph Neural["Stage 8 MARL-GCN Inference Pipeline"]
        Adapter["CampusObservationAdapter (campus_adapter.py)"]
        GAT["TwoStageGATLayer (graph_network.py)"]
        GRU["AgentTemporalGRU (hypernetwork.py)"]
        Hyper["PolicyHypernetwork (hypernetwork.py)"]
        Actor["PersonalizedAgentPolicy (hypernetwork.py)"]
        Decoder["decode_actions with Defensive Masking"]
        Weights[("best_maddpg_stabilized_seed_42.pt")]
    end

    %% Client Interactions
    UI -->|1. Request Allocation| Hook
    Hook -->|2. HTTP POST| APIClient
    APIClient -->|3. Call| Route

    %% Backend State Retrieval
    Route -->|4. Read Stalls & Bookings| FB_States
    Route -->|4. Read Stalls & Bookings| FB_Booked

    %% Flag Check
    Route --> FlagCheck
    FlagCheck -->|No (Default: False)| HeuristicFallback
    FlagCheck -->|Yes| Adapter

    %% Neural Execution Flow
    Weights -.->|Load Checkpoint| GAT
    Adapter -->|5. Build (1, 5, 8) Tensor & (1, 5, 5) Adj| GAT
    GAT -->|6. Spatial Features X| GRU
    GRU -->|7. Hidden Meta-Features H_t| Hyper
    Hyper -->|8. Generated Weights W_G, b_G| Actor
    GAT -->|Features X| Actor
    Actor -->|9. Continuous Priorities a_t in [0, 1]^5| Decoder
    Decoder -->|10. Defensive Mask (-inf on occupied)| SafetyGuard

    %% Safety & Response Flow
    SafetyGuard -->|Valid Vacant Stall| Route
    SafetyGuard -->|Collision Detected| HeuristicFallback
    HeuristicFallback --> Route
    Route -->|11. Structured JSON (latency, confidence, attribution)| APIClient
    APIClient -->|12. Update UI State| UI

    %% Real-time Sync
    UI -.->|13. On Driver Confirm| FB_Booked
```

---

## Component Responsibilities

1. **Expo Mobile Client (`smart-parking-app`):** Displays real-time campus stall availability, requests optimal stall allocations, renders neural attribution badges, and lets drivers confirm reservations.
2. **Flask Backend (`api.py`):** Acts as the authoritative decision gate. Validates requests, enforces the `ENABLE_AI_ALLOCATION` feature flag, and coordinates fail-safe fallback to the heuristic allocator.
3. **Campus Adapter (`campus_adapter.py`):** Translates real campus slot occupancy and road distances into standardized 8-dimensional node tensors for the neural network.
4. **Neural Policy (`neural_inference_service.py`):** Executes GAT, Temporal GRU, and Policy Hypernetwork in under $1\text{ms}$ with zero gradients and thread safety.
5. **Firebase Realtime Database:** Single source of truth for physical sensor occupancy and active multi-user booking locks.

