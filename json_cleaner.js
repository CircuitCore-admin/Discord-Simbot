const fs = require('fs');
const path = require('path');

// ✅ Ensure Folder Exists
function ensureFolderExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`📁 Created folder: ${directory}`);
    }
}

// ✅ Rename JSON File to Include '-c.json'
function renameJsonFileToC(inputPath) {
    if (!fs.existsSync(inputPath)) {
        console.error('❌ File does not exist:', inputPath);
        return null;
    }

    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);

    if (ext !== '.json' || baseName.endsWith('-c')) {
        console.log(`⏩ Skipping already cleaned or invalid file ${baseName}`);
        return null;
    }

    const newFileName = `${baseName}-c${ext}`;
    const newPath = path.join(dir, newFileName);

    fs.renameSync(inputPath, newPath);
    console.log(`✅ Renamed: ${inputPath} → ${newPath}`);
    return newPath;
}

// ✅ Convert UTF-16 LE to UTF-8
function cleanJsonFile(inputPath, outputPath) {
    try {
        // Read the file in UTF-16 LE encoding
        const rawBuffer = fs.readFileSync(inputPath);
        const utf16Content = rawBuffer.toString('utf16le');

        // Convert the content to UTF-8 encoding
        const utf8Content = Buffer.from(utf16Content, 'utf8');

        // Write the converted content to the new output file with '-c.json' suffix
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

        if (path.extname(file) !== '.json' || file.endsWith('-c.json')) {
            console.log(`⏩ Skipping invalid file: ${file}`);
            return;
        }

        // Rename the original file in the input directory
        const renamedInputPath = renameJsonFileToC(inputPath);
        if (renamedInputPath) {
            // Create the output path with '-c.json' suffix
            const outputFileName = path.basename(renamedInputPath);
            const outputPath = path.join(outputDir, outputFileName);

            // Copy the renamed file to the output directory
            fs.copyFileSync(renamedInputPath, outputPath);
            console.log(`📄 Copied: ${renamedInputPath} → ${outputPath}`);

            // Convert the copied file to UTF-8 encoding
            cleanJsonFile(outputPath, outputPath);
        }
    });

    console.log('🎯 All files have been renamed, copied, and converted from UTF-16 LE to UTF-8.');
}

// ✅ Export
module.exports = {
    cleanJsonFile,
    cleanJsonFilesInDirectory
};