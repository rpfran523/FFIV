import React, { useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface PhotoCaptureProps {
  onPhotoCapture: (photoBase64: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onPhotoCapture, onCancel, isOpen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // Use back camera on mobile
        }
      });
      
      setStream(mediaStream);
      setHasCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Unable to access camera. Please check permissions.');
      setHasCamera(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setHasCamera(false);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Camera not ready');
      return;
    }

    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      toast.error('Failed to capture photo');
      setIsCapturing(false);
      return;
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to base64
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
    
    // Stop camera
    stopCamera();
    
    // Return photo
    onPhotoCapture(photoBase64);
    setIsCapturing(false);
    
    toast.success('Photo captured successfully!');
  }, [stopCamera, onPhotoCapture]);

  React.useEffect(() => {
    if (isOpen && !hasCamera) {
      startCamera();
    } else if (!isOpen && hasCamera) {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, hasCamera, startCamera, stopCamera]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">📸 Capture Delivery Photo</h3>
            <button
              onClick={() => {
                stopCamera();
                onCancel();
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4">
          {hasCamera ? (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                
                {/* Camera overlay */}
                <div className="absolute inset-0 border-2 border-white border-dashed opacity-30 m-4 rounded-lg"></div>
                
                {/* Instructions */}
                <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-sm p-2 rounded">
                  📦 Position the delivered package in the frame
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={capturePhoto}
                  disabled={isCapturing}
                  className="flex-1 bg-green-500 text-white py-3 px-4 rounded-md hover:bg-green-600 disabled:opacity-50 font-medium"
                >
                  {isCapturing ? 'Capturing...' : '📸 Take Photo'}
                </button>
                <button
                  onClick={() => {
                    stopCamera();
                    onCancel();
                  }}
                  className="bg-gray-500 text-white py-3 px-4 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-6xl mb-4 block">📷</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Camera Access Required</h3>
              <p className="text-gray-600 mb-4">
                Please allow camera access to take delivery photos
              </p>
              <div className="space-y-3">
                <button
                  onClick={startCamera}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
                >
                  Enable Camera
                </button>
                <button
                  onClick={onCancel}
                  className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                >
                  Skip Photo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoCapture;
