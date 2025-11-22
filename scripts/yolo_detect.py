#!/usr/bin/env python3
"""
YOLOv8 Detection Script
Runs object detection and returns JSON results with annotated image
"""

import sys
import json
import os
from ultralytics import YOLO

# Suppress YOLO verbose output
os.environ['YOLO_VERBOSE'] = 'False'

def detect_objects(model_path, image_path, output_path):
    try:
        # Load model
        model = YOLO(model_path)
        
        # Run inference with verbose=False
        results = model(image_path, verbose=False)
        
        # Get detections
        result = results[0]
        
        # Save annotated image
        annotated = result.plot()
        from PIL import Image
        import numpy as np
        img = Image.fromarray(annotated[..., ::-1])  # BGR to RGB
        img.save(output_path)
        
        # Extract detection information
        detections = []
        boxes = result.boxes
        
        for box in boxes:
            # Get box coordinates
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            # Get class and confidence
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            class_name = model.names[cls_id]
            
            detections.append({
                "className": class_name,
                "confidence": conf,
                "bbox": {
                    "x": int(x1),
                    "y": int(y1),
                    "width": int(x2 - x1),
                    "height": int(y2 - y1)
                }
            })
        
        # Return JSON
        output = {
            "detections": detections
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "detections": []
        }
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: python yolo_detect.py <model_path> <image_path> <output_path>"}))
        sys.exit(1)
    
    model_path = sys.argv[1]
    image_path = sys.argv[2]
    output_path = sys.argv[3]
    
    detect_objects(model_path, image_path, output_path)
