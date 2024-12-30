const fs = require('fs');
const path = require('path');

// ✅ Clean a single JSON file
function cleanJsonFile(inputPath, outputPath) {
    try {
        let rawData = fs.readFileSync(inputPath, 'utf-8');
        rawData = rawData.replace(/[\x00-\x1F\x7F]/g, '');

        const jsonData = JSON.parse(rawData);

        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
        console.log(`✅ Cleaned: ${inputPath} → ${outputPath}`);
    } catch (err) {
        console.error(`❌ Failed to clean ${inputPath}:`, err.message);
    }
}

// ✅ Ensure the cleaned folder exists
function ensureCleanFolder(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`📁 Created cleaned folder: ${directory}`);
    }
}

// ✅ Clean all JSON files in a directory
function cleanJsonFilesInDirectory(inputDir, outputDir) {
    if (!fs.existsSync(inputDir)) {
        console.error('❌ Input directory does not exist:', inputDir);
        return;
    }

    ensureCleanFolder(outputDir);

    const files = fs.readdirSync(inputDir);

    files.forEach(file => {
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, file.replace('.json', '_clean.json'));

        if (fs.statSync(inputPath).isFile() && path.extname(file) === '.json') {
            cleanJsonFile(inputPath, outputPath);
        }
    });

    console.log('🎯 All files have been cleaned and saved in:', outputDir);
}

// ✅ Export the functions for use in other scripts
module.exports = {
    cleanJsonFile,
    cleanJsonFilesInDirectory
};
