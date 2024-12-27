// Sample JSON data
const data = {
    "leaderBoardLines": [
      {
        "car": {
          "carId": 1027,
          "carModel": 30,
          "carGroup": "GT3",
          "carGuid": -1,
          "teamGuid": -1,
          "cupCategory": 0,
          "drivers": [
            {
              "firstName": "Dan",
              "lastName": "Watts",
              "playerId": "S76561198004846104",
              "shortName": "WAT"
            }
          ],
          "nationality": 0,
          "raceNumber": 126,
          "teamName": ""
        },
        "currentDriver": {
          "firstName": "Dan",
          "lastName": "Watts",
          "playerId": "S76561198004846104",
          "shortName": "WAT"
        },
        "currentDriverIndex": 0,
        "driverTotalTimes": [],
        "missingMandatoryPitstop": -1,
        "timing": {
          "bestLap": 116997,
          "bestSplits": [
            34465,
            49217,
            33315
          ],
          "lapCount": 3,
          "lastLap": 116997,
          "lastSplitId": 0,
          "lastSplits": [
            34465,
            49217,
            33315
          ],
          "totalTime": 893875
        }
      },
      {
        "car": {
          "carId": 1016,
          "carModel": 34,
          "carGroup": "GT3",
          "carGuid": -1,
          "teamGuid": -1,
          "cupCategory": 0,
          "drivers": [
            {
              "firstName": "Elliott",
              "lastName": "Watts",
              "playerId": "S76561198248567360",
              "shortName": "WAT"
            }
          ],
          "nationality": 0,
          "raceNumber": 7,
          "teamName": ""
        },
        "currentDriver": {
          "firstName": "Elliott",
          "lastName": "Watts",
          "playerId": "S76561198248567360",
          "shortName": "WAT"
        },
        "currentDriverIndex": 0,
        "driverTotalTimes": [],
        "missingMandatoryPitstop": -1,
        "timing": {
          "bestLap": 117850,
          "bestSplits": [
            34892,
            49527,
            33430
          ],
          "lapCount": 3,
          "lastLap": 117850,
          "lastSplitId": 1,
          "lastSplits": [
            34892,
            49527,
            33430
          ],
          "totalTime": 804952
        }
      }
    ]
  };
  
  // Cycle through every row
  data.leaderBoardLines.forEach(row => {
    console.log(`Car ID: ${row.car.carId}`);
    console.log(`Current Driver: ${row.currentDriver.firstName} ${row.currentDriver.lastName}`);
    console.log(`Best Lap: ${row.timing.bestLap}`);
    console.log('-'.repeat(20));
  });