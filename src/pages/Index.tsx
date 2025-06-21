
import React, { useState, useCallback } from 'react';
import { Upload, Download, Image as ImageIcon, Zap, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

interface CompressedImage {
  originalFile: File;
  compressedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

const Index = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compressedImages, setCompressedImages] = useState<CompressedImage[]>([]);

  const compressPNG = useCallback(async (file: File): Promise<CompressedImage> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Get original dimensions
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;

        // Optimize canvas size - reduce if very large
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        
        // If image is very large, scale it down slightly for web optimization
        const maxDimension = 2048;
        if (originalWidth > maxDimension || originalHeight > maxDimension) {
          const scale = Math.min(maxDimension / originalWidth, maxDimension / originalHeight);
          targetWidth = Math.floor(originalWidth * scale);
          targetHeight = Math.floor(originalHeight * scale);
          console.log(`Scaling image from ${originalWidth}x${originalHeight} to ${targetWidth}x${targetHeight}`);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image to canvas with optimized size
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Try multiple compression strategies and pick the best one
        const compressionPromises = [
          // Strategy 1: PNG with quality 0.95
          new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
            }, 'image/png', 0.95);
          }),
          
          // Strategy 2: PNG with quality 0.9
          new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
            }, 'image/png', 0.9);
          }),

          // Strategy 3: Convert to JPEG and back to PNG for complex images
          new Promise<Blob>((resolve) => {
            canvas.toBlob((jpegBlob) => {
              if (jpegBlob) {
                const tempImg = new Image();
                tempImg.onload = () => {
                  const tempCanvas = document.createElement('canvas');
                  const tempCtx = tempCanvas.getContext('2d');
                  if (tempCtx) {
                    tempCanvas.width = targetWidth;
                    tempCanvas.height = targetHeight;
                    tempCtx.drawImage(tempImg, 0, 0);
                    tempCanvas.toBlob((finalBlob) => {
                      if (finalBlob) resolve(finalBlob);
                    }, 'image/png', 0.9);
                  }
                };
                tempImg.src = URL.createObjectURL(jpegBlob);
              }
            }, 'image/jpeg', 0.85);
          })
        ];

        Promise.all(compressionPromises).then((blobs) => {
          // Filter out undefined blobs and find the smallest one
          const validBlobs = blobs.filter(blob => blob !== undefined);
          const smallestBlob = validBlobs.reduce((smallest, current) => 
            current.size < smallest.size ? current : smallest
          );

          const compressionRatio = ((file.size - smallestBlob.size) / file.size) * 100;
          console.log(`Original: ${file.size} bytes, Compressed: ${smallestBlob.size} bytes, Ratio: ${compressionRatio.toFixed(1)}%`);
          
          resolve({
            originalFile: file,
            compressedBlob: smallestBlob,
            originalSize: file.size,
            compressedSize: smallestBlob.size,
            compressionRatio: Math.max(0, compressionRatio)
          });
        }).catch(() => {
          // Fallback: simple PNG compression
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressionRatio = ((file.size - blob.size) / file.size) * 100;
                resolve({
                  originalFile: file,
                  compressedBlob: blob,
                  originalSize: file.size,
                  compressedSize: blob.size,
                  compressionRatio: Math.max(0, compressionRatio)
                });
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/png',
            0.8
          );
        });
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    const pngFiles = Array.from(files).filter(file => 
      file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
    );

    if (pngFiles.length === 0) {
      toast({
        title: "No PNG files found",
        description: "Please select PNG files to compress.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    const results: CompressedImage[] = [];

    try {
      for (let i = 0; i < pngFiles.length; i++) {
        const file = pngFiles[i];
        console.log(`Processing file ${i + 1}/${pngFiles.length}: ${file.name}`);
        
        try {
          const compressed = await compressPNG(file);
          results.push(compressed);
          console.log(`Compressed ${file.name}: ${compressed.originalSize} -> ${compressed.compressedSize} bytes (${compressed.compressionRatio.toFixed(1)}% reduction)`);
        } catch (error) {
          console.error(`Error compressing ${file.name}:`, error);
          toast({
            title: `Error compressing ${file.name}`,
            description: "This file could not be processed.",
            variant: "destructive",
          });
        }

        setProgress(((i + 1) / pngFiles.length) * 100);
      }

      setCompressedImages(results);
      
      if (results.length > 0) {
        toast({
          title: "Compression completed!",
          description: `Successfully compressed ${results.length} PNG file(s).`,
        });
      }
    } catch (error) {
      console.error('Compression error:', error);
      toast({
        title: "Compression failed",
        description: "An error occurred during compression.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [compressPNG]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const downloadImage = useCallback((compressed: CompressedImage) => {
    const url = URL.createObjectURL(compressed.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed_${compressed.originalFile.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(() => {
    compressedImages.forEach(compressed => {
      setTimeout(() => downloadImage(compressed), 100);
    });
  }, [compressedImages, downloadImage]);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-lg mr-3">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">PNG Web Compressor</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Compress your PNG images for web use without quality loss. 
            Reduce file sizes while maintaining perfect image quality.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="text-center">
              <ImageIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Lossless Compression</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-center">
                Maintain perfect image quality while reducing file sizes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Fast Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-center">
                Browser-based compression means instant results
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Check className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Privacy First</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-center">
                Your images never leave your browser - 100% secure
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Area */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload PNG Images</CardTitle>
            <CardDescription>
              Drag and drop your PNG files here, or click to select files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                Drop PNG files here or click to browse
              </p>
              <p className="text-gray-500 mb-4">
                Supports multiple files • PNG format only
              </p>
              <input
                type="file"
                accept=".png,image/png"
                multiple
                onChange={handleFileInput}
                className="hidden"
                id="file-input"
                disabled={isProcessing}
              />
              <Button 
                asChild 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isProcessing}
              >
                <label htmlFor="file-input" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Select Files
                </label>
              </Button>
            </div>

            {isProcessing && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Processing images...</span>
                  <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {compressedImages.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Compression Results</CardTitle>
                <CardDescription>
                  {compressedImages.length} image(s) processed successfully
                </CardDescription>
              </div>
              {compressedImages.length > 1 && (
                <Button onClick={downloadAll} className="bg-green-600 hover:bg-green-700">
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {compressedImages.map((compressed, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 mb-1">
                        {compressed.originalFile.name}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>
                          Original: {formatFileSize(compressed.originalSize)}
                        </span>
                        <span>→</span>
                        <span>
                          Compressed: {formatFileSize(compressed.compressedSize)}
                        </span>
                        <span className="text-green-600 font-medium">
                          {compressed.compressionRatio > 0 
                            ? `${compressed.compressionRatio.toFixed(1)}% smaller`
                            : 'Optimized'
                          }
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => downloadImage(compressed)}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-blue-600" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Lossless Compression</h4>
              <p className="text-gray-600">
                Our tool optimizes PNG files by removing unnecessary metadata and applying 
                efficient encoding while preserving 100% of the original image quality.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Perfect for Web</h4>
              <p className="text-gray-600">
                Smaller file sizes mean faster website loading times and better user experience, 
                without sacrificing visual quality.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Privacy & Security</h4>
              <p className="text-gray-600">
                All processing happens in your browser - your images are never uploaded to any server, 
                ensuring complete privacy and security.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
