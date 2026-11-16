# Reproducibility Guide: Paper-Aligned Research Implementation

This document provides exact, non-destructive commands to reproduce all unit tests, training runs, and benchmark evaluations for the paper-aligned implementation in `research/paper_aligned/`.

---

## 1. Environment Requirements

- **Python Version:** Python 3.11+
- **Key Libraries:** PyTorch 2.1+, NumPy 1.24+, SciPy 1.10+
- **Execution Environment:** `/opt/anaconda3/envs/smart-parking-ml/bin/python`

---

## 2. Command Reference

### 2.1 Run Architecture and Integration Tests (15 Tests)
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python -m unittest research/paper_aligned/test_paper_aligned.py -v
```
*Expected Output:* Ran 15 tests in ~0.85s. All tests OK.

### 2.2 Run Multi-Agent Training (CTDE MADDPG)
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python research/paper_aligned/train_maddpg.py
```
*Outputs Generated:*
- Checkpoints: `research/paper_aligned/checkpoints/best_maddpg_seed_42.pt`, `final_maddpg_seed_42.pt`
- Training Log: `research/paper_aligned/logs/training_log_maddpg_seed_42.csv`
- Training Summary: `research/paper_aligned/checkpoints/training_summary_maddpg_seed_42.json`

### 2.3 Run Comparative Benchmark (MADDPG vs. FIFO vs. SIRO)
```bash
PYTHONPATH=. /opt/anaconda3/envs/smart-parking-ml/bin/python research/paper_aligned/run_experiments.py
```
*Outputs Generated:*
- Raw & Summary Results: `research/paper_aligned/results/benchmark_comparison_results.json`

---

## 3. Preservation Verification

Verify that all pre-existing baseline research files remain cryptographically untouched:
```bash
python3 -c "
import hashlib
hashes = {
    'smart_parking_ai/models/research/scenario_data.py': '4e905f224e766b20e365b29e744400b605afc66282e89fa07af5e3f990716222',
    'smart_parking_ai/models/research/sim_env.py': 'a2140cae042bf4138cee89930c2e630ba3e0a0faab700a811653fca7b89c7783',
    'smart_parking_ai/models/research/baselines.py': '34d6739684d103c4fa31c04a875f8b0b2914535f36950fd1c4cb5d6fca15353b'
}
for p, h in hashes.items():
    with open(p, 'rb') as f:
        print(p, hashlib.sha256(f.read()).hexdigest() == h)
"
```
*Expected Output:* All files return `True`.

