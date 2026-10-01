import cv2  # type: ignore[import]
from deepface import DeepFace  # type: ignore[import]

# Load the Haar cascade classifier for face detection
# Ensure 'haarcascade_frontalface_default.xml' is in your project directory
face_cascade = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')

# Start capturing video from the default webcam (index 0)
cap = cv2.VideoCapture(0)

print("Camera feed opened. Press 'q' to quit.")

while True:
    # Capture frame-by-frame
    ret, frame = cap.read()
    if not ret:
        break

    # Convert the frame to grayscale for face detection
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Detect faces in the grayscale frame
    faces = face_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    # Perform emotion analysis on each detected face
    for (x, y, w, h) in faces:
        # Extract the region of interest (face)
        face_roi = frame[y:y + h, x:x + w]  # type: ignore[index]
        
        try:
            # Analyze emotion using DeepFace (enforce_detection=False prevents DeepFace from re-detecting faces internally, 
            # as we've already done it with Haar Cascade)
            result = DeepFace.analyze(face_roi, actions=['emotion'], enforce_detection=False)
            
            # Get the dominant emotion
            emotion = result[0]['dominant_emotion']
            
            # Draw a rectangle around the face and label it with the emotion
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
            cv2.putText(frame, emotion, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
        
        except ValueError:
            # Handle cases where DeepFace might not find a face in the ROI (rare with good detection)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 0, 255), 2)
            cv2.putText(frame, "No emotion detected", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)


    # Display the resulting frame
    cv2.imshow('Real-time Emotion Detection', frame)

    # Break the loop when 'q' key is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release the capture and close all OpenCV windows
cap.release()
cv2.destroyAllWindows()
