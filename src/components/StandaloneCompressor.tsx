import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, Zap, Image as ImageIcon, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ProcessedImage {
  id: string;
  originalFile: File;
  compressedBlob: Blob;
  webpBlob: Blob;
  originalSize: number;
  compressedSize: number;
  webpSize: number;
  compressionRatio: number;
  webpRatio: number;
  processingTime: number;
}

const StandaloneCompressor = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [totalProcessingTime, setTotalProcessingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback(async (file: File): Promise<ProcessedImage> => {
    const startTime = performance.now();
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = async () => {
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        try {
          // Optimize canvas size
          const maxDimension = 1920;
          let { width, height } = img;
          
          if (width > maxDimension || height > maxDimension) {
            const scale = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          canvas.width = width;
          canvas.height = height;
          
          // High quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Create compressed PNG and WebP simultaneously
          const createBlob = (format: string, quality: number) => {
            return new Promise<Blob>((resolve) => {
              canvas.toBlob((blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  // Fallback if blob creation fails
                  canvas.toBlob((fallbackBlob) => {
                    resolve(fallbackBlob!);
                  }, 'image/png', 0.9);
                }
              }, format, quality);
            });
          };

          const [compressedBlob, webpBlob] = await Promise.all([
            createBlob('image/png', 0.9),
            createBlob('image/webp', 0.85)
          ]);

          const endTime = performance.now();
          const processingTime = endTime - startTime;

          const compressionRatio = ((file.size - compressedBlob.size) / file.size) * 100;
          const webpRatio = ((file.size - webpBlob.size) / file.size) * 100;

          resolve({
            id: Math.random().toString(36).substr(2, 9),
            originalFile: file,
            compressedBlob,
            webpBlob,
            originalSize: file.size,
            compressedSize: compressedBlob.size,
            webpSize: webpBlob.size,
            compressionRatio: Math.max(0, compressionRatio),
            webpRatio: Math.max(0, webpRatio),
            processingTime
          });
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/') && file.size <= 50 * 1024 * 1024 // 50MB limit
    );

    if (imageFiles.length === 0) {
      alert('Please select valid image files (max 50MB each)');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProcessedImages([]);
    
    const totalStartTime = performance.now();
    const results: ProcessedImage[] = [];

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          const processed = await compressImage(file);
          results.push(processed);
          setProcessedImages([...results]);
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
        }
        setProgress(((i + 1) / imageFiles.length) * 100);
      }

      const totalEndTime = performance.now();
      setTotalProcessingTime(totalEndTime - totalStartTime);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [compressImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const downloadImage = useCallback((image: ProcessedImage, format: 'png' | 'webp') => {
    const blob = format === 'png' ? image.compressedBlob : image.webpBlob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed_${image.originalFile.name.replace(/\.[^/.]+$/, '')}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback((format: 'png' | 'webp') => {
    processedImages.forEach((image, index) => {
      setTimeout(() => downloadImage(image, format), index * 100);
    });
  }, [processedImages, downloadImage]);

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB'];
    if (bytes === 0) return '0B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)}${sizes[i]}`;
  };

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-full mr-3">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ImageZip
          </h1>
        </div>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Lightning-fast image compression with dual PNG/WebP output. Process multiple images in seconds with 100% privacy.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-8 border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors shadow-lg">
        <CardContent className="p-8">
          <div
            className={`text-center transition-all duration-200 ${
              isDragging ? 'scale-105 bg-blue-50 rounded-lg p-4' : ''
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
          >
            <div className="mb-6">
              <Upload className={`h-16 w-16 mx-auto mb-4 transition-colors ${
                isDragging ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Drop Images Here or Click to Upload
              </h3>
              <p className="text-gray-500 mb-4">
                Supports PNG, JPG, WebP, GIF • Max 50MB per file • Multiple files supported
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              disabled={isProcessing}
            />
            
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 shadow-lg hover:shadow-xl transition-all"
            >
              {isProcessing ? (
                <>
                  <Clock className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Select Images
                </>
              )}
            </Button>

            {isProcessing && (
              <div className="mt-6 max-w-md mx-auto">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Processing images...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {processedImages.length > 0 && (
        <Card className="mb-8 shadow-lg">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Compression Results
                </h3>
                <p className="text-gray-600">
                  {processedImages.length} image(s) processed in {formatTime(totalProcessingTime)}
                </p>
              </div>
              {processedImages.length > 1 && (
                <div className="flex gap-3">
                  <Button onClick={() => downloadAll('png')} variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
                    <Download className="h-4 w-4 mr-2" />
                    Download All PNG
                  </Button>
                  <Button onClick={() => downloadAll('webp')} variant="outline" className="shadow-md hover:shadow-lg transition-shadow">
                    <Download className="h-4 w-4 mr-2" />
                    Download All WebP
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {processedImages.map((image) => (
                <div key={image.id} className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-gray-800 truncate flex-1 mr-4">
                      {image.originalFile.name}
                    </h4>
                    <span className="text-sm text-gray-500 whitespace-nowrap bg-white px-2 py-1 rounded-full">
                      {formatTime(image.processingTime)}
                    </span>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-3">
                    {/* PNG Result */}
                    <div className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-blue-600">Optimized PNG</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadImage(image, 'png')}
                          className="hover:bg-blue-50 border-blue-200"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>{formatFileSize(image.originalSize)} → {formatFileSize(image.compressedSize)}</span>
                          <span className="text-green-600 font-medium">
                            {image.compressionRatio.toFixed(1)}% smaller
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* WebP Result */}
                    <div className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-purple-600">WebP Format</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadImage(image, 'webp')}
                          className="hover:bg-purple-50 border-purple-200"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>{formatFileSize(image.originalSize)} → {formatFileSize(image.webpSize)}</span>
                          <span className="text-green-600 font-medium">
                            {image.webpRatio.toFixed(1)}% smaller
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="text-center p-6 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-yellow-50 to-orange-50">
          <Zap className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-800 mb-2">Lightning Fast</h3>
          <p className="text-gray-600 text-sm">
            Client-side processing means instant results without server delays
          </p>
        </Card>

        <Card className="text-center p-6 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50">
          <ImageIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-800 mb-2">Dual Output</h3>
          <p className="text-gray-600 text-sm">
            Get both optimized PNG and modern WebP formats automatically
          </p>
        </Card>

        <Card className="text-center p-6 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-green-50 to-emerald-50">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-800 mb-2">100% Private</h3>
          <p className="text-gray-600 text-sm">
            All processing happens in your browser - files never leave your device
          </p>
        </Card>
      </div>

      {/* Technical Specs */}
      <Card className="text-center shadow-lg bg-gradient-to-br from-gray-50 to-slate-50">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Technical Specifications</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Supported Formats</h4>
              <p>Input: PNG, JPG, JPEG, WebP, GIF</p>
              <p>Output: Optimized PNG + WebP</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Performance</h4>
              <p>Processing: 0.5-3 seconds per image</p>
              <p>File size: Up to 50MB per image</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StandaloneCompressor;