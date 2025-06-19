import React from 'react';
import FileUploader from './components/FileUploader';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(68,68,68,.05)_25%,rgba(68,68,68,.05)_75%,transparent_75%,transparent),linear-gradient(-45deg,transparent_25%,rgba(68,68,68,.05)_25%,rgba(68,68,68,.05)_75%,transparent_75%,transparent)] bg-[length:20px_20px]"></div>
      <div className="relative">
        <FileUploader />
      </div>
    </div>
  );
}

export default App;