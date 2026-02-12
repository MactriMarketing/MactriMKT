import React, { useCallback, useState } from 'react';
import { Upload, Image as ImageIcon, Plus } from 'lucide-react';
import { FileData } from '../types';

interface ImageUploadProps {
  onImagesSelected: (data: FileData[]) => void;
  currentCount: number;
  maxFiles?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImagesSelected, currentCount, maxFiles = 10 }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = async (files: FileList | File[]) => {
    const remainingSlots = maxFiles - currentCount;
    
    if (remainingSlots <= 0) {
      alert(`Bạn đã đạt giới hạn tối đa ${maxFiles} ảnh.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
      alert(`Chỉ chọn ${remainingSlots} ảnh tiếp theo để không vượt quá giới hạn ${maxFiles} ảnh.`);
    }

    const processedFiles: FileData[] = [];

    const readFile = (file: File): Promise<FileData> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(',')[1];
          resolve({
            id: crypto.randomUUID(),
            file,
            previewUrl: result,
            base64,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      });
    };

    const validFiles = filesToProcess.filter(f => f.type.startsWith('image/'));
    
    if (validFiles.length === 0 && filesToProcess.length > 0) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP)');
      return;
    }

    const results = await Promise.all(validFiles.map(readFile));
    onImagesSelected(results);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [onImagesSelected, currentCount, maxFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so same files can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative group w-full h-40 rounded-2xl border-2 border-dashed transition-all duration-300 ease-out cursor-pointer
        flex flex-col items-center justify-center overflow-hidden
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
          : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600'
        }
      `}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={currentCount >= maxFiles}
      />
      
      <div className="flex flex-col items-center space-y-2 p-4 text-center pointer-events-none z-0">
        <div className={`
          p-3 rounded-full transition-colors duration-300
          ${isDragging ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400 group-hover:text-indigo-400 group-hover:bg-slate-700'}
        `}>
          {currentCount > 0 ? <Plus className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            {isDragging ? 'Thả ảnh vào đây' : (currentCount > 0 ? 'Thêm ảnh khác' : 'Tải ảnh lên')}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            (Tối đa {maxFiles} ảnh)
          </p>
        </div>
      </div>
    </div>
  );
};
