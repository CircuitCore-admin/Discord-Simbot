// leaderboard-frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState('');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New state for sorting: [columnName, order]
  const [sortColumn, setSortColumn] = useState('lap_time'); // Default sort by lap time
  const [sortOrder, setSortOrder] = useState('asc'); // Default ascending

  // Helper to map UI column names to database column names for sorting
  const sortableColumnsMap = {
    'Lap Time': 'lap_time',
    'S1': 's1_time',
    'S2': 's2_time',
    'S3': 's3_time',
    'Driver': 'driver_name', // Example: also allow sorting by driver name
    'Team': 'team_name', // Example: also allow sorting by team name
    'Date': 'submission_date',
    'Valid': 'is_valid'
    // Add other sortable columns as needed
  };

  // Function to handle header clicks for sorting
  const handleSort = (columnName) => {
    const dbColumnName = sortableColumnsMap[columnName];
    if (!dbColumnName) return; // Not a sortable column

    if (sortColumn === dbColumnName) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); // Toggle order
    } else {
      setSortColumn(dbColumnName); // Set new column
      setSortOrder('asc'); // Default to ascending for new column
    }
  };

  // Function to fetch tracks
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/tracks');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTracks(data);
        if (data.length > 0) {
          setSelectedTrack(data[0]); // Select the first track by default
        }
      } catch (e) {
        console.error("Failed to fetch tracks:", e);
        setError("Failed to load tracks. Please try again later.");
      }
    };
    fetchTracks();
  }, []);

  // Function to fetch leaderboard data based on selected track and sorting
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!selectedTrack) return;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `http://localhost:3000/api/leaderboard?track=${encodeURIComponent(selectedTrack)}&sortColumn=${sortColumn}&sortOrder=${sortOrder}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setLeaderboardData(data);
      } catch (e) {
        console.error("Failed to fetch leaderboard:", e);
        setError("Failed to load leaderboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [selectedTrack, sortColumn, sortOrder]); // Re-fetch whenever these change

  const handleTrackChange = (event) => {
    setSelectedTrack(event.target.value);
  };

  const getSortIcon = (columnDbName) => {
    if (sortColumn === columnDbName) {
      return sortOrder === 'asc' ? 'asc' : 'desc';
    }
    return '';
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>F1 Hotlap Leaderboard</h1>
      </header>

      <div className="filter-section">
        <label htmlFor="track-select">Filter by Track:</label>
        <select id="track-select" onChange={handleTrackChange} value={selectedTrack}>
          {tracks.length === 0 ? (
            <option value="">No tracks available</option>
          ) : (
            tracks.map((track) => (
              <option key={track} value={track}>
                {track}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="leaderboard-section">
        {loading && <p className="loading-message">Loading leaderboard...</p>}
        {error && <p className="error-message">{error}</p>}
        {!loading && !error && leaderboardData.length === 0 && (
          <p className="no-data-message">No hotlap data available for {selectedTrack}.</p>
        )}
        {!loading && !error && leaderboardData.length > 0 && (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Track</th>
                <th className="sortable" onClick={() => handleSort('Driver')}>
                  Driver <span className={`sort-icon ${getSortIcon('driver_name')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('Team')}>
                  Team <span className={`sort-icon ${getSortIcon('team_name')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('Lap Time')}>
                  Lap Time <span className={`sort-icon ${getSortIcon('lap_time')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('S1')}>
                  S1 <span className={`sort-icon ${getSortIcon('s1_time')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('S2')}>
                  S2 <span className={`sort-icon ${getSortIcon('s2_time')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('S3')}>
                  S3 <span className={`sort-icon ${getSortIcon('s3_time')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('Valid')}>
                  Valid <span className={`sort-icon ${getSortIcon('is_valid')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('Custom Setup')}>
                  Custom Setup <span className={`sort-icon ${getSortIcon('custom_setup')}`}></span>
                </th>
                <th className="sortable" onClick={() => handleSort('Date')}>
                  Date <span className={`sort-icon ${getSortIcon('submission_date')}`}></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.track_location_name}</td>
                  <td>{entry.driver_name}</td>
                  <td>{entry.team_name}</td>
                  <td>{entry.lap_time}</td>
                  <td>{entry.s1_time}</td>
                  <td>{entry.s2_time}</td>
                  <td>{entry.s3_time}</td>
                  <td>{entry.is_valid ? '✅ Yes' : '❌ No'}</td>
                  <td>{entry.custom_setup === 'TRUE' ? '✅ Yes' : '❌ No'}</td>
                  <td>{new Date(entry.submission_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;