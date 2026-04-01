import { useState, useRef, useCallback } from 'react';

interface ImageCropperProps {
  onUpload: (file: File) => void;
  maxSize?: number; // in MB
}

export default function ImageCropper({ onUpload, maxSize = 2 }: ImageCropperProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((file: File | null) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`文件大小不能超过 ${maxSize}MB`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    onUpload(file);
  }, [maxSize, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  }, [handleFileChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
      />
      
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative w-32 h-32 mx-auto rounded-full border-2 border-dashed cursor-pointer
          flex items-center justify-center overflow-hidden
          transition-colors duration-200
          ${isDragging ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-600 hover:border-cyan-500/50'}
          ${preview ? 'border-solid' : 'border-dashed'}
        `}
      >
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-4">
            <span className="material-symbols-outlined text-3xl text-slate-500">
              add_photo_alternate
            </span>
            <p className="text-xs text-slate-500 mt-1">点击或拖拽上传</p>
          </div>
        )}
      </div>
      
      <p className="text-center text-xs text-slate-500 mt-2">
        支持 JPG, PNG 格式，最大 {maxSize}MB
      </p>
    </div>
  );
}
