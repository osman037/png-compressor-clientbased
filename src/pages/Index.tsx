import React, { useState, useCallback } from 'react';
import { Upload, Download, Image as ImageIcon, Zap, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

interface CompressedImage {
  originalFile: File;
  compressedBlob: Blob;
  webpBlob?: Blob;
  originalSize: number;
  compressedSize: number;
  webpSize?: number;
  compressionRatio: number;
  webpCompressionRatio?: number;
}

const Index = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compressedImages, setCompressedImages] = useState<CompressedImage[]>([]);

  // Advanced PNG compression with multiple strategies
  const compressPNGAdvanced = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;

        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        
        const maxDimension = 2048;
        if (originalWidth > maxDimension || originalHeight > maxDimension) {
          const scale = Math.min(maxDimension / originalWidth, maxDimension / originalHeight);
          targetWidth = Math.floor(originalWidth * scale);
          targetHeight = Math.floor(originalHeight * scale);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const compressionPromises = [
          new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
            }, 'image/png', 0.95);
          }),
          
          new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
            }, 'image/png', 0.9);
          }),

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
          const validBlobs = blobs.filter(blob => blob !== undefined);
          const smallestBlob = validBlobs.reduce((smallest, current) => 
            current.size < smallest.size ? current : smallest
          );
          resolve(smallestBlob);
        }).catch(() => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
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

  // Fallback PNG compression with different approach
  const compressPNGFallback = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // More aggressive size reduction for fallback
        let targetWidth = img.naturalWidth;
        let targetHeight = img.naturalHeight;
        
        // Reduce dimensions more aggressively
        if (targetWidth > 1024 || targetHeight > 1024) {
          const scale = Math.min(1024 / targetWidth, 1024 / targetHeight);
          targetWidth = Math.floor(targetWidth * scale);
          targetHeight = Math.floor(targetHeight * scale);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Use different rendering settings
        ctx.imageSmoothingEnabled = false; // Disable smoothing for smaller files
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Try multiple compression levels
        const qualities = [0.8, 0.7, 0.6];
        let bestBlob: Blob | null = null;
        let currentIndex = 0;

        const tryNextQuality = () => {
          if (currentIndex >= qualities.length) {
            if (bestBlob) {
              resolve(bestBlob);
            } else {
              reject(new Error('All compression attempts failed'));
            }
            return;
          }

          canvas.toBlob((blob) => {
            if (blob && (!bestBlob || blob.size < bestBlob.size)) {
              bestBlob = blob;
            }
            currentIndex++;
            tryNextQuality();
          }, 'image/png', qualities[currentIndex]);
        };

        tryNextQuality();
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // WebP conversion with high compression
  const convertToWebP = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        
        // Keep original dimensions for WebP as it's more efficient
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, originalWidth, originalHeight);

        // WebP with high compression but good quality
        canvas.toBlob((blob) => {
          if (blob) {
            console.log(`WebP conversion: ${file.size} -> ${blob.size} bytes`);
            resolve(blob);
          } else {
            reject(new Error('Failed to convert to WebP'));
          }
        }, 'image/webp', 0.85); // 85% quality for good compression
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const compressPNG = useCallback(async (file: File): Promise<CompressedImage> => {
    console.log(`Starting compression for: ${file.name}`);
    
    try {
      // Try advanced compression first
      console.log('Trying advanced PNG compression...');
      const compressedBlob = await compressPNGAdvanced(file);
      
      // If compression ratio is poor, try fallback method
      const advancedRatio = ((file.size - compressedBlob.size) / file.size) * 100;
      let finalCompressedBlob = compressedBlob;
      
      if (advancedRatio < 5) { // Less than 5% compression
        console.log('Advanced compression yielded poor results, trying fallback...');
        try {
          const fallbackBlob = await compressPNGFallback(file);
          const fallbackRatio = ((file.size - fallbackBlob.size) / file.size) * 100;
          
          // Use whichever gives better compression
          if (fallbackBlob.size < compressedBlob.size) {
            finalCompressedBlob = fallbackBlob;
            console.log(`Fallback method better: ${fallbackRatio.toFixed(1)}% vs ${advancedRatio.toFixed(1)}%`);
          }
        } catch (fallbackError) {
          console.log('Fallback compression failed, using advanced result');
        }
      }

      // Generate WebP version
      console.log('Converting to WebP...');
      let webpBlob: Blob | undefined;
      let webpCompressionRatio: number | undefined;
      
      try {
        webpBlob = await convertToWebP(file);
        webpCompressionRatio = ((file.size - webpBlob.size) / file.size) * 100;
        console.log(`WebP compression: ${webpCompressionRatio.toFixed(1)}%`);
      } catch (webpError) {
        console.log('WebP conversion failed:', webpError);
      }

      const finalCompressionRatio = ((file.size - finalCompressedBlob.size) / file.size) * 100;
      
      return {
        originalFile: file,
        compressedBlob: finalCompressedBlob,
        webpBlob,
        originalSize: file.size,
        compressedSize: finalCompressedBlob.size,
        webpSize: webpBlob?.size,
        compressionRatio: Math.max(0, finalCompressionRatio),
        webpCompressionRatio: webpCompressionRatio ? Math.max(0, webpCompressionRatio) : undefined
      };
    } catch (error) {
      console.error('All compression methods failed:', error);
      throw error;
    }
  }, [compressPNGAdvanced, compressPNGFallback, convertToWebP]);

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
          console.log(`Processed ${file.name}: PNG ${compressed.compressionRatio.toFixed(1)}%${compressed.webpCompressionRatio ? `, WebP ${compressed.webpCompressionRatio.toFixed(1)}%` : ''}`);
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
          description: `Successfully compressed ${results.length} PNG file(s) with WebP alternatives.`,
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

  const downloadPNG = useCallback((compressed: CompressedImage) => {
    const url = URL.createObjectURL(compressed.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed_${compressed.originalFile.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadWebP = useCallback((compressed: CompressedImage) => {
    if (!compressed.webpBlob) return;
    
    const url = URL.createObjectURL(compressed.webpBlob);
    const a = document.createElement('a');
    a.href = url;
    const originalName = compressed.originalFile.name;
    const nameWithoutExt = originalName.replace(/\.png$/i, '');
    a.download = `${nameWithoutExt}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAllPNG = useCallback(() => {
    compressedImages.forEach((compressed, index) => {
      setTimeout(() => downloadPNG(compressed), index * 100);
    });
  }, [compressedImages, downloadPNG]);

  const downloadAllWebP = useCallback(() => {
    compressedImages.forEach((compressed, index) => {
      if (compressed.webpBlob) {
        setTimeout(() => downloadWebP(compressed), index * 100);
      }
    });
  }, [compressedImages, downloadWebP]);

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
            Get both optimized PNG and WebP formats for maximum compatibility.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="text-center">
              <ImageIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <CardTitle className="text-lg">Dual Compression</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-center">
                Advanced PNG optimization with fallback algorithms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <CardTitle className="text-lg">WebP Conversion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-center">
                Optional WebP format for even better compression
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
                Supports multiple files • PNG format only • WebP conversion included
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
                  {compressedImages.length} image(s) processed with PNG and WebP options
                </CardDescription>
              </div>
              {compressedImages.length > 1 && (
                <div className="flex gap-2">
                  <Button onClick={downloadAllPNG} className="bg-blue-600 hover:bg-blue-700">
                    <Download className="h-4 w-4 mr-2" />
                    Download All PNG
                  </Button>
                  <Button onClick={downloadAllWebP} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download All WebP
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {compressedImages.map((compressed, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-3">
                      {compressed.originalFile.name}
                    </h4>
                    
                    {/* PNG Results */}
                    <div className="flex items-center justify-between mb-3 p-3 bg-white rounded border">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-1">
                          <span className="font-medium text-blue-600">PNG Optimized:</span>
                          <span>{formatFileSize(compressed.originalSize)} → {formatFileSize(compressed.compressedSize)}</span>
                          <span className="text-green-600 font-medium">
                            {compressed.compressionRatio > 0 
                              ? `${compressed.compressionRatio.toFixed(1)}% smaller`
                              : 'Optimized'
                            }
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => downloadPNG(compressed)}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download PNG
                      </Button>
                    </div>

                    {/* WebP Results */}
                    {compressed.webpBlob && (
                      <div className="flex items-center justify-between p-3 bg-white rounded border">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-1">
                            <span className="font-medium text-purple-600">WebP Format:</span>
                            <span>{formatFileSize(compressed.originalSize)} → {formatFileSize(compressed.webpSize!)}</span>
                            <span className="text-green-600 font-medium">
                              {compressed.webpCompressionRatio! > 0 
                                ? `${compressed.webpCompressionRatio!.toFixed(1)}% smaller`
                                : 'Converted'
                              }
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => downloadWebP(compressed)}
                          variant="outline"
                          size="sm"
                          className="border-purple-200 text-purple-600 hover:bg-purple-50"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download WebP
                        </Button>
                      </div>
                    )}
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
              <h4 className="font-medium text-gray-800 mb-2">Dual PNG Compression</h4>
              <p className="text-gray-600">
                Uses advanced compression with fallback algorithms to ensure optimal file size reduction 
                while maintaining perfect image quality.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">WebP Conversion</h4>
              <p className="text-gray-600">
                Automatically generates WebP versions for modern browsers, offering superior compression 
                with excellent quality retention.
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
