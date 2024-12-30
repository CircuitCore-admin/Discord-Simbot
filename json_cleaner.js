const fs = require('fs');
const path = require('path');

// ✅ Rename JSON file to include '-c' before '.json'
function renameJsonFileToC(inputPath) {
    if (!fs.existsSync(inputPath)) {
        console.error('❌ File does not exist:', inputPath);
        return null;
    }

    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);

    if (ext !== '.json') {
        console.error('❌ The file is not a .json file:', inputPath);
        return null;
    }


    if (ext !== '.json' || ext.endsWith('-c.json')) {
        console.log(`⏩ Skipping already cleaned or invalid file ${baseName}`);
        return; // Skip non-JSON files and already cleaned files
    }

    const newFileName = `${baseName}-c${ext}`;
    const newPath = path.join(dir, newFileName);

    fs.renameSync(inputPath, newPath);
    console.log(`✅ Renamed: ${inputPath} → ${newPath}`);

    return newPath; // Return the new path for further processing
}

// ✅ Ensure the cleaned folder exists
function ensureFolderExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`📁 Created folder: ${directory}`);
    }
}

// ✅ Copy a file to the cleaned directory
function copyFileToCleaned(inputPath, outputDir) {
    ensureFolderExists(outputDir);

    const fileName = path.basename(inputPath);
    const outputPath = path.join(outputDir, fileName);

    fs.copyFileSync(inputPath, outputPath);
    console.log(`📄 Copied: ${inputPath} → ${outputPath}`);
}

// ✅ Clean a single JSON file
function cleanJsonFile(inputPath) {
    try {
        let rawData = fs.readFileSync(inputPath, 'utf-8');
        rawData = rawData.replace(/[\x00-\x1F\x7F]/g, '');

        const jsonData = JSON.parse(rawData);

        fs.writeFileSync(inputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
        console.log(`✅ Cleaned: ${inputPath}`);
    } catch (err) {
        console.error(`❌ Failed to clean ${inputPath}:`, err.message);
    }
}

// ✅ Clean, Rename, and Copy JSON files
function cleanJsonFilesInDirectory(inputDir, outputDir) {
    if (!fs.existsSync(inputDir)) {
        console.error('❌ Input directory does not exist:', inputDir);
        return;
    }

    ensureFolderExists(outputDir);

    const files = fs.readdirSync(inputDir);

    files.forEach(file => {
        const inputPath = path.join(inputDir, file);
        const ext = path.extname(file);

        if (ext !== '.json' || file.endsWith('-c.json')) {
            console.log(`⏩ Skipping already cleaned or invalid file: ${file}`);
            return; // Skip non-JSON files and already cleaned files
        }

        if (fs.statSync(inputPath).isFile()) {
            cleanJsonFile(inputPath);
            const renamedPath = renameJsonFileToC(inputPath);
            if (renamedPath) {
                copyFileToCleaned(renamedPath, outputDir);
            }
        }
    });

    // console.log('🎯 All files have been cleaned, renamed, and copied to:', outputDir);
}

// ✅ Export the functions for use in other scripts
module.exports = {
    cleanJsonFile,
    cleanJsonFilesInDirectory
};
