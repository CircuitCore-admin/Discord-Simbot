const fs = require('fs');
const path = require('path');

// ✅ Ensure Folder Exists
function ensureFolderExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`📁 Created folder: ${directory}`);
    }
}

// ✅ Convert UTF-16 LE to UTF-8
function cleanJsonFile(inputPath, outputPath) {
    try {
        // Read the file in UTF-16 LE encoding
        const rawBuffer = fs.readFileSync(inputPath);
        const utf16Content = rawBuffer.toString('utf16le');

        // Convert the content to UTF-8 encoding
        const utf8Content = Buffer.from(utf16Content, 'utf8');

        // Write the converted content to the new output file
        fs.writeFileSync(outputPath, utf8Content);
        console.log(`✅ Converted and saved: ${inputPath} → ${outputPath}`);
    } catch (err) {
        console.error(`❌ Failed to convert file: ${inputPath}`, err.message);
    }
}

// ✅ Process Directory
function cleanJsonFilesInDirectory(inputDir, outputDir) {
    if (!fs.existsSync(inputDir)) {
        console.error('❌ Input directory does not exist:', inputDir);
        return;
    }

    ensureFolderExists(outputDir);

    const files = fs.readdirSync(inputDir);

    files.forEach(file => {
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, file);

        if (path.extname(file) !== '.json') {
            console.log(`⏩ Skipping non-JSON file: ${file}`);
            return;
        }

        cleanJsonFile(inputPath, outputPath);
    });

    console.log('🎯 All files have been converted from UTF-16 LE to UTF-8.');
}

// ✅ Export
module.exports = {
    cleanJsonFile,
    cleanJsonFilesInDirectory
};
