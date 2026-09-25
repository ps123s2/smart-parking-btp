"""Graph utilities for parking layout routing."""


def build_parking_graph(num_slots):
    """Build an adjacency list representing the parking layout."""
    graph = {0: []}
    if num_slots >= 1:
        graph[0].append(1)

    for slot in range(1, num_slots + 1):
        neighbors = []
        if slot == 1:
            neighbors.append(0)
        if slot > 1:
            neighbors.append(slot - 1)
        if slot < num_slots:
            neighbors.append(slot + 1)
        graph[slot] = neighbors

    return graph
