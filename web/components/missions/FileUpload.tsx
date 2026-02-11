"use client";

import { useState, useCallback } from 'react';
import { Upload, X, File, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
    onFilesChange: (files: File[]) => void;
    maxFiles?: number;
    maxSizeMB?: number;
    acceptedTypes?: string[];
}

export default function FileUpload({
    onFilesChange,
    maxFiles = 10,
    maxSizeMB = 10,
    acceptedTypes = ['*']
}: FileUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateFile = (file: File): string | null => {
        const maxBytes = maxSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
            return `${file.name} exceeds ${maxSizeMB}MB limit`;
        }
        return null;
    };

    const handleFiles = useCallback((newFiles: FileList | null) => {
        if (!newFiles) return;

        setError(null);
        const fileArray = Array.from(newFiles);

        // Validate total count
        if (files.length + fileArray.length > maxFiles) {
            setError(`Maximum ${maxFiles} files allowed`);
            return;
        }

        // Validate each file
        for (const file of fileArray) {
            const validationError = validateFile(file);
            if (validationError) {
                setError(validationError);
                return;
            }
        }

        const updatedFiles = [...files, ...fileArray];
        setFiles(updatedFiles);
        onFilesChange(updatedFiles);
    }, [files, maxFiles, maxSizeMB, onFilesChange]);

    const removeFile = (index: number) => {
        const updatedFiles = files.filter((_, i) => i !== index);
        setFiles(updatedFiles);
        onFilesChange(updatedFiles);
        setError(null);
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        handleFiles(e.target.files);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const isImage = (file: File) => file.type.startsWith('image/');

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${dragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    multiple
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept={acceptedTypes.join(',')}
                />
                <Upload className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <p className="text-white font-medium mb-1">
                    Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-400">
                    Max {maxFiles} files, {maxSizeMB}MB each
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm text-gray-400">
                        {files.length} file{files.length !== 1 ? 's' : ''} selected
                    </p>
                    <div className="space-y-2">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 bg-gray-800/50 border border-gray-700 rounded-lg p-3 group hover:border-gray-600 transition-colors"
                            >
                                {isImage(file) ? (
                                    <ImageIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
                                ) : (
                                    <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {formatFileSize(file.size)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                                    type="button"
                                >
                                    <X className="h-4 w-4 text-red-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
