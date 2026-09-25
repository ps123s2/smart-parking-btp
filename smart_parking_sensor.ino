#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// WiFi credentials
#define WIFI_SSID "your_ssid"
#define WIFI_PASSWORD "your_password"

// Firebase configuration
#define API_KEY "your_firebase_api_key"
#define DATABASE_URL "your_firebase_database_url"
#define USER_EMAIL "your_email@example.com"
#define USER_PASSWORD "your_password"

// Pin definitions for ultrasonic sensor
#define TRIG_PIN 5    // GPIO5 - D1 on ESP32
#define ECHO_PIN 18   // GPIO18 - D8 on ESP32

// Thresholds and configuration
#define DISTANCE_THRESHOLD 50  // cm - if distance < 50cm, slot is occupied
#define UPDATE_INTERVAL 1000   // ms - update Firebase every 1-2 seconds
#define MAX_DISTANCE 400       // cm - max sensor range

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Variables
unsigned long lastUpdateTime = 0;
bool previousOccupied = false;
String slotId = "slot1";  // Change this for different slots

// Function to measure distance from ultrasonic sensor
float readUltrasonicDistance() {
  // Clear the trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  
  // Set the trigger pin high for 10 microseconds
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Read the echo pin - time in microseconds
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  
  // Calculate distance: distance = (time * speed_of_sound) / 2
  // Speed of sound = 343 m/s = 0.0343 cm/us
  float distance = (duration * 0.0343) / 2;
  
  return distance;
}

// Function to update Firebase with occupancy status
void updateFirebaseOccupancy(float distance, bool occupied) {
  if (!Firebase.ready()) {
    Serial.println("Firebase not ready!");
    return;
  }

  // Build the path for Firebase update
  String path = "parking_lot/" + slotId;
  
  // Create JSON object with parking data
  FirebaseJson json;
  json.set("distance", distance);
  json.set("occupied", occupied);
  json.set("timestamp", (double)millis());
  json.set("status", occupied ? "occupied" : "available");
  
  // Update Firebase
  if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
    Serial.println("✓ Firebase updated successfully");
    Serial.print("  Distance: ");
    Serial.print(distance);
    Serial.print(" cm, Status: ");
    Serial.println(occupied ? "OCCUPIED" : "AVAILABLE");
  } else {
    Serial.print("✗ Firebase update failed: ");
    Serial.println(fbdo.errorReason());
  }
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
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi connection failed!");
  }
}

// Function to initialize Firebase
void initializeFirebase() {
  Serial.println("Initializing Firebase...");
  
  // Configure Firebase API key
  config.api_key = API_KEY;

  // Assign the RTDB URL
  config.database_url = DATABASE_URL;

  // Assign the user sign-in credentials
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  // Assign the callback function for the long running token generation task
  config.token_status_callback = tokenStatusCallback;

  // Assign Firebase config
  Firebase.begin(&config, &auth);

  // Enable reconnect
  Firebase.reconnectWiFi(true);
  
  Serial.println("Firebase initialized!");
}

// Token status callback
void tokenStatusCallback(token_info_t info) {
  if (info.status == token_status_ready) {
    Serial.println("✓ Firebase token ready");
  } else if (info.status == token_status_error) {
    Serial.print("✗ Firebase token error: ");
    Serial.println(info.error.message.c_str());
  }
}

void setup() {
  // Initialize Serial for debugging
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n🚗 Smart Parking - Ultrasonic Sensor Setup");
  Serial.println("==========================================");
  
  // Initialize pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  Serial.print("TRIG pin: ");
  Serial.println(TRIG_PIN);
  Serial.print("ECHO pin: ");
  Serial.println(ECHO_PIN);
  Serial.print("Distance threshold: ");
  Serial.print(DISTANCE_THRESHOLD);
  Serial.println(" cm");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Initialize Firebase
  initializeFirebase();
  
  Serial.println("✓ Setup complete - Starting sensor loop\n");
}

void loop() {
  // Check if enough time has passed since last update
  unsigned long currentTime = millis();
  
  if (currentTime - lastUpdateTime >= UPDATE_INTERVAL) {
    // Read distance from ultrasonic sensor
    float distance = readUltrasonicDistance();
    
    // Validate distance reading
    if (distance <= 0 || distance > MAX_DISTANCE) {
      Serial.println("⚠ Invalid distance reading (too far or error)");
      distance = MAX_DISTANCE;  // Treat as available
    }
    
    // Determine occupancy based on distance threshold
    bool occupied = (distance < DISTANCE_THRESHOLD);
    
    // Log sensor reading
    Serial.print("[");
    Serial.print(currentTime / 1000);
    Serial.print("s] Distance: ");
    Serial.print(distance, 1);
    Serial.print(" cm → ");
    Serial.println(occupied ? "OCCUPIED 🚗" : "AVAILABLE ✓");
    
    // Update Firebase if status changed or periodically
    if (occupied != previousOccupied || (currentTime - lastUpdateTime > 5000)) {
      updateFirebaseOccupancy(distance, occupied);
      previousOccupied = occupied;
    }
    
    // Update timestamp
    lastUpdateTime = currentTime;
  }
  
  // Small delay to prevent overwhelming the CPU
  delay(100);
}
