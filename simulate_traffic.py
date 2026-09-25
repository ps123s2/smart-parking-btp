import requests
import time
import random

BASE_URL = 'https://smart-parking-d2d85-default-rtdb.asia-southeast1.firebasedatabase.app'

print("Starting realistic traffic simulation...", flush=True)

while True:
    try:
        # Get current states
        r = requests.get(f'{BASE_URL}/data.json')
        data = r.json()
        states = data.get('states', [1, 1, 1, 1, 1])
        
        # Randomly change 1 slot (either free or occupy)
        idx = random.randint(0, 4)
        
        # 70% chance to stay the same, 30% chance to flip
        if random.random() < 0.3:
            old_state = states[idx]
            new_state = 0 if old_state == 1 else 1
            states[idx] = new_state
            
            print(f"Slot {idx+1} changed to {'OCCUPIED' if new_state == 1 else 'FREE'}")
            
            # Send to API instead of Firebase directly to trigger sensors
            requests.post('http://localhost:5000/api/parking/update', json={
                'slot_id': f'slot{idx+1}',
                'distance': 15.0 if new_state == 1 else 150.0,
                'occupied': new_state == 1
            })
            
        time.sleep(5)
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(5)
