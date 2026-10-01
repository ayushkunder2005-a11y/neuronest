# NeuroNest AI Engine Architecture

This directory (`ai_engine/api/`) contains the core Python intelligence servers that power the **NeuroNest** application. The system uses a microservice-like architecture where each Python script runs a separate Flask server focused on a specific cognitive or AI task. 

These scripts combine **Computer Vision** (OpenCV, DeepFace) and **Large Language Models** (Gemini, Ollama, OpenAI) to create a highly personalized, adaptive learning environment.

Here is a detailed explanation of what each Python code defines and does. You can use this to explain your project's backend intelligence to others.

---

### 1. `ai_server.py` (The Emotion & Focus Engine)
**Core Purpose:** Real-time facial emotion and focus tracking.
* **What it does:** It runs a Flask + SocketIO server that accepts video frames from the user's webcam. In a background thread, it processes these frames using OpenCV (Haar Cascades for face detection) and DeepFace to detect the user's current emotion (e.g., focused, frustrated, happy) and head pose (looking at the screen vs. distracted). 
* **Project Role:** This data is sent to the Node.js backend to calculate the user's "Focus Score" and dynamically adjust the learning experience if they get bored or frustrated.

### 2. `ai_twin_engine.py` (The Digital Cognitive Twin)
**Core Purpose:** Simulating the user's brain and managing their learning path.
* **What it does:** This is the heaviest logic engine in the project. It builds a "Knowledge Graph" of what the user knows and tracks their strengths and weaknesses. It handles:
  * **Spaced Repetition:** Predicting when the user is about to forget a topic.
  * **Study Planner:** Dynamically generating 7-day personalized study timetables based on the user's availability.
  * **Unified Evaluation:** It uses a dual-LLM approach (Gemini for strict scoring, Ollama for warm, personalized coaching feedback) to grade open-ended answers.

### 3. `ai_tutor_server.py` (The Conversational AI Tutor)
**Core Purpose:** Interactive, ChatGPT-style tutoring with document memory.
* **What it does:** It provides a streaming chat interface for the user to ask questions. 
  * **RAG (Retrieval-Augmented Generation):** It uses `ChromaDB` as a vector database. When a user uploads a PDF, it chunks the text and stores it. When the user asks a question, it searches the database for relevant PDF chunks to provide accurate answers.
  * **Socratic Method:** It uses a massive, highly specific System Prompt to ensure the AI acts like a *coach*, not just an answer generator. It forces the AI to ask questions back, chunk information, and test the user's understanding.

### 4. `tutor_jarvis.py` (The Interview & Document Specialist)
**Core Purpose:** Analyzing uploaded materials and simulating interviews.
* **What it does:** A specialized server that uses Gemini Vision. Instead of just answering questions, it breaks down entire PDFs or Images into structured teaching content.
  * **Interview Training:** It extracts key concepts from a document and generates targeted interview questions. It then evaluates the user's typed answers, providing an accuracy score, identifying missed points, and offering a model "perfect" answer.

### 5. `cognitive_analyzer.py` (The Cognitive Shadow)
**Core Purpose:** A background AI model that predicts mental fatigue and energy.
* **What it does:** It looks at the user's study session metadata (time of day, how long they've been studying, recent quiz scores). 
  * **Brain Weather:** It predicts if the user is in a "High", "Medium", or "Low" cognitive energy state.
  * **Intervention:** If it detects declining performance or extended study times, it sends a recommendation to change strategies (e.g., "Switch to active recall" or "Take a break to prevent burnout").

### 6. `emotion_detection.py` (Local CV Testing Script)
**Core Purpose:** Standalone developmental testing.
* **What it does:** This isn't a web server; it's a raw Python script that opens a local window on your computer using `cv2.imshow()`. 
  * **Utility:** It allows developers to quickly test if the webcam works, if the Haar Cascade XML file is loaded correctly, and if DeepFace is accurately identifying emotions in real time without needing to boot up the entire React/Node.js application stack.

---

### How They Work Together (The Flow)
1. **Input:** The user studies on the React frontend. `ai_server.py` watches their face to ensure they are focused.
2. **Analysis:** `cognitive_analyzer.py` watches the clock and their scores to ensure they aren't burning out.
3. **Execution:** The user asks a question about a PDF. `ai_tutor_server.py` searches its ChromaDB memory and answers using the Socratic method.
4. **Assessment:** `tutor_jarvis.py` gives them an interview question. 
5. **Optimization:** Based on whether they got the answer right or wrong, `ai_twin_engine.py` updates their Knowledge Graph and schedules when they should review that topic again.
