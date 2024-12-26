// const { getCarClass, getCarModel } = require('./helpers/carClassHelper');

// console.log(getCarClass(0)); // Should return 'GT3'
// console.log(getCarModel(0)); // Should return 'Porsche 991 GT3 R 2018'
// console.log(getCarClass(985)); // Should return 'UNKNOWN'
// console.log(getCarModel(999)); // Should return 'Unknown Model'
// // 


const db = require('./services/database');
const carModels = require('./data/carModels');

async function populateCarInfo() {
    try {
        for (const [carClass, cars] of Object.entries(carModels)) {
            for (const [carId, carModel] of Object.entries(cars)) {
                await db.query(`
                    INSERT INTO car_info (car_id, car_model, car_class)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (car_id) DO UPDATE 
                    SET car_model = EXCLUDED.car_model,
                        car_class = EXCLUDED.car_class;
                `, [parseInt(carId), carModel, carClass]);
                
                console.log(`✅ Inserted: ${carModel} (${carClass})`);
            }
        }
        console.log('🚀 All car models have been successfully added to car_info.');
    } catch (error) {
        console.error('❌ Failed to populate car_info:', error.message);
    } finally {
        process.exit();
    }
}

populateCarInfo();
