"""
Distraction Detection System
Detects when user is not looking at the screen (face turned left/right or no face visible)
and displays a distraction warning message.

Uses OpenCV's Haar Cascade classifiers for face and eye detection.
"""

import cv2  # type: ignore[import]
import numpy as np  # type: ignore[import]
import time
from collections import deque

class DistractionDetector:
    def __init__(self, distraction_time_threshold=1.5):
        """
        Initialize the distraction detector.
        
        Args:
            distraction_time_threshold: Time in seconds before showing distraction warning
        """
        self.distraction_time_threshold = distraction_time_threshold
        
        # Tracking variables
        self.distraction_start_time = None
        self.is_distracted = False
        self.face_position_history = deque(maxlen=10)  # Smooth out readings
        
        # Load Haar Cascade classifiers
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
        self.profile_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_profileface.xml'
        )
    
    def detect_head_pose(self, frame, face):
        """
        Estimate head pose based on face position and eye detection.
        Returns: 'center', 'left', 'right', or 'away'
        """
        x, y, w, h = face
        frame_height, frame_width = frame.shape[:2]
        
        # Get face region
        face_roi_gray = cv2.cvtColor(frame[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)
        
        # Detect eyes in face region
        eyes = self.eye_cascade.detectMultiScale(
            face_roi_gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(int(w*0.1), int(h*0.05))
        )
        
        # Calculate face center position relative to frame
        face_center_x = x + w // 2
        frame_center_x = frame_width // 2
        
        # Calculate offset percentage
        offset_percent = (face_center_x - frame_center_x) / (frame_width / 2) * 100
        
        # Add to history for smoothing
        self.face_position_history.append(offset_percent)
        avg_offset = np.mean(self.face_position_history)
        
        # Determine if looking away based on:
        # 1. Face position (too far left/right)
        # 2. Number of eyes visible (if turned, fewer eyes visible)
        
        if len(eyes) < 2:
            # Profile view - likely turned
            if avg_offset > 20:
                return 'right', avg_offset, len(eyes)
            elif avg_offset < -20:
                return 'left', avg_offset, len(eyes)
            else:
                # Face in center but only one eye - could be turning
                return 'turning', avg_offset, len(eyes)
        else:
            # Both eyes visible - likely facing camera
            if abs(avg_offset) > 35:
                if avg_offset > 0:
                    return 'right', avg_offset, len(eyes)
                else:
                    return 'left', avg_offset, len(eyes)
            return 'center', avg_offset, len(eyes)
    
    def process_frame(self, frame):
        """
        Process a single frame and return distraction status.
        Returns: (is_distracted, face_detected, pose, offset, eyes_count, faces)
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect frontal faces
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(100, 100)
        )
        
        # Also try to detect profile faces if no frontal face found
        if len(faces) == 0:
            # Check left profile
            profiles_left = self.profile_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(100, 100)
            )
            
            # Check right profile (flip and detect)
            flipped = cv2.flip(gray, 1)
            profiles_right = self.profile_cascade.detectMultiScale(
                flipped,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(100, 100)
            )
            
            if len(profiles_left) > 0 or len(profiles_right) > 0:
                # Profile detected - user is turned
                current_time = time.time()
                if self.distraction_start_time is None:
                    self.distraction_start_time = current_time
                elif current_time - self.distraction_start_time >= self.distraction_time_threshold:
                    self.is_distracted = True
                
                direction = 'left' if len(profiles_left) > 0 else 'right'
                return self.is_distracted, True, direction, 50 if direction == 'right' else -50, 0, []
        
        # No face detected at all
        if len(faces) == 0:
            current_time = time.time()
            if self.distraction_start_time is None:
                self.distraction_start_time = current_time
            elif current_time - self.distraction_start_time >= self.distraction_time_threshold:
                self.is_distracted = True
            return self.is_distracted, False, 'away', 0, 0, []
        
        # Face detected - analyze pose
        face = faces[0]  # Use the first/largest face
        pose, offset, eyes_count = self.detect_head_pose(frame, face)
        
        # Determine if distracted based on pose
        if pose in ['left', 'right', 'turning']:
            current_time = time.time()
            if self.distraction_start_time is None:
                self.distraction_start_time = current_time
            elif current_time - self.distraction_start_time >= self.distraction_time_threshold:
                self.is_distracted = True
        else:
            # Looking at screen
            self.distraction_start_time = None
            self.is_distracted = False
        
        return self.is_distracted, True, pose, offset, eyes_count, faces


def draw_distraction_warning(frame):
    """
    Draw a distraction warning overlay on the frame.
    """
    h, w = frame.shape[:2]
    
    # Create semi-transparent red overlay
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), (0, 0, 150), -1)
    cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
    
    # Warning box dimensions
    box_w, box_h = 500, 150
    box_x = (w - box_w) // 2
    box_y = (h - box_h) // 2
    
    # Draw warning box with border
    cv2.rectangle(frame, (box_x, box_y), (box_x + box_w, box_y + box_h), (0, 0, 200), -1)
    cv2.rectangle(frame, (box_x, box_y), (box_x + box_w, box_y + box_h), (255, 255, 255), 3)
    
    # Warning icon (triangle)
    triangle_pts = np.array([
        [w // 2, box_y + 20],
        [w // 2 - 25, box_y + 60],
        [w // 2 + 25, box_y + 60]
    ], np.int32)
    cv2.fillPoly(frame, [triangle_pts], (0, 255, 255))
    cv2.putText(frame, "!", (w // 2 - 8, box_y + 55), 
                cv2.FONT_HERSHEY_BOLD, 1.2, (0, 0, 0), 3)
    
    # Warning text
    cv2.putText(frame, "DISTRACTION DETECTED!", 
                (box_x + 60, box_y + 100),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
    cv2.putText(frame, "Please look at the screen", 
                (box_x + 100, box_y + 130),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
    
    return frame


def draw_status_info(frame, face_detected, pose, offset, eyes_count, is_distracted, faces):
    """
    Draw status information and face detection boxes on the frame.
    """
    h, w = frame.shape[:2]
    
    # Draw face detection boxes
    for (x, y, fw, fh) in faces:
        color = (0, 255, 0) if not is_distracted else (0, 0, 255)
        cv2.rectangle(frame, (x, y), (x+fw, y+fh), color, 2)
        
        # Draw center line indicator
        face_center = x + fw // 2
        cv2.line(frame, (face_center, y), (face_center, y + fh), (255, 255, 0), 1)
    
    # Draw center reference line
    cv2.line(frame, (w // 2, 0), (w // 2, h), (100, 100, 100), 1)
    
    # Status panel background
    cv2.rectangle(frame, (10, 10), (320, 150), (0, 0, 0), -1)
    cv2.rectangle(frame, (10, 10), (320, 150), (100, 100, 100), 1)
    
    # Face detection status
    face_status = "Face: Detected" if face_detected else "Face: Not Detected"
    face_color = (0, 255, 0) if face_detected else (0, 0, 255)
    cv2.putText(frame, face_status, (20, 35), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, face_color, 2)
    
    # Pose status
    pose_text = f"Head Pose: {pose.upper()}"
    pose_color = (0, 255, 0) if pose == 'center' else (0, 165, 255)
    cv2.putText(frame, pose_text, (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, pose_color, 1)
    
    # Offset indicator
    cv2.putText(frame, f"Offset: {offset:.1f}%", (20, 85),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    # Eyes count
    cv2.putText(frame, f"Eyes Detected: {eyes_count}", (20, 110),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    # Attention status
    attention_status = "Status: DISTRACTED!" if is_distracted else "Status: FOCUSED"
    attention_color = (0, 0, 255) if is_distracted else (0, 255, 0)
    cv2.putText(frame, attention_status, (20, 140),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, attention_color, 2)
    
    # Instructions at bottom
    cv2.putText(frame, "Press 'Q' to quit | Press 'R' to reset", 
                (w // 2 - 180, h - 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
    
    return frame


def main():
    """
    Main function to run the distraction detection system.
    """
    print("=" * 55)
    print("   DISTRACTION DETECTION SYSTEM - NeuroNest")
    print("=" * 55)
    print("\nInitializing camera and face detection...")
    
    # Initialize camera
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open camera!")
        print("Please make sure your camera is connected and not in use.")
        return
    
    # Set camera properties for better performance
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    # Initialize distraction detector
    detector = DistractionDetector(
        distraction_time_threshold=1.5  # Seconds before warning
    )
    
    print("\n[SUCCESS] System ready!")
    print("\n" + "-" * 55)
    print("HOW IT WORKS:")
    print("-" * 55)
    print("  - Look straight at the screen = FOCUSED (green)")
    print("  - Turn head left/right      = DISTRACTED (red)")
    print("  - Face not visible          = DISTRACTED (red)")
    print("-" * 55)
    print("\nCONTROLS:")
    print("  Q - Quit the application")
    print("  R - Reset distraction timer")
    print("-" * 55 + "\n")
    
    while True:
        ret, frame = cap.read()
        
        if not ret:
            print("Error: Could not read frame!")
            break
        
        # Flip frame horizontally for mirror effect
        frame = cv2.flip(frame, 1)
        
        # Process frame for distraction detection
        is_distracted, face_detected, pose, offset, eyes_count, faces = detector.process_frame(frame)
        
        # Draw status information
        frame = draw_status_info(frame, face_detected, pose, offset, eyes_count, is_distracted, faces)
        
        # Draw distraction warning if needed
        if is_distracted:
            frame = draw_distraction_warning(frame)
        
        # Display frame
        cv2.imshow('Distraction Detection - NeuroNest', frame)
        
        # Handle keyboard input
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q') or key == ord('Q'):
            print("\n[INFO] Shutting down...")
            break
        elif key == ord('r') or key == ord('R'):
            detector.distraction_start_time = None
            detector.is_distracted = False
            detector.face_position_history.clear()
            print("[INFO] Distraction timer reset!")
    
    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Distraction detection stopped.")


if __name__ == "__main__":
    main()
