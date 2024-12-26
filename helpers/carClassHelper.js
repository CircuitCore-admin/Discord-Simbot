const carModels = require('../data/carModels');

// Get Car Class
function getCarClass(carModelId) {
    for (const [classKey, cars] of Object.entries(carModels)) {
        if (cars.hasOwnProperty(carModelId)) {
            return classKey; // Return class like GT3, GT4, etc.
        }
    }
    return 'UNKNOWN';
}

// Get Car Model
function getCarModel(carModelId) {
    for (const cars of Object.values(carModels)) {
        if (cars.hasOwnProperty(carModelId)) {
            return cars[carModelId]; // Return car model name
        }
    }
    return 'Unknown Model';
}

module.exports = { getCarClass, getCarModel };
