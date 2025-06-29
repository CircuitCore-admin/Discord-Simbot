// leaderboard-frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
    const [tracks, setTracks] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState('');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for sorting: [columnName, order]
    const [sortColumn, setSortColumn] = useState('lap_time'); // Default sort by lap time
    const [sortOrder, setSortOrder] = useState('asc');      // Default ascending

    // New state for driver details modal
    const [selectedDriverLaps, setSelectedDriverLaps] = useState(null); // Stores laps for selected driver
    const [isDriverDetailsModalOpen, setIsDriverDetailsModalOpen] = useState(false);
    const [loadingDriverLaps, setLoadingDriverLaps] = useState(false);
    const [driverLapsError, setDriverLapsError] = useState(null);

    // Helper to map UI column names to database column names for sorting
    const sortableColumnsMap = {
        'Lap Time': 'lap_time',
        'S1': 's1_time',
        'S2': 's2_time',
        'S3': 's3_time',
        'Driver': 'driver_name',
        'Team': 'team_name',
        'Date': 'submission_date',
        'Valid': 'is_valid',
        'Custom Setup': 'custom_setup' // Added custom setup to sortable columns
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
            return sortOrder === 'asc' ? '▲' : '▼'; // Use Unicode arrows
        }
        return '';
    };

    // New: Function to fetch a specific driver's laps for a track
    const fetchDriverLaps = async (driverName, trackName) => {
        setLoadingDriverLaps(true);
        setDriverLapsError(null);
        try {
            const response = await fetch(
                `http://localhost:3000/api/driverLaps?driver=${encodeURIComponent(driverName)}&track=${encodeURIComponent(trackName)}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setSelectedDriverLaps(data);
            setIsDriverDetailsModalOpen(true);
        } catch (e) {
            console.error("Failed to fetch driver's laps:", e);
            setDriverLapsError("Failed to load driver's laps. Please try again later.");
        } finally {
            setLoadingDriverLaps(false);
        }
    };

    const closeDriverDetailsModal = () => {
        setIsDriverDetailsModalOpen(false);
        setSelectedDriverLaps(null);
        setDriverLapsError(null);
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
                                <th>Rank</th> {/* New Rank Column */}
                                <th>Track</th>
                                <th className="sortable" onClick={() => handleSort('Driver')}>
                                    Driver {getSortIcon('driver_name')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('Team')}>
                                    Team {getSortIcon('team_name')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('Lap Time')}>
                                    Lap Time {getSortIcon('lap_time')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('S1')}>
                                    S1 {getSortIcon('s1_time')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('S2')}>
                                    S2 {getSortIcon('s2_time')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('S3')}>
                                    S3 {getSortIcon('s3_time')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('Valid')}>
                                    Valid {getSortIcon('is_valid')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('Custom Setup')}>
                                    Custom Setup {getSortIcon('custom_setup')}
                                </th>
                                <th className="sortable" onClick={() => handleSort('Date')}>
                                    Date {getSortIcon('submission_date')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboardData.map((entry, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td> {/* Rank based on current order */}
                                    <td>{entry.track_location_name}</td>
                                    <td
                                        className="driver-name-link" // Add class for styling and click
                                        onClick={() => fetchDriverLaps(entry.driver_name, entry.track_location_name)}
                                        title="Click to see all laps for this driver on this track"
                                    >
                                        {entry.driver_name}
                                    </td>
                                    <td>{entry.team_name}</td>
                                    <td>{entry.lap_time}</td>
                                    <td>{entry.s1_time}</td>
                                    <td>{entry.s2_time}</td>
                                    <td>{entry.s3_time}</td>
                                    <td>{entry.is_valid ? '✅ Yes' : '❌ No'}</td>
                                    <td>{String(entry.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td> {/* Ensure custom_setup displays correctly */}
                                    <td>{new Date(entry.submission_date).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Driver Details Modal */}
            {isDriverDetailsModalOpen && (
                <div className="modal-overlay" onClick={closeDriverDetailsModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Laps for {selectedDriverLaps && selectedDriverLaps.length > 0 ? selectedDriverLaps[0].driver_name : 'Selected Driver'} on {selectedTrack}</h2>
                        {loadingDriverLaps && <p>Loading driver's laps...</p>}
                        {driverLapsError && <p className="error-message">{driverLapsError}</p>}
                        {!loadingDriverLaps && !driverLapsError && selectedDriverLaps && selectedDriverLaps.length > 0 ? (
                            <table className="driver-laps-table">
                                <thead>
                                    <tr>
                                        <th>Lap Time</th>
                                        <th>S1</th>
                                        <th>S2</th>
                                        <th>S3</th>
                                        <th>Valid</th>
                                        <th>Custom Setup</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedDriverLaps.map((lap, index) => (
                                        <tr key={index}>
                                            <td>{lap.lap_time}</td>
                                            <td>{lap.s1_time}</td>
                                            <td>{lap.s2_time}</td>
                                            <td>{lap.s3_time}</td>
                                            <td>{lap.is_valid ? '✅ Yes' : '❌ No'}</td>
                                            <td>{String(lap.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td>
                                            <td>{new Date(lap.submission_date).toLocaleString()}</td> {/* Use toLocaleString for full date/time */}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            !loadingDriverLaps && !driverLapsError && <p>No detailed lap data found for this driver on this track.</p>
                        )}
                        <button onClick={closeDriverDetailsModal} className="close-modal-button">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;