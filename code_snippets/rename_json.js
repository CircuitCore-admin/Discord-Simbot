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
const filePath = path.join(__dirname, './results_cleaned/241216_224343_R(4).json'); // Replace with your file path
renameJsonFileToC(filePath);