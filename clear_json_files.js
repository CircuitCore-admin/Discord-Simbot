const fs = require('fs');
const path = require('path');

// Function to clean JSON file
function cleanJsonFile(inputPath, outputPath) {
    try {
        // Read file content
        let rawData = fs.readFileSync(inputPath, 'utf-8');
        
        // Remove null bytes and invalid control characters
        rawData = rawData.replace(/[\x00-\x1F\x7F]/g, '');

        // Parse and validate JSON
        const jsonData = JSON.parse(rawData);

        // Write cleaned data to a new file
        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
        console.log(`✅ Cleaned: ${inputPath} → ${outputPath}`);
    } catch (err) {
        console.error(`❌ Failed to clean ${inputPath}:`, err.message);
    }
}

// Function to ensure the cleaned folder exists
function ensureCleanFolder(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        console.log(`📁 Created cleaned folder: ${directory}`);
    }
}

// Function to process all JSON files in a directory and move cleaned files
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

    console.log('🎯 All files have been processed and cleaned files are in:', outputDir);
}

// Directories
const inputDirectory = './results'; // Input folder with raw JSON files
const outputDirectory = './results_cleaned'; // Folder for cleaned JSON files

cleanJsonFilesInDirectory(inputDirectory, outputDirectory);
