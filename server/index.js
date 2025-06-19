import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
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
    console.log('Processing Excel file:', filePath);
    console.log('XLSX available methods:', Object.keys(XLSX));
    
    // Try different approaches for reading the Excel file
    let workbook;
    
    if (XLSX.readFile) {
      console.log('Using XLSX.readFile method');
      workbook = XLSX.readFile(filePath);
    } else if (XLSX.read) {
      console.log('Using XLSX.read method with buffer');
      const fileBuffer = fs.readFileSync(filePath);
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } else {
      throw new Error('XLSX library methods not available');
    }
    
    console.log('Workbook loaded successfully');
    console.log('Sheet names:', workbook.SheetNames);
    
    const sheetNames = workbook.SheetNames;
    const result = {};
    
    sheetNames.forEach(sheetName => {
      console.log(`Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      result[sheetName] = jsonData;
      console.log(`Sheet ${sheetName} processed: ${jsonData.length} rows`);
    });
    
    return result;
  } catch (error) {
    console.error('Excel processing error:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Error processing Excel file: ${error.message}`);
  }
};

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('\n=== New Upload Request ===');
    
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const filePath = req.file.path;
    const fileExtension = path.extname(originalname).toLowerCase();

    console.log(`Original Name: ${originalname}`);
    console.log(`File Size: ${(size / 1024).toFixed(2)} KB`);
    console.log(`MIME Type: ${mimetype}`);
    console.log(`Extension: ${fileExtension}`);
    console.log(`File Path: ${filePath}`);
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
        console.log('Processing as CSV file');
        fileData = await processCSV(filePath);
        console.log(`CSV processed: ${fileData.length} rows`);
        
        if (fileData.length > 0) {
          console.log('Column headers:', Object.keys(fileData[0]));
        }
        
        processingInfo.rowCount = fileData.length;
        processingInfo.columns = fileData.length > 0 ? Object.keys(fileData[0]) : [];
        
      } else if (['.xlsx', '.xls'].includes(fileExtension)) {
        console.log('Processing as Excel file');
        fileData = processExcel(filePath);
        
        const sheetNames = Object.keys(fileData);
        console.log(`Excel processed: ${sheetNames.length} sheets`);
        
        let totalRows = 0;
        sheetNames.forEach(sheetName => {
          const sheetData = fileData[sheetName];
          totalRows += sheetData.length;
          console.log(`Sheet "${sheetName}": ${sheetData.length} rows`);
        });
        
        processingInfo.sheetCount = sheetNames.length;
        processingInfo.sheetNames = sheetNames;
        processingInfo.totalRows = totalRows;
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Temporary file cleaned up');
      }

      console.log('=== Processing Complete ===');

      res.json({
        success: true,
        message: 'File processed successfully',
        data: fileData,
        processingInfo: processingInfo
      });

    } catch (processingError) {
      console.error('=== Processing Error ===');
      console.error('Error message:', processingError.message);
      console.error('Error stack:', processingError.stack);
      
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Temporary file cleaned up after error');
      }
      
      res.status(500).json({
        success: false,
        message: `Error processing file: ${processingError.message}`
      });
    }

  } catch (error) {
    console.error('=== Upload Error ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    xlsxAvailable: typeof XLSX !== 'undefined' && (!!XLSX.readFile || !!XLSX.read)
  });
});

// Test endpoint to check XLSX
app.get('/api/test-xlsx', (req, res) => {
  console.log('XLSX test requested');
  res.json({
    xlsxType: typeof XLSX,
    xlsxMethods: Object.keys(XLSX),
    hasReadFile: !!XLSX.readFile,
    hasRead: !!XLSX.read,
    hasUtils: !!XLSX.utils
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('=== Server Error Middleware ===');
  console.error('Error:', error);
  
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

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 File uploads directory: ${uploadsDir}`);
  console.log(`📊 XLSX library status:`);
  console.log(`   - Type: ${typeof XLSX}`);
  console.log(`   - readFile available: ${!!XLSX.readFile}`);
  console.log(`   - read available: ${!!XLSX.read}`);
  console.log(`   - utils available: ${!!XLSX.utils}`);
  console.log(`   - Methods: ${Object.keys(XLSX).slice(0, 5).join(', ')}...`);
  console.log('');
});