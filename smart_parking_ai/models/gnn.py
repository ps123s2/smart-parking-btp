"""
GNN-inspired routing logic using graph-based shortest path on the parking lot network.

The parking lot is modeled as a graph where:
- Nodes = entry, intersections, and parking slots
- Edges = road segments connecting them
- Weights = road segment distances (meters)

Graph layout:
         ┌─── A1 ──── A2 ──── A3 ───┐
         │                           │
  entry──┼─── B1 ──── B2             │
         │                           │
         └───────────────────────────┘
"""

from collections import deque
import heapq

# Parking lot road graph (adjacency list with distances in meters)
PARKING_GRAPH = {
    "entry":  [("jct_main", 10)],
    "jct_main": [("entry", 10), ("jct_b2", 15), ("jct_a", 40)],

    # Row B - slot5 (B2) is encountered FIRST (closer to entry)
    "jct_b2": [("jct_main", 15), ("slot5", 10), ("jct_b1", 20), ("jct_a", 20)],
    
    # Row B - slot4 (B1) is further down the aisle
    "jct_b1": [("jct_b2", 20), ("slot4", 10)],

    # Row A junction
    "jct_a":  [("jct_b2", 20), ("jct_main", 40), ("jct_a2", 15)],

    "jct_a2": [("jct_a", 15), ("slot2", 10), ("jct_a1", 15), ("jct_a3", 15)],
    "jct_a1": [("jct_a2", 15), ("slot1", 10)],
    "jct_a3": [("jct_a2", 15), ("slot3", 10)],

    # Slots
    "slot1":  [("jct_a1", 10)],   # A1
    "slot2":  [("jct_a2", 10)],   # A2
    "slot3":  [("jct_a3", 10)],   # A3
    "slot4":  [("jct_b1", 10)],   # B1
    "slot5":  [("jct_b2", 10)],   # B2
}


def shortest_path(graph, start, end):
    """Find the shortest route from start to end using BFS."""
    queue = deque([(start, [start])])
    visited = {start}

    while queue:
        current_node, path = queue.popleft()
        if current_node == end:
            return path

        for neighbor, _weight in graph.get(current_node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [neighbor]))

    return []


def dijkstra(graph, start, end):
    """Find shortest weighted path using Dijkstra's algorithm."""
    dist = {start: 0}
    prev = {start: None}
    heap = [(0, start)]

    while heap:
        cost, node = heapq.heappop(heap)
        if node == end:
            # Reconstruct path
            path = []
            while node is not None:
                path.append(node)
                node = prev[node]
            return list(reversed(path)), cost

        if cost > dist.get(node, float('inf')):
            continue

        for neighbor, weight in graph.get(node, []):
            new_cost = cost + weight
            if new_cost < dist.get(neighbor, float('inf')):
                dist[neighbor] = new_cost
                prev[neighbor] = node
                heapq.heappush(heap, (new_cost, neighbor))

    return [], float('inf')


def get_route_to_slot(slot_name: str):
    """Get the optimal route from entry to a specific slot."""
    path, distance = dijkstra(PARKING_GRAPH, "entry", slot_name)
    return path, distance


def get_all_slot_distances():
    """Get distances from entry to all slots using Dijkstra."""
    distances = {}
    for slot in ["slot1", "slot2", "slot3", "slot4", "slot5"]:
        _, dist = dijkstra(PARKING_GRAPH, "entry", slot)
        distances[slot] = dist
    return distances
