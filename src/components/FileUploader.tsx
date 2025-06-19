import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, File } from 'lucide-react';

interface ProcessingInfo {
  fileName: string;
  fileSize: string;
  fileType: string;
  processedAt: string;
  rowCount?: number;
  columns?: string[];
  sheetCount?: number;
  sheetNames?: string[];
  totalRows?: number;
}

interface UploadResponse {
  success: boolean;
  message: string;
  data?: any;
  processingInfo?: ProcessingInfo;
}

const FileUploader: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv'
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      return 'Invalid file type. Please upload CSV or Excel files only.';
    }
    
    if (file.size > 10 * 1024 * 1024) {
      return 'File too large. Maximum size allowed is 10MB.';
    }
    
    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadResult({
        success: false,
        message: validationError
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResponse = await response.json();
      setUploadResult(result);
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Network error. Please make sure the server is running.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const renderDataPreview = (data: any, processingInfo: ProcessingInfo) => {
    if (!data) return null;

    if (processingInfo.fileType === 'CSV') {
      const rows = Array.isArray(data) ? data : [];
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <span className="font-medium text-blue-900">Total Rows:</span>
              <span className="ml-2 text-blue-700">{processingInfo.rowCount || 0}</span>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <span className="font-medium text-green-900">Columns:</span>
              <span className="ml-2 text-green-700">{processingInfo.columns?.length || 0}</span>
            </div>
          </div>
          
          {processingInfo.columns && processingInfo.columns.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Column Headers:</h4>
              <div className="flex flex-wrap gap-2">
                {processingInfo.columns.map((column, index) => (
                  <span key={index} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                    {column}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {rows.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Sample Data (First 3 rows):</h4>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(rows.slice(0, 3), null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      );
    } else {
      // Excel file
      const sheets = Object.keys(data);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-purple-50 p-3 rounded-lg">
              <span className="font-medium text-purple-900">Sheets:</span>
              <span className="ml-2 text-purple-700">{processingInfo.sheetCount || 0}</span>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <span className="font-medium text-blue-900">Total Rows:</span>
              <span className="ml-2 text-blue-700">{processingInfo.totalRows || 0}</span>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <span className="font-medium text-green-900">File Size:</span>
              <span className="ml-2 text-green-700">{processingInfo.fileSize}</span>
            </div>
          </div>
          
          {sheets.map((sheetName, index) => {
            const sheetData = data[sheetName];
            return (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                  Sheet: {sheetName} ({sheetData.length} rows)
                </h4>
                
                {sheetData.length > 0 && (
                  <>
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-700">Columns: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.keys(sheetData[0]).map((col, colIndex) => (
                          <span key={colIndex} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {JSON.stringify(sheetData.slice(0, 2), null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          File Processor
        </h1>
        <p className="text-lg text-gray-600">
          Upload your CSV or Excel files to process and view their contents
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 scale-105'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-4">
          {isUploading ? (
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          ) : (
            <div className="p-4 bg-blue-100 rounded-full">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
          )}
          
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isUploading ? 'Processing file...' : 'Drop your file here'}
            </h3>
            <p className="text-gray-600 mb-4">
              {isUploading 
                ? 'Please wait while we process your file' 
                : 'or click to browse and select a file'
              }
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <File className="w-4 h-4 mr-1" />
                CSV, Excel
              </span>
              <span>•</span>
              <span>Max 10MB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {uploadResult && (
        <div className="mt-8">
          <div className={`rounded-xl p-6 ${
            uploadResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start space-x-3">
              {uploadResult.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${
                  uploadResult.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {uploadResult.success ? 'File Processed Successfully!' : 'Processing Failed'}
                </h3>
                
                <p className={`mb-4 ${
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResult.message}
                </p>

                {uploadResult.success && uploadResult.processingInfo && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <h4 className="font-medium text-gray-900 mb-3">File Information</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <p className="font-medium text-gray-900">{uploadResult.processingInfo.fileName}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <p className="font-medium text-gray-900">{uploadResult.processingInfo.fileType}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Size:</span>
                          <p className="font-medium text-gray-900">{uploadResult.processingInfo.fileSize}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Processed:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(uploadResult.processingInfo.processedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {uploadResult.data && (
                      <div className="bg-white rounded-lg p-6 border border-green-200">
                        <h4 className="font-medium text-gray-900 mb-4">Data Preview</h4>
                        {renderDataPreview(uploadResult.data, uploadResult.processingInfo)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;