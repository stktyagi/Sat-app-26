import {
  RNMLKitFaceDetector,
  RNMLKitFace,
} from '@infinitered/react-native-mlkit-face-detection';

export interface FaceValidationResult {
  valid: boolean;
  errorTitle?: string;
  errorMessage?: string;
  face?: RNMLKitFace;
  details?: {
    faceCount: number;
    smiling?: boolean;
    eyesOpen?: boolean;
  };
}

let detectorInstance: RNMLKitFaceDetector | null = null;

function getDetector(): RNMLKitFaceDetector {
  if (!detectorInstance) {
    detectorInstance = new RNMLKitFaceDetector({
      performanceMode: 'accurate',
      classificationMode: true,
      landmarkMode: true,
    });
  }
  return detectorInstance;
}

/**
 * Scans an image file URI using on-device ML Kit Face Detection.
 * Validates:
 * 1. Exactly one face is present in the frame
 * 2. Eyes are open (if classification is available)
 * 3. Gracefully degrades in environments without native ML Kit (e.g. simulator/Expo Go)
 */
export async function scanAndValidateFace(imageUri: string): Promise<FaceValidationResult> {
  if (!imageUri) {
    return {
      valid: false,
      errorTitle: 'Invalid Image',
      errorMessage: 'No image was captured. Please try again.',
    };
  }

  try {
    const detector = getDetector();
    const result = await detector.detectFaces(imageUri);

    // If detector returned nothing or native module wasn't available
    if (!result || !result.faces) {
      console.warn('[FaceScanner] ML Kit returned no result, allowing bypass in dev/fallback.');
      return { valid: true };
    }

    const faces = result.faces;

    // Check 1: Zero faces detected
    if (faces.length === 0) {
      return {
        valid: false,
        errorTitle: 'No Face Detected',
        errorMessage:
          'We could not detect a clear human face in this photo. Please face the camera directly in good lighting and avoid sunglasses, masks, or heavy shadows.',
      };
    }

    // Check 2: Multiple faces detected
    if (faces.length > 1) {
      return {
        valid: false,
        errorTitle: 'Multiple Faces Detected',
        errorMessage:
          `Found ${faces.length} faces in the frame. Your festival accreditation pass requires a solo photo of only yourself.`,
      };
    }

    const face = faces[0];

    // Check 3: Eyes open verification (when probability values are provided)
    let eyesOpen = true;
    if (
      face.hasLeftEyeOpenProbability &&
      face.hasRightEyeOpenProbability &&
      typeof face.leftEyeOpenProbability === 'number' &&
      typeof face.rightEyeOpenProbability === 'number'
    ) {
      // If both eyes are detected as almost certainly closed (< 0.25)
      if (face.leftEyeOpenProbability < 0.25 && face.rightEyeOpenProbability < 0.25) {
        eyesOpen = false;
        return {
          valid: false,
          errorTitle: 'Eyes Closed Detected 👁️',
          errorMessage:
            'It appears your eyes were closed when taking the photo. Please keep both eyes open and retake the photo for your festival pass.',
        };
      }
    }

    const smiling =
      face.hasSmilingProbability &&
      typeof face.smilingProbability === 'number' &&
      face.smilingProbability > 0.5;

    return {
      valid: true,
      face,
      details: {
        faceCount: 1,
        smiling,
        eyesOpen,
      },
    };
  } catch (error: any) {
    console.warn('[FaceScanner] Native face detection encountered an error:', error);
    // In dev or environments where native ML Kit is not compiled yet, fail-open to not block dev workflows
    if (__DEV__) {
      return { valid: true };
    }
    return {
      valid: false,
      errorTitle: 'Face Scan Failed',
      errorMessage: 'Could not analyze face. Please retake the photo in bright lighting.',
    };
  }
}
