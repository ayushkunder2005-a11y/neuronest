import traceback

out = []
try:
    import google.protobuf as pb

    out.append(f"protobuf=={pb.__version__}")
except Exception as e:
    out.append(f"protobuf import error: {e}")
    out.append(traceback.format_exc())

try:
    import tensorflow as tf

    out.append(f"tensorflow=={tf.__version__}")
except Exception as e:
    out.append(f"tensorflow import error: {e}")
    out.append(traceback.format_exc())

try:
    out.append("mediapipe import OK")
except Exception as e:
    out.append(f"mediapipe import error: {e}")
    out.append(traceback.format_exc())

with open("tools/pip_info.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("wrote tools/pip_info.txt")
