#include <WiFi.h>
#include <HTTPClient.h>

// WiFi credentials
#define WIFI_SSID "your_ssid"
#define WIFI_PASSWORD "your_password"

// API Server
#define API_SERVER "http://192.168.1.100:5000"  // Change to your Python API server IP
#define UPDATE_PATH "/api/parking/update"

// Pin definitions for ultrasonic sensor
#define TRIG_PIN 5    // GPIO5
#define ECHO_PIN 18   // GPIO18

// Configuration
#define DISTANCE_THRESHOLD 50  // cm - occupied if < 50cm
#define UPDATE_INTERVAL 2000   // ms - update every 2 seconds
#define MAX_DISTANCE 400       // cm - max sensor range
#define SLOT_ID "slot1"        // Parking slot identifier

// Variables
unsigned long lastUpdateTime = 0;
bool previousOccupied = false;
WiFiClient wifiClient;

// Function to measure distance from ultrasonic sensor
float readUltrasonicDistance() {
  // Clear trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  
  // Send pulse
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Read echo duration in microseconds
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  
  if (duration == 0) {
    return -1;  // Invalid reading
  }
  
  // Calculate distance: (time * speed of sound) / 2
  // Speed of sound ≈ 343 m/s = 0.0343 cm/microsecond
  float distance = (duration * 0.0343) / 2.0;
  
  return distance;
}

// Function to send data to Python API via HTTP POST
void updateServerOccupancy(float distance, bool occupied) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✗ WiFi not connected!");
    return;
  }

  HTTPClient http;
  
  // Build JSON payload
  String payload = "{";
  payload += "\"slot_id\": \"" + String(SLOT_ID) + "\",";
  payload += "\"distance\": " + String(distance, 2) + ",";
  payload += "\"occupied\": " + String(occupied ? "true" : "false") + ",";
  payload += "\"available\": " + String(!occupied ? "true" : "false") + ",";
  payload += "\"timestamp\": " + String(millis());
  payload += "}";
  
  // Send HTTP POST request
  Serial.print("→ Sending: ");
  Serial.print(payload);
  Serial.print(" to ");
  Serial.println(API_SERVER);
  
  http.begin(wifiClient, API_SERVER + String(UPDATE_PATH));
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200 || httpCode == 201) {
    Serial.println("✓ Server updated successfully");
    String response = http.getString();
    Serial.print("  Response: ");
    Serial.println(response);
  } else {
    Serial.print("✗ HTTP Error: ");
    Serial.println(httpCode);
  }
  
  http.end();
}

// Function to connect to WiFi
void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✓ WiFi connected!");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("✗ WiFi connection failed!");
    Serial.println("  Check SSID and password");
  }
}

void setup() {
  // Initialize Serial
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n╔════════════════════════════════════════╗");
  Serial.println("║  🚗 Smart Parking - Sensor Firmware    ║");
  Serial.println("║  Ultrasonic Distance → Firebase Update  ║");
  Serial.println("╚════════════════════════════════════════╝\n");
  
  // Initialize sensor pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  Serial.println("📌 Configuration:");
  Serial.print("   • TRIG Pin: GPIO");
  Serial.println(TRIG_PIN);
  Serial.print("   • ECHO Pin: GPIO");
  Serial.println(ECHO_PIN);
  Serial.print("   • Distance Threshold: ");
  Serial.print(DISTANCE_THRESHOLD);
  Serial.println(" cm (occupied if < threshold)");
  Serial.print("   • Update Interval: ");
  Serial.print(UPDATE_INTERVAL);
  Serial.println(" ms");
  Serial.print("   • Slot ID: ");
  Serial.println(SLOT_ID);
  
  // Connect to WiFi
  Serial.println("\n🌐 Network Setup:");
  connectToWiFi();
  
  Serial.println("\n✓ Setup complete - Starting sensor loop...\n");
  Serial.println("Distance | Status | Firebase Update");
  Serial.println("---------|--------|------------------");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Check if ready for next update
  if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
    
    // Read ultrasonic sensor
    float distance = readUltrasonicDistance();
    
    // Validate reading
    if (distance < 0 || distance > MAX_DISTANCE) {
      Serial.println("⚠ Invalid reading - retrying");
      delay(100);
      return;
    }
    
    // Determine occupancy status
    bool occupied = (distance < DISTANCE_THRESHOLD);
    
    // Print sensor data with formatting
    Serial.print(distance, 1);
    Serial.print(" cm    | ");
    Serial.print(occupied ? "🚗 OCC " : "✓ FREE ");
    Serial.print("| ");
    
    // Check if status changed or send periodic update
    if (occupied != previousOccupied) {
      Serial.println("Status Changed ✓");
      updateServerOccupancy(distance, occupied);
      previousOccupied = occupied;
    } else {
      Serial.println("No change");
    }
    
    lastUpdateTime = currentTime;
  }
  
  delay(50);  // Small delay to prevent CPU overload
}
