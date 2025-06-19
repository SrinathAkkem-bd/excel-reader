import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as XLSX from 'xlsx';
import csvParser from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv'
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
    }
  }
});

// Utility function to process CSV files
const processCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Utility function to process Excel files
const processExcel = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const result = {};
    
    sheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      result[sheetName] = jsonData;
    });
    
    return result;
  } catch (error) {
    throw new Error(`Error processing Excel file: ${error.message}`);
  }
};

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const filePath = req.file.path;
    const fileExtension = path.extname(originalname).toLowerCase();

    console.log(`\n=== File Upload Details ===`);
    console.log(`Original Name: ${originalname}`);
    console.log(`File Size: ${(size / 1024).toFixed(2)} KB`);
    console.log(`MIME Type: ${mimetype}`);
    console.log(`Extension: ${fileExtension}`);
    console.log(`Stored As: ${filename}`);

    let fileData;
    let processingInfo = {
      fileName: originalname,
      fileSize: `${(size / 1024).toFixed(2)} KB`,
      fileType: fileExtension.toUpperCase().substring(1),
      processedAt: new Date().toISOString()
    };

    try {
      if (fileExtension === '.csv') {
        console.log('\n=== Processing CSV File ===');
        fileData = await processCSV(filePath);
        console.log(`Rows processed: ${fileData.length}`);
        
        if (fileData.length > 0) {
          console.log('Column headers:', Object.keys(fileData[0]));
          console.log('First few rows:');
          fileData.slice(0, 3).forEach((row, index) => {
            console.log(`Row ${index + 1}:`, row);
          });
        }
        
        processingInfo.rowCount = fileData.length;
        processingInfo.columns = fileData.length > 0 ? Object.keys(fileData[0]) : [];
        
      } else if (['.xlsx', '.xls'].includes(fileExtension)) {
        console.log('\n=== Processing Excel File ===');
        fileData = processExcel(filePath);
        
        const sheetNames = Object.keys(fileData);
        console.log(`Sheets found: ${sheetNames.join(', ')}`);
        
        let totalRows = 0;
        sheetNames.forEach(sheetName => {
          const sheetData = fileData[sheetName];
          console.log(`\nSheet "${sheetName}": ${sheetData.length} rows`);
          totalRows += sheetData.length;
          
          if (sheetData.length > 0) {
            console.log('Column headers:', Object.keys(sheetData[0]));
            console.log('First few rows:');
            sheetData.slice(0, 2).forEach((row, index) => {
              console.log(`Row ${index + 1}:`, row);
            });
          }
        });
        
        processingInfo.sheetCount = sheetNames.length;
        processingInfo.sheetNames = sheetNames;
        processingInfo.totalRows = totalRows;
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      console.log('\n=== Processing Complete ===');
      console.log('File processed successfully and cleaned up.');

      res.json({
        success: true,
        message: 'File processed successfully',
        data: fileData,
        processingInfo: processingInfo
      });

    } catch (processingError) {
      console.error('\n=== Processing Error ===');
      console.error('Error details:', processingError.message);
      
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      res.status(500).json({
        success: false,
        message: `Error processing file: ${processingError.message}`
      });
    }

  } catch (error) {
    console.error('\n=== Upload Error ===');
    console.error('Error details:', error.message);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size allowed is 10MB.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 File uploads will be processed and logged here\n`);
});