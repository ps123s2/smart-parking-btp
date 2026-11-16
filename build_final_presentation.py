#!/usr/bin/env python3
"""
Generates the 22-slide official BTP Final Presentation: SMART_PARKING_BTP_FINAL_PRESENTATION.pptx
Adheres strictly to actual experimental findings, mathematical formulation, and architecture.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette
    NAVY = RGBColor(16, 37, 66)
    BLUE = RGBColor(30, 90, 180)
    LIGHT_BG = RGBColor(248, 250, 252)
    WHITE = RGBColor(255, 255, 255)
    DARK_GRAY = RGBColor(51, 65, 85)
    SLATE = RGBColor(100, 116, 139)
    GREEN = RGBColor(16, 185, 129)
    AMBER = RGBColor(245, 158, 11)
    CARD_BG = RGBColor(255, 255, 255)
    BORDER_COLOR = RGBColor(226, 232, 240)

    figures_dir = "research/paper_aligned/manuscript/figures"

    def add_header(slide, title_text, category_text="SMART PARKING BTP — FINAL DEFENSE"):
        # Header banner
        header_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.9))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        
        p_cat = tf.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.size = Pt(10)
        p_cat.font.bold = True
        p_cat.font.color.rgb = BLUE

        p_title = tf.add_paragraph()
        p_title.text = title_text
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = NAVY

    def create_card(slide, left, top, width, height, title="", bg_color=CARD_BG, border_color=BORDER_COLOR):
        shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        shape.fill.solid()
        shape.fill.fore_color.rgb = bg_color
        shape.line.color.rgb = border_color
        shape.line.width = Pt(1)
        
        if title:
            tb = slide.shapes.add_textbox(left + Inches(0.2), top + Inches(0.15), width - Inches(0.4), Inches(0.4))
            tf = tb.text_frame
            tf.word_wrap = True
            tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
            p = tf.paragraphs[0]
            p.text = title
            p.font.size = Pt(14)
            p.font.bold = True
            p.font.color.rgb = NAVY
        return shape

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = NAVY
    bg1.line.fill.background()

    tb1 = s1.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(4.5))
    tf1 = tb1.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.text = "SMART PARKING SYSTEM USING MULTI-AGENT DEEP RL & GRAPH CONVOLUTION"
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = WHITE

    p2 = tf1.add_paragraph()
    p2.text = "End-to-End Implementation, Training Stabilization, Empirical Benchmarking & Mobile Edge Integration"
    p2.font.size = Pt(16)
    p2.font.color.rgb = RGBColor(147, 197, 253)
    p2.space_before = Pt(12)

    p3 = tf1.add_paragraph()
    p3.text = "\nBachelor of Technology (BTP) Final Project Defense — Session 2025–2026\nDepartment of Computer Science & Engineering"
    p3.font.size = Pt(14)
    p3.font.color.rgb = RGBColor(203, 213, 225)
    p3.space_before = Pt(24)

    p4 = tf1.add_paragraph()
    p4.text = "\nCandidates: [BTP Candidate Names / Student IDs]  |  Supervisor: [Project Supervisor Placeholder]"
    p4.font.size = Pt(13)
    p4.font.color.rgb = RGBColor(148, 163, 184)
    p4.space_before = Pt(18)

    # =========================================================================
    # SLIDE 2: PROBLEM STATEMENT
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "The Urban Parking Problem: Congestion & Cruising Delay", "Context & Problem Definition")
    
    create_card(s2, Inches(0.8), Inches(1.6), Inches(3.6), Inches(5.2), "30% Urban Cruising Delay")
    tb = s2.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(3.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Studies (Shoup, 2005) establish that 30% to 50% of urban traffic in downtown corridors consists of vehicles cruising for curbside parking."
    p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• Cruising creates severe secondary bottleneck queues, wastes driver time, and increases localized accidents."
    p2.font.size = Pt(13); p2.font.color.rgb = DARK_GRAY

    create_card(s2, Inches(4.8), Inches(1.6), Inches(3.6), Inches(5.2), "Excess Fuel & CO2 Emissions")
    tb = s2.shapes.add_textbox(Inches(5.0), Inches(2.2), Inches(3.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Millions of vehicle-kilometers traveled (VKT) are spent searching in circles, generating excess CO2, NOx, and particulate matter."
    p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• In dense commercial centers (e.g. Melbourne CBD), localized demand repeatedly exceeds physical bay capacity, causing hyper-congestion."
    p2.font.size = Pt(13); p2.font.color.rgb = DARK_GRAY

    create_card(s2, Inches(8.8), Inches(1.6), Inches(3.6), Inches(5.2), "Failure of Passive Systems")
    tb = s2.shapes.add_textbox(Inches(9.0), Inches(2.2), Inches(3.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Passive signage and naive smartphone apps cause a 'herding effect' where dozens of drivers rush to the same spotted spot."
    p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• Need: Active, coordinated multi-agent allocation that balances city-wide network demand in real time."
    p2.font.size = Pt(13); p2.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 3: RESEARCH MOTIVATION & VISION
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "Research Motivation: From Passive Monitoring to Multi-Agent ITS", "Paradigm Shift")
    
    create_card(s3, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2), "The Need for Spatial Graph Awareness")
    tb = s3.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Urban road networks are non-Euclidean graphs. Distance alone is deceptive; road connectivity and turn delays matter."
    p.font.size = Pt(14); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• Graph Attention Networks (GAT) allow neighboring parking facilities to share real-time occupancy and arrival pressure."
    p2.font.size = Pt(14); p2.font.color.rgb = DARK_GRAY
    p3 = tf.add_paragraph()
    p3.text = "\n• Heterogeneous pooling compresses regional competition into compact spatial embeddings."
    p3.font.size = Pt(14); p3.font.color.rgb = DARK_GRAY

    create_card(s3, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2), "The Power of Multi-Agent Reinforcement Learning")
    tb = s3.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Each parking facility acts as an autonomous agent in a cooperative-competitive Multi-Agent RL setting."
    p.font.size = Pt(14); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• Centralized Training with Decentralized Execution (CTDE): Centralized evaluators guide learning offline, while decentralized actors execute fast inferences online."
    p2.font.size = Pt(14); p2.font.color.rgb = DARK_GRAY
    p3 = tf.add_paragraph()
    p3.text = "\n• Hypernetworks dynamically generate personalized policy weights conditioned on temporal facility state."
    p3.font.size = Pt(14); p3.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 4: RESEARCH OBJECTIVES
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "Project & Research Objectives", "Guiding Framework")
    
    objectives = [
        ("1. PyTorch Implementation", "Faithfully implement all 10 core architectural modules of Zhao & Yan (2025) MARL-GCN in PyTorch."),
        ("2. Training Stabilization", "Identify and eliminate Bellman error explosion in centralized continuous critics via Twin Critics and gradient norm clipping."),
        ("3. Trace-Calibrated Benchmarking", "Benchmark against FIFO and SIRO across 8 municipal scenarios using open sensor data from the City of Melbourne (541 bays)."),
        ("4. Statistical & Ablation Rigor", "Conduct controlled ablation studies ($N=5$) and formal hypothesis testing with Holm-Bonferroni corrections."),
        ("5. Production Mobile Deployment", "Deploy the trained model into a production React Native / Expo application and Flask backend with fail-closed Firebase concurrency.")
    ]
    for i, (title, desc) in enumerate(objectives):
        top_pos = Inches(1.6 + i * 1.05)
        create_card(s4, Inches(0.8), top_pos, Inches(11.733), Inches(0.95))
        tb = s4.shapes.add_textbox(Inches(1.1), top_pos + Inches(0.12), Inches(11.1), Inches(0.7))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title + " — "
        p.font.bold = True
        p.font.size = Pt(14)
        p.font.color.rgb = BLUE
        p_desc = p
        run = p.add_run()
        run.text = desc
        run.font.bold = False
        run.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 5: LITERATURE REVIEW
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "Literature Review & Theoretical Foundations", "Related Work")
    
    cards_lit = [
        ("Traditional Heuristics", "• FIFO: Greedy queue allocation based on lowest instant occupancy ratio.\n• SIRO: Service-in-Random-Order modeling uncoordinated search.\n• Strengths: Low latency, simple.\n• Limitation: Zero foresight; severe localized saturation under surges."),
        ("Graph Neural Networks", "• GCN / GAT (Veličković et al., 2018): Spatial convolution & self-attention over road networks.\n• Heterogeneous Graphs: Separate modeling of parking bays vs travel roads.\n• Contrastive Learning: Self-supervised spatial invariant learning."),
        ("Multi-Agent RL & CTDE", "• MADDPG (Lowe et al., 2017): Centralized critic overcomes non-stationarity.\n• Policy Hypernetworks (Ha et al., 2017): Meta-learning dynamic policy parameters.\n• TD3 (Fujimoto et al., 2018): Twin critics prevent overestimation bias.")
    ]
    for i, (title, text) in enumerate(cards_lit):
        create_card(s5, Inches(0.8 + i * 4.0), Inches(1.6), Inches(3.733), Inches(5.2), title)
        tb = s5.shapes.add_textbox(Inches(1.0 + i * 4.0), Inches(2.3), Inches(3.333), Inches(4.3))
        tf = tb.text_frame
        tf.word_wrap = True
        for line in text.split("\n"):
            p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
            p.text = line
            p.font.size = Pt(13)
            p.font.color.rgb = DARK_GRAY
            p.space_before = Pt(4)

    # =========================================================================
    # SLIDE 6: IDENTIFIED RESEARCH GAPS
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "Identified Gaps in Prior MARL-GCN Literature", "Scientific Motivation")

    gaps = [
        ("Gap 1: Catastrophic Critic Divergence", "Unconstrained MADDPG critics in continuous parking environments experience severe overestimation bias, causing critic MSE loss to explode by 10 orders of magnitude ($31.0 \to 5.91 \times 10^{11}$)."),
        ("Gap 2: Replay Disconnect with Recurrent Policies", "Standard single-step experience replay violates the Markovian assumption when training recurrent GRU policies, resetting hidden states to zero and corrupting temporal learning."),
        ("Gap 3: Unverified Baseline Comparison Claims", "Prior literature lacked multi-seed statistical significance tests ($p$-values, Holm-Bonferroni corrections) comparing MARL against greedy deterministic heuristics like FIFO under identical arrival sequences."),
        ("Gap 4: Lack of Real-World Production Integration", "Academic implementations remained trapped in offline simulation scripts, lacking integration with mobile frontends, REST APIs, or concurrency-hardened distributed databases.")
    ]
    for i, (title, desc) in enumerate(gaps):
        top_pos = Inches(1.6 + i * 1.3)
        create_card(s6, Inches(0.8), top_pos, Inches(11.733), Inches(1.15), title)
        tb = s6.shapes.add_textbox(Inches(1.0), top_pos + Inches(0.45), Inches(11.3), Inches(0.6))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(13)
        p.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 7: PROPOSED SYSTEM OVERVIEW
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "Proposed System Architecture & End-to-End Pipeline", "System Design")

    layers = [
        ("1. Mobile Client (Expo)", "React Native app with DashboardScreen, MapScreen, real-time Firebase listeners, and reservation triggers."),
        ("2. REST API Gate (Flask)", "Decision gateway checking startup pre-warming, topology validation, and dynamic feature flag."),
        ("3. Concurrency Layer", "Fail-closed optimistic concurrency control via Firebase RTDB ETag and conditional If-Match PUT."),
        ("4. Campus Adapter", "Translates live campus stall states into normalized (1, 5, 8) graph node tensors."),
        ("5. Neural Engine (PyTorch)", "Executes Two-Stage GAT, GRU, Hypernetwork, and Actor policy with defensive masking."),
        ("6. Fail-Safe Engine", "Deterministic heuristic fallback (select_best_slots) guarantees 100% service uptime if model fails.")
    ]
    for i, (title, desc) in enumerate(layers):
        col = i % 2
        row = i // 2
        left = Inches(0.8 + col * 6.0)
        top = Inches(1.6 + row * 1.75)
        create_card(s7, left, top, Inches(5.733), Inches(1.55), title)
        tb = s7.shapes.add_textbox(left + Inches(0.2), top + Inches(0.55), Inches(5.333), Inches(0.9))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(13)
        p.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 8: END-TO-END SYSTEM FLOW & FAIL-SAFE GATING
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "Multi-Tiered Fail-Safe Routing & Concurrency Gates", "Backend Architecture")

    create_card(s8, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2), "4 Sequential Backend Security Gates")
    tb = s8.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    steps_gate = [
        "1. Pre-warm Gate: Checks model weights loaded & pre-warmed. If uninitialized -> Heuristic Fallback.",
        "2. Feature Flag Gate: Evaluates ENABLE_AI_ALLOCATION. If false -> Instant Heuristic Fallback.",
        "3. Topology Guard: Validates exact 5-stall layout. If mismatch (<5, >5, dupes) -> Raises TopologyMismatchError and falls back.",
        "4. Defensive Mask: Applies -inf masking to occupied/booked stalls, guaranteeing 0 occupied recommendations."
    ]
    for s in steps_gate:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = s
        p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY; p.space_before = Pt(8)

    create_card(s8, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2), "Atomic Distributed Concurrency (SEC-01)")
    tb = s8.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    steps_sec = [
        "• Process Mutex (_booking_lock): Serializes concurrent request threads within the Python process.",
        "• Fail-Closed ETag: Queries GET /data/booked_slots/{slot_id}.json. If GET fails or ETag missing -> Aborts with HTTP 502 Bad Gateway.",
        "• Conditional PUT (If-Match): Writes to Firebase with If-Match header. If concurrent race occurs, Firebase returns HTTP 412 -> Mapped to HTTP 409 Conflict.",
        "• Idempotent Confirmation: Repeated requests for the same driver return existing reservation cleanly."
    ]
    for s in steps_sec:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = s
        p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY; p.space_before = Pt(8)

    # =========================================================================
    # SLIDE 9: GRAPH REPRESENTATION OF PARKING NETWORKS
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "Mathematical Graph Formulation & Node Features", "Methodology")

    create_card(s9, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.2), "Heterogeneous Urban Parking Graph: G = (V, E, W)")
    tb = s9.shapes.add_textbox(Inches(1.1), Inches(2.3), Inches(11.133), Inches(4.3))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = "• Facilities represented as vertices V partitioned into dynamic facilities and static baseline bays."
    p.font.size = Pt(14); p.font.color.rgb = DARK_GRAY
    
    p2 = tf.add_paragraph()
    p2.text = "\n• 8-Dimensional Node Feature Tensor x_i in R^8:"
    p2.font.size = Pt(14); p2.font.bold = True; p2.font.color.rgb = NAVY
    
    features = [
        "1. Occupancy Ratio: delta_i / sigma_i (Current physical sensor occupancy)",
        "2. Normalized Capacity: sigma_i / sigma_max (Relative stall capacity)",
        "3. Base Cruising Time: e_i / e_max (Vacant baseline search delay)",
        "4. Cruising Density: cruising_i / cruising_max (Active vehicles seeking parking)",
        "5. Local Arrival Demand: arrival_i / arrival_max (Forecasted request arrival rate)",
        "6. Pedestrian Walking Distance: walking_i / walking_max (Distance from bay to destination)",
        "7 & 8. Spatial Coordinates: (coord_x, coord_y) (Normalized physical coordinates)"
    ]
    for f in features:
        pf = tf.add_paragraph()
        pf.text = "   " + f
        pf.font.size = Pt(13); pf.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 10: TWO-STAGE GRAPH ATTENTION NETWORK
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    add_header(s10, "Two-Stage Graph Attention Network (GAT) Architecture", "Spatial Representation")

    create_card(s10, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2), "Stage 1: Intra-Partition Attention")
    tb = s10.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Computes multi-head self-attention coefficients between connected parking facilities:"
    p.font.size = Pt(14); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n   alpha_ij = exp(LeakyReLU(a^T [W h_i || W h_j])) / sum_k exp(...)"
    p2.font.size = Pt(13); p2.font.bold = True; p2.font.color.rgb = BLUE
    p3 = tf.add_paragraph()
    p3.text = "\n• Invalid topological edges are masked with -9 x 10^15 before softmax normalization."
    p3.font.size = Pt(13); p3.font.color.rgb = DARK_GRAY
    p4 = tf.add_paragraph()
    p4.text = "\n• Aggregates localized spatial context within geographic neighborhood clusters."
    p4.font.size = Pt(13); p4.font.color.rgb = DARK_GRAY

    create_card(s10, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2), "Stage 2: Inter-Partition Projection")
    tb = s10.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Captures macro-level competition across distinct municipal districts:"
    p.font.size = Pt(14); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n   X = W_inter * G^c in R^(B x N x 32)"
    p2.font.size = Pt(13); p2.font.bold = True; p2.font.color.rgb = BLUE
    p3 = tf.add_paragraph()
    p3.text = "\n• Applies ELU non-linearity to stabilize inter-regional representations."
    p3.font.size = Pt(13); p3.font.color.rgb = DARK_GRAY
    p4 = tf.add_paragraph()
    p4.text = "\n• Feeds into Heterogeneous Graph Pooling (HGP) and Graph Contrastive Learning (GCL)."
    p4.font.size = Pt(13); p4.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 11: MARL-GCN & POLICY HYPERNETWORK
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    add_header(s11, "Temporal Recurrence & Policy Hypernetwork", "Policy Architecture")

    create_card(s11, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2), "Agent Temporal GRU")
    tb = s11.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Maintains hidden temporal memory of facility state over time:"
    p.font.size = Pt(14); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n   H_t^i = GRU(H_{t-1}^i, [x_t^i || a_{t-1}^i]) in R^64"
    p2.font.size = Pt(13); p2.font.bold = True; p2.font.color.rgb = BLUE
    p3 = tf.add_paragraph()
    p3.text = "\n• Stateless Serving in Production: HTTP on-demand inference sets h_0 = 0 to eliminate cross-request state drift."
    p3.font.size = Pt(13); p3.font.color.rgb = DARK_GRAY
    p4 = tf.add_paragraph()
    p4.text = "\n• Essential component: Ablation proves removing GRU causes a catastrophic +545.5% delay surge!"
    p4.font.size = Pt(13); p4.font.bold = True; p4.font.color.rgb = RGBColor(220, 38, 38)

    create_card(s11, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2), "Policy Hypernetwork & Continuous Actor")
    tb = s11.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Meta-learning: Hypernetwork G generates dynamic policy layer weights:"
    p.font.size = Pt(14); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n   W_{G,t}^i = G_w(H_t^i) in R^(1x32),  b_{G,t}^i = G_b(H_t^i) in R^1"
    p2.font.size = Pt(13); p2.font.bold = True; p2.font.color.rgb = BLUE
    p3 = tf.add_paragraph()
    p3.text = "\n• Continuous Actor Action Execution in [0, 1]:"
    p3.font.size = Pt(13); p3.font.color.rgb = DARK_GRAY
    p4 = tf.add_paragraph()
    p4.text = "\n   a_t^i = Sigmoid(W_{G,t}^i phi(x_t^i) + b_{G,t}^i)"
    p4.font.size = Pt(13); p4.font.bold = True; p4.font.color.rgb = BLUE

    # =========================================================================
    # SLIDE 12: TRAINING STABILIZATION & LOSS BOUNDEDNESS
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    add_header(s12, "Eliminating Bellman Divergence: Twin-Critic Stabilization", "Reinforcement Learning Core")

    # Embed Fig 1 if exists
    fig1_path = os.path.join(figures_dir, "fig1_maddpg_stabilization_curves.png")
    if os.path.exists(fig1_path):
        s12.shapes.add_picture(fig1_path, Inches(0.8), Inches(1.6), width=Inches(6.2))
    else:
        create_card(s12, Inches(0.8), Inches(1.6), Inches(6.2), Inches(5.2), "Training Loss Curve Placeholder")

    create_card(s12, Inches(7.3), Inches(1.6), Inches(5.233), Inches(5.2), "4 Stabilization Interventions")
    tb = s12.shapes.add_textbox(Inches(7.5), Inches(2.2), Inches(4.833), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    interventions = [
        "1. Twin Critics (TD3 Principle): Dual evaluators Q_1 and Q_2 bound overestimation error via min(Q_1', Q_2').",
        "2. Reward Scaling: Scaled step reward by 0.1x, strictly bounding theoretical discounted return at <= 100.0.",
        "3. Gradient Norm Regularization: Explicit parameter gradient clipping (||g||_2 <= 5.0) suppresses gradient shocks.",
        "4. Feature Detachment: Detaches GAT features passed to critic, preventing critic MSE from destabilizing spatial representations.",
        "Outcome: Critic loss stabilized at <= 4.04 (eliminating 10-order explosion); Q-mean calibrated at 11.98."
    ]
    for text in interventions:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = text
        p.font.size = Pt(12)
        p.font.color.rgb = DARK_GRAY
        p.space_before = Pt(6)

    # =========================================================================
    # SLIDE 13: DATASET & SIMULATION CALIBRATION
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    add_header(s13, "City of Melbourne Dataset & Simulation Calibration", "Experimental Testbed")

    create_card(s13, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2), "Trace-Calibrated Open Sensor Data")
    tb = s13.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• City of Melbourne Open Data Portal: 29,342 real-world parking requests across 9 distinct geographic districts."
    p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• Dwell Time Distribution: Fitted Gamma(alpha=2.33, beta=18.58), yielding a realistic mean dwell time of 43.29 minutes."
    p2.font.size = Pt(13); p2.font.color.rgb = DARK_GRAY
    p3 = tf.add_paragraph()
    p3.text = "\n• Total Municipal Network Capacity: 541 parking bays."
    p3.font.size = Pt(13); p3.font.color.rgb = DARK_GRAY

    create_card(s13, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2), "9-District Topological Partition")
    tb = s13.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    districts = [
        "• D0: Carlton (71 bays, 805 req, base 2.5 min)",
        "• D1: Docklands (17 bays, 4,191 req, base 3.0 min)",
        "• D2: East Melbourne (37 bays, 2,283 req, base 2.0 min)",
        "• D3: Kensington (117 bays, 1 req, base 1.5 min)",
        "• D4: Melbourne CBD (83 bays, 14,687 req, base 4.0 min)",
        "• D5: North Melbourne (94 bays, 2,452 req, base 2.5 min)",
        "• D6: Parkville (34 bays, 411 req, base 2.0 min)",
        "• D7: Southbank (40 bays, 2,129 req, base 3.0 min)",
        "• D8: West Melbourne (48 bays, 2,384 req, base 2.5 min)"
    ]
    for d in districts:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = d
        p.font.size = Pt(11.5); p.font.color.rgb = DARK_GRAY; p.space_before = Pt(3)

    # =========================================================================
    # SLIDE 14: EXPERIMENTAL SCENARIOS
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    add_header(s14, "Multi-Scenario Evaluation Workloads (N=10 Paired Seeds)", "Evaluation Framework")

    scenarios = [
        ("Scenario 1: Low Demand", "100 vehicle requests across 120 minutes. Tests baseline routing under light traffic."),
        ("Scenario 2: Moderate Demand", "250 vehicle requests. Represents typical daytime operational equilibrium."),
        ("Scenario 3: Saturated Demand", "600 vehicle requests. Heavy rush hour; triggers severe localized queuing in CBD."),
        ("Scenario 4: CBD Overload", "350 vehicle requests with 65% concentrated in CBD (District 4)."),
        ("Scenario 5: Stochastic Variance", "300 requests with elevated arrival variance and high dwell variance."),
        ("Scenario 6: Demand Surge (+50%)", "900 vehicle requests. Stress test evaluating network-wide throughput limits."),
        ("Scenario 7: East Asymmetry", "350 requests with spatial demand bias toward East Melbourne facilities."),
        ("Scenario 8: High Turnover Stress", "350 requests with 50% shorter dwell durations (rapid vehicle turnover).")
    ]
    for i, (title, desc) in enumerate(scenarios):
        col = i % 2
        row = i // 2
        left = Inches(0.8 + col * 6.0)
        top = Inches(1.6 + row * 1.3)
        create_card(s14, left, top, Inches(5.733), Inches(1.15), title)
        tb = s14.shapes.add_textbox(left + Inches(0.2), top + Inches(0.4), Inches(5.333), Inches(0.65))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(12)
        p.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 15: BASELINE COMPARISON & BENCHMARK RESULTS
    # =========================================================================
    s15 = prs.slides.add_slide(blank_layout)
    add_header(s15, "Empirical Benchmark Results: MARL-GCN vs FIFO vs SIRO", "Experimental Findings")

    fig2_path = os.path.join(figures_dir, "fig2_multi_scenario_benchmarks.png")
    if os.path.exists(fig2_path):
        s15.shapes.add_picture(fig2_path, Inches(0.8), Inches(1.6), width=Inches(7.2))
    else:
        create_card(s15, Inches(0.8), Inches(1.6), Inches(7.2), Inches(5.2), "Multi-Scenario Benchmark Graph")

    create_card(s15, Inches(8.3), Inches(1.6), Inches(4.233), Inches(5.2), "Transparent Findings")
    tb = s15.shapes.add_textbox(Inches(8.5), Inches(2.2), Inches(3.833), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    points_res = [
        "• 100% Allocation Rate: All 240 simulation episodes successfully allocated 100% of vehicles across all methods.",
        "• Scalability: Scaled to 900 vehicles without gridlock.",
        "• FIFO Advantage: Deterministic FIFO achieved lower search delay across all scenarios (e.g. 3.38m vs 6.48m in Scen 2, p < 0.001).",
        "• Little's Law Queuing: Under Scen 3, CBD concurrent demand (108 vehicles) exceeded 83-bay capacity by 1.3x, pushing cruising delay to 80m cap.",
        "• Scientific Honesty: Under 30 episodes, continuous MARL has not converged to FIFO's fine-grained load balancing."
    ]
    for pt in points_res:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = pt
        p.font.size = Pt(12)
        p.font.color.rgb = DARK_GRAY
        p.space_before = Pt(6)

    # =========================================================================
    # SLIDE 16: ARCHITECTURAL ABLATION STUDY
    # =========================================================================
    s16 = prs.slides.add_slide(blank_layout)
    add_header(s16, "Architectural Ablation Study (N=5 Seeds)", "Module Attribution")

    fig3_path = os.path.join(figures_dir, "fig3_ablation_effect_sizes.png")
    if os.path.exists(fig3_path):
        s16.shapes.add_picture(fig3_path, Inches(0.8), Inches(1.6), width=Inches(6.2))
    else:
        create_card(s16, Inches(0.8), Inches(1.6), Inches(6.2), Inches(5.2), "Ablation Effect Sizes Graph")

    create_card(s16, Inches(7.3), Inches(1.6), Inches(5.233), Inches(5.2), "Ablation Insights & Statistics")
    tb = s16.shapes.add_textbox(Inches(7.5), Inches(2.2), Inches(4.833), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    ablation_pts = [
        "• Full MARL-GCN: 4.64 min delay, 1952.4 return.",
        "• No-GRU (CRITICAL): Cruising delay surges by +545.5% (4.64 -> 29.93 min, p = 3.03 x 10^-6). Proves temporal memory is the single indispensable module!",
        "• No-GAT: Delay descriptively reduced to 3.57 min (-23.0%). Spatial attention matrices introduce parameter overhead on compact 9-node macro-topologies.",
        "• No-Hypernetwork: Delay slightly increases to 4.97 min (+7.3%).",
        "• No-CTDE: Delay is 4.29 min (-7.6%), showing decentralized critics train faster in early epochs."
    ]
    for pt in ablation_pts:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = pt
        p.font.size = Pt(12)
        p.font.color.rgb = DARK_GRAY
        p.space_before = Pt(6)

    # =========================================================================
    # SLIDE 17: EXPO MOBILE APP INTEGRATION
    # =========================================================================
    s17 = prs.slides.add_slide(blank_layout)
    add_header(s17, "Production Expo Mobile Frontend Integration", "Mobile Engineering")

    create_card(s17, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2), "DashboardScreen.tsx Features")
    tb = s17.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    dash_pts = [
        "• Live Real-Time Availability: Displays vacant vs occupied stalls streamed from Firebase RTDB.",
        "• AI Recommendation Card: Renders top allocated stall with confidence score and sub-millisecond latency badge.",
        "• CO2 Savings Counter: Real-time environmental tracking based on cruising distance saved.",
        "• Quick Booking Flow: Instant reservation trigger with duration selector (15m to 4h)."
    ]
    for pt in dash_pts:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = pt
        p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY; p.space_before = Pt(8)

    create_card(s17, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2), "MapScreen.tsx Vector Canvas")
    tb = s17.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    map_pts = [
        "• Interactive Campus Map: Vector layout representing aisles A & B and stalls A1–A3, B1–B2.",
        "• Visual State Encoding: Green (Available), Red (Occupied), Blue (User Reserved).",
        "• Active Booking Priority: Map prioritizes the driver's active booking over AI refreshes, preventing UI thrashing.",
        "• Route Polyline: Direct walking route navigation from parking entrance to assigned stall."
    ]
    for pt in map_pts:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = pt
        p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY; p.space_before = Pt(8)

    # =========================================================================
    # SLIDE 18: CONCURRENCY HARDENING & BOOKING ATOMICITY
    # =========================================================================
    s18 = prs.slides.add_slide(blank_layout)
    add_header(s18, "Distributed Concurrency: Mutex & Fail-Closed ETag", "Security & Reliability")

    create_card(s18, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.2), "Double-Booking Elimination")
    tb = s18.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• The Challenge: Two drivers simultaneously attempting to reserve the last vacant stall."
    p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• Dual-Layer Defense:"
    p2.font.size = Pt(13); p2.font.bold = True; p2.font.color.rgb = NAVY
    p3 = tf.add_paragraph()
    p3.text = "\n   1. In-Process Mutex: Serializes concurrent threads on the Flask server."
    p3.font.size = Pt(12.5); p3.font.color.rgb = DARK_GRAY
    p4 = tf.add_paragraph()
    p4.text = "\n   2. Distributed ETag: Requests concurrency token from /data/booked_slots/{slot_id}.json."
    p4.font.size = Pt(12.5); p4.font.color.rgb = DARK_GRAY
    p5 = tf.add_paragraph()
    p5.text = "\n   3. If-Match Conditional Write: First driver succeeds (200 OK); second driver receives 412 from Firebase -> Mapped to 409 Conflict."
    p5.font.size = Pt(12.5); p5.font.color.rgb = DARK_GRAY

    create_card(s18, Inches(6.8), Inches(1.6), Inches(5.6), Inches(5.2), "Fail-Closed Reliability & Idempotency")
    tb = s18.shapes.add_textbox(Inches(7.0), Inches(2.2), Inches(5.2), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "• Fail-Closed ETag Query: If Firebase GET fails or ETag is missing -> Aborts immediately with HTTP 502 Bad Gateway. Unconditioned PUT is strictly impossible."
    p.font.size = Pt(13); p.font.color.rgb = DARK_GRAY
    p2 = tf.add_paragraph()
    p2.text = "\n• Write Failure Verification: Non-200 responses from Firebase return HTTP 502/503/504. The API NEVER returns false 200 OK on write failure."
    p2.font.size = Pt(13); p2.font.color.rgb = DARK_GRAY
    p3 = tf.add_paragraph()
    p3.text = "\n• Idempotent Duplicates: A driver refreshing their reservation receives confirmation without duplicate database writes."
    p3.font.size = Pt(13); p3.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 19: COMPUTATIONAL LATENCY PROFILING
    # =========================================================================
    s19 = prs.slides.add_slide(blank_layout)
    add_header(s19, "Computational Latency Profiling & Edge Feasibility", "Performance Profiling")

    fig4_path = os.path.join(figures_dir, "fig4_inference_latency_distribution.png")
    if os.path.exists(fig4_path):
        s19.shapes.add_picture(fig4_path, Inches(0.8), Inches(1.6), width=Inches(6.2))
    else:
        create_card(s19, Inches(0.8), Inches(1.6), Inches(6.2), Inches(5.2), "Latency Distribution Graph")

    create_card(s19, Inches(7.3), Inches(1.6), Inches(5.233), Inches(5.2), "Measured Latency Benchmarks")
    tb = s19.shapes.add_textbox(Inches(7.5), Inches(2.2), Inches(4.833), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    lat_bench = [
        "• Single-Agent Decision Latency: 17.61 microseconds.",
        "• Joint 9-Agent Policy Forward Pass: 158.52 microseconds (Median: 156.35 us, P95: 172.54 us).",
        "• Flask API Round-Trip (Neural): 0.369 ms mean, 0.444 ms P95.",
        "• Cold Checkpoint Disk Load: 113.85 ms (one-time on startup).",
        "• Startup Pre-Warm Dummy Pass: 0.480 ms.",
        "• Real-Time SLA Budget: < 50.0 ms. Measured execution is > 200x faster than SLA budget!"
    ]
    for pt in lat_bench:
        p = tf.add_paragraph() if tf.paragraphs[0].text else tf.paragraphs[0]
        p.text = pt
        p.font.size = Pt(12.5)
        p.font.color.rgb = DARK_GRAY
        p.space_before = Pt(6)

    # =========================================================================
    # SLIDE 20: LIMITATIONS & THREATS TO VALIDITY
    # =========================================================================
    s20 = prs.slides.add_slide(blank_layout)
    add_header(s20, "Academic Transparency: Limitations & Threats to Validity", "Critical Reflection")

    threats = [
        ("Exploratory 30-Episode Budget", "While training loss was stabilized (MSE <= 4.04), 30 episodes (3,600 transitions) represent early exploration. Asymptotic policy convergence on complex graphs requires 500+ episodes."),
        ("Macro-Queuing vs Microscopic Traffic", "Simulation models cruising delay via the reciprocal formula eta = e / (1 - delta/sigma). While theoretically grounded, it does not simulate lane-changing, signal timing, or pedestrian crossings."),
        ("Continuous Action Over-Smoothing", "Continuous actor logits in [0, 1] decoded via argmax can suffer from policy over-smoothing in uniform demand, making greedy discrete heuristics like FIFO perform better."),
        ("Small Sample Size in Ablations", "Ablations were conducted across N=5 seeds due to compute budgets. While GRU degradation was highly significant (p = 3.03 x 10^-6), No-GAT differences were not statistically significant after Holm-Bonferroni correction.")
    ]
    for i, (title, desc) in enumerate(threats):
        top_pos = Inches(1.6 + i * 1.3)
        create_card(s20, Inches(0.8), top_pos, Inches(11.733), Inches(1.15), title)
        tb = s20.shapes.add_textbox(Inches(1.0), top_pos + Inches(0.45), Inches(11.3), Inches(0.6))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(13)
        p.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 21: FUTURE WORK & SCALING ROADMAP
    # =========================================================================
    s21 = prs.slides.add_slide(blank_layout)
    add_header(s21, "Future Work & Long-Term Scaling Roadmap", "Future Directions")

    future_items = [
        ("1. Scaled Curriculum Training (500+ Episodes)", "Execute multi-stage curriculum training with prioritized trajectory replay to determine whether extended learning enables MARL to match or surpass deterministic FIFO under dynamic surges."),
        ("2. Discrete Multi-Agent Parameterization", "Investigate discrete multi-agent architectures (e.g. QMIX or MAPPO) to evaluate whether discrete stall selection eliminates continuous policy over-smoothing."),
        ("3. Microscopic Traffic Co-Simulation (SUMO)", "Couple the PyTorch policy with microscopic SUMO or CityFlow simulation to capture individual vehicle lane changes, intersection delays, and driver visual scanning behavior."),
        ("4. Simulation-to-Real Domain Adaptation", "Bridge the gap between the municipal 541-bay simulation and the physical 5-stall campus IoT testbed using domain adaptation and offline reinforcement learning.")
    ]
    for i, (title, desc) in enumerate(future_items):
        top_pos = Inches(1.6 + i * 1.3)
        create_card(s21, Inches(0.8), top_pos, Inches(11.733), Inches(1.15), title)
        tb = s21.shapes.add_textbox(Inches(1.0), top_pos + Inches(0.45), Inches(11.3), Inches(0.6))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(13)
        p.font.color.rgb = DARK_GRAY

    # =========================================================================
    # SLIDE 22: CONCLUSION & Q&A
    # =========================================================================
    s22 = prs.slides.add_slide(blank_layout)
    bg22 = s22.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg22.fill.solid()
    bg22.fill.fore_color.rgb = NAVY
    bg22.line.fill.background()

    tb22 = s22.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.333), Inches(5.2))
    tf22 = tb22.text_frame
    tf22.word_wrap = True

    p = tf22.paragraphs[0]
    p.text = "CONCLUSIONS & VIVA EXAMINATION"
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = WHITE

    conclusions = [
        "1. Complete Paper-Aligned Implementation: Built all 10 modules of Zhao & Yan (2025) MARL-GCN in PyTorch.",
        "2. Resolution of Bellman Divergence: Twin-Critic Double-Q, reward scaling & gradient clipping bounded critic loss (<= 4.04).",
        "3. Statistical Rigor & Scientific Honesty: Benchmarked across 8 scenarios (240 episodes); confirmed 100% allocation and transparently reported FIFO queuing advantages.",
        "4. Ablation Isolation: Proved temporal GRU is indispensable (+545.5% delay surge when removed, p = 3.03 x 10^-6).",
        "5. Production Full-Stack Integration: Integrated with Expo mobile app, Flask backend, and fail-closed Firebase concurrency.",
        "6. Sub-Millisecond Latency: Measured 158.5 us CPU execution, proving complete feasibility for edge ITS deployment."
    ]
    for c in conclusions:
        pc = tf22.add_paragraph()
        pc.text = c
        pc.font.size = Pt(14)
        pc.font.color.rgb = RGBColor(226, 232, 240)
        pc.space_before = Pt(10)

    p_qa = tf22.add_paragraph()
    p_qa.text = "\nThank You! Questions & Discussion are warmly welcomed."
    p_qa.font.size = Pt(18)
    p_qa.font.bold = True
    p_qa.font.color.rgb = RGBColor(147, 197, 253)
    p_qa.space_before = Pt(20)

    # Save presentation
    output_path = "SMART_PARKING_BTP_FINAL_PRESENTATION.pptx"
    prs.save(output_path)
    print(f"✅ Generated {len(prs.slides)}-slide BTP Final Presentation: {output_path}")

if __name__ == "__main__":
    build_presentation()

