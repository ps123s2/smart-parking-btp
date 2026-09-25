#!/usr/bin/env python3
"""
Smart Parking - Ultrasonic Sensor Simulator
Simulates sensor data and sends it to the Python API
Useful for testing without physical hardware or Wokwi simulation
"""

import requests
import json
import time
import math
import argparse
from datetime import datetime

# Configuration
API_SERVER = "http://localhost:5000"
UPDATE_ENDPOINT = "/api/parking/update"

class SensorSimulator:
    """Simulates ultrasonic sensor readings"""
    
    def __init__(self, slot_id="slot1", threshold=50, update_interval=2):
        self.slot_id = slot_id
        self.threshold = threshold
        self.update_interval = update_interval
        self.api_url = API_SERVER + UPDATE_ENDPOINT
        self.simulation_time = 0
        self.occupied_state = False
        
    def generate_distance(self, mode="sine"):
        """Generate simulated distance reading"""
        if mode == "sine":
            # Sine wave between 20-100 cm
            distance = 60 + 40 * math.sin(self.simulation_time * 0.05)
        elif mode == "step":
            # Step function - alternates between near and far
            distance = 30 if (self.simulation_time // 10) % 2 == 0 else 80
        elif mode == "random":
            # Random between 20-150 cm
            import random
            distance = random.uniform(20, 150)
        else:
            distance = 100
        
        return max(5, min(distance, 400))  # Clamp to valid range
    
    def update_server(self, distance):
        """Send distance data to API server"""
        occupied = distance < self.threshold
        
        payload = {
            "slot_id": self.slot_id,
            "distance": round(distance, 1),
            "occupied": occupied,
            "available": not occupied,
            "timestamp": int(time.time() * 1000)
        }
        
        try:
            response = requests.post(
                self.api_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            
            status_icon = "✓" if response.status_code in [200, 201] else "✗"
            status_text = "occupied" if occupied else "available"
            
            print(f"{status_icon} [{datetime.now().strftime('%H:%M:%S')}] "
                  f"Distance: {distance:.1f}cm → {status_text} | "
                  f"Response: {response.status_code}")
            
            if response.status_code not in [200, 201]:
                print(f"  Error: {response.text}")
                
            # Track state changes
            if occupied != self.occupied_state:
                print(f"  🔔 Status Changed: {'🚗 OCCUPIED' if occupied else '✓ AVAILABLE'}")
                self.occupied_state = occupied
                
            return True
        except requests.exceptions.ConnectionError:
            print(f"✗ [{datetime.now().strftime('%H:%M:%S')}] "
                  f"Cannot connect to API at {self.api_url}")
            return False
        except Exception as e:
            print(f"✗ [{datetime.now().strftime('%H:%M:%S')}] Error: {e}")
            return False
    
    def run(self, duration=None, mode="sine", num_cycles=None):
        """Run simulation for specified duration or cycles"""
        print("\n" + "="*60)
        print("🚗 Smart Parking - Sensor Simulator")
        print("="*60)
        print(f"📡 Target: {self.api_url}")
        print(f"📌 Slot ID: {self.slot_id}")
        print(f"📏 Threshold: {self.threshold} cm")
        print(f"⏱️  Update interval: {self.update_interval}s")
        print(f"📊 Simulation mode: {mode}")
        if num_cycles:
            print(f"🔁 Cycles: {num_cycles}")
        if duration:
            print(f"⏳ Duration: {duration}s")
        print("="*60)
        print("Press Ctrl+C to stop\n")
        
        start_time = time.time()
        cycle_count = 0
        
        try:
            while True:
                # Check duration limit
                if duration and (time.time() - start_time) > duration:
                    break
                
                # Check cycle limit
                if num_cycles and cycle_count >= num_cycles:
                    break
                
                # Generate and send distance
                distance = self.generate_distance(mode)
                success = self.update_server(distance)
                
                if success:
                    cycle_count += 1
                
                # Wait before next update
                time.sleep(self.update_interval)
                self.simulation_time += self.update_interval
                
        except KeyboardInterrupt:
            print("\n\n⏹️  Simulation stopped by user")
        
        # Summary
        elapsed = time.time() - start_time
        print("\n" + "="*60)
        print("📊 Simulation Summary")
        print("="*60)
        print(f"Duration: {elapsed:.1f}s")
        print(f"Cycles: {cycle_count}")
        print(f"Average frequency: {cycle_count/elapsed:.2f} Hz")
        print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description="Smart Parking - Ultrasonic Sensor Simulator"
    )
    parser.add_argument(
        "--slot", "-s",
        default="slot1",
        help="Parking slot ID (default: slot1)"
    )
    parser.add_argument(
        "--threshold", "-t",
        type=float,
        default=50,
        help="Distance threshold for occupancy in cm (default: 50)"
    )
    parser.add_argument(
        "--interval", "-i",
        type=float,
        default=2,
        help="Update interval in seconds (default: 2)"
    )
    parser.add_argument(
        "--duration", "-d",
        type=float,
        help="Simulation duration in seconds"
    )
    parser.add_argument(
        "--cycles", "-c",
        type=int,
        help="Number of cycles to run"
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["sine", "step", "random"],
        default="sine",
        help="Simulation mode (default: sine)"
    )
    parser.add_argument(
        "--server",
        default="http://localhost:5000",
        help="API server URL (default: http://localhost:5000)"
    )
    
    args = parser.parse_args()
    
    # Override global API_SERVER
    global API_SERVER
    API_SERVER = args.server
    
    # Create and run simulator
    simulator = SensorSimulator(
        slot_id=args.slot,
        threshold=args.threshold,
        update_interval=args.interval
    )
    
    simulator.run(
        duration=args.duration,
        mode=args.mode,
        num_cycles=args.cycles
    )


if __name__ == "__main__":
    main()
