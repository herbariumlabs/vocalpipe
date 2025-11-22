#!/usr/bin/env python3
"""
YOLOv8 Classification Script
Runs classification inference and returns JSON results
"""

import sys
import json
import os
from ultralytics import YOLO

# Suppress YOLO verbose output
os.environ['YOLO_VERBOSE'] = 'False'

def classify_image(model_path, image_path):
    try:
        # Load model
        model = YOLO(model_path)
        
        # Run inference with verbose=False
        results = model(image_path, verbose=False)
        
        # Get predictions
        result = results[0]
        probs = result.probs
        
        # Get class names
        names = model.names
        
        # Get top prediction
        top_class_id = probs.top1
        top_confidence = float(probs.top1conf)
        top_class_name = names[top_class_id]
        
        # Get all predictions
        all_predictions = []
        for i, conf in enumerate(probs.data):
            all_predictions.append({
                "className": names[i],
                "confidence": float(conf)
            })
        
        # Sort by confidence
        all_predictions.sort(key=lambda x: x["confidence"], reverse=True)
        
        # Return JSON
        output = {
            "className": top_class_name,
            "confidence": top_confidence,
            "allPredictions": all_predictions
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        error_output = {
            "error": str(e),
            "className": "Error",
            "confidence": 0.0,
            "allPredictions": []
        }
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python yolo_classify.py <model_path> <image_path>"}))
        sys.exit(1)
    
    model_path = sys.argv[1]
    image_path = sys.argv[2]
    
    classify_image(model_path, image_path)
