const fs = require('fs');
const path = require('path');

// ✅ Rename JSON file to include '-c' before '.json'
function renameJsonFileToC(inputPath) {
    if (!fs.existsSync(inputPath)) {
        console.error('❌ File does not exist:', inputPath);
        return;
    }

    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);

    if (ext !== '.json') {
        console.error('❌ The file is not a .json file:', inputPath);
        return;
    }

    const newFileName = `${baseName}-c${ext}`;
    const newPath = path.join(dir, newFileName);

    fs.renameSync(inputPath, newPath);
    console.log(`✅ Renamed: ${inputPath} → ${newPath}`);
}

// Example Usage
const filePath = path.join(__dirname, 'F:/Event Management/Online/Server 3 WGC-3 250 connections/server/results/241216_200002_FP.json'); // Replace with your file path
renameJsonFileToC(filePath);