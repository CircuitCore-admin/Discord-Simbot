// leaderboard-frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
    const [tracks, setTracks] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState('');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [sortColumn, setSortColumn] = useState('lap_time');
    const [sortOrder, setSortOrder] = useState('asc');

    const [excludeInvalidLaps, setExcludeInvalidLaps] = useState(false); // New state for the toggle

    // State for driver details expansion
    const [expandedDriverId, setExpandedDriverId] = useState(null); // Stores user_id of the expanded driver
    const [expandedDriverLaps, setExpandedDriverLaps] = useState(null); // Stores laps for the expanded driver
    const [loadingExpandedLaps, setLoadingExpandedLaps] = useState(false);
    const [expandedLapsError, setExpandedLapsError] = useState(null);

    const sortableColumnsMap = {
        'Lap Time': 'lap_time',
        'S1': 's1_time',
        'S2': 's2_time',
        'S3': 's3_time',
        'Driver': 'driver_name',
        'Team': 'team_name',
        'Date': 'submission_date',
        'Valid': 'is_valid',
        'Custom Setup': 'custom_setup'
    };

    const handleSort = (columnName) => {
        const dbColumnName = sortableColumnsMap[columnName];
        if (!dbColumnName) return;

        if (sortColumn === dbColumnName) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(dbColumnName);
            setSortOrder('asc');
        }
    };

    // Fetch tracks (no change)
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
                    setSelectedTrack(data[0]);
                }
            } catch (e) {
                console.error("Failed to fetch tracks:", e);
                setError("Failed to load tracks. Please try again later.");
            }
        };
        fetchTracks();
    }, []);

    // Fetch leaderboard data
    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!selectedTrack) return;

            setLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `http://localhost:3000/api/leaderboard?track=${encodeURIComponent(selectedTrack)}&sortColumn=${sortColumn}&sortOrder=${sortOrder}&excludeInvalid=${excludeInvalidLaps}`
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
    }, [selectedTrack, sortColumn, sortOrder, excludeInvalidLaps]); // Add excludeInvalidLaps to dependency array

    const handleTrackChange = (event) => {
        setSelectedTrack(event.target.value);
    };

    const handleExcludeInvalidToggle = () => {
        setExcludeInvalidLaps(prev => !prev);
    };

    const getSortIcon = (columnDbName) => {
        if (sortColumn === columnDbName) {
            return sortOrder === 'asc' ? '▲' : '▼';
        }
        return '';
    };

    // New: Function to fetch a specific driver's *all* laps for a track
    const toggleDriverLaps = async (userId, trackName) => {
        if (expandedDriverId === userId) {
            setExpandedDriverId(null); // Collapse if already expanded
            setExpandedDriverLaps(null);
            setExpandedLapsError(null);
            return;
        }

        setExpandedDriverId(userId); // Expand this driver
        setLoadingExpandedLaps(true);
        setExpandedLapsError(null);
        setExpandedDriverLaps(null); // Clear previous laps

        try {
            const response = await fetch(
                `http://localhost:3000/api/driverLaps?userId=${encodeURIComponent(userId)}&track=${encodeURIComponent(trackName)}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setExpandedDriverLaps(data);
        } catch (e) {
            console.error("Failed to fetch driver's laps:", e);
            setExpandedLapsError("Failed to load driver's laps. Please try again later.");
        } finally {
            setLoadingExpandedLaps(false);
        }
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

                <div className="toggle-container">
                    <input
                        type="checkbox"
                        id="excludeInvalid"
                        checked={excludeInvalidLaps}
                        onChange={handleExcludeInvalidToggle}
                    />
                    <label htmlFor="excludeInvalid">Exclude Invalid Laps</label>
                </div>
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
                                <th>Rank</th>
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
                                <React.Fragment key={entry.user_id}> {/* Use user_id as key for Fragment */}
                                    <tr className={expandedDriverId === entry.user_id ? 'expanded' : ''}>
                                        <td>{index + 1}</td>
                                        <td>{entry.track_location_name}</td>
                                        <td
                                            className="driver-name-link"
                                            onClick={() => toggleDriverLaps(entry.user_id, entry.track_location_name)}
                                            title="Click to see all laps for this driver on this track"
                                        >
                                            {entry.driver_name} {expandedDriverId === entry.user_id ? '▲' : '▼'} {/* Show expand/collapse icon */}
                                        </td>
                                        <td>{entry.team_name}</td>
                                        <td>{entry.lap_time}</td>
                                        <td>{entry.s1_time}</td>
                                        <td>{entry.s2_time}</td>
                                        <td>{entry.s3_time}</td>
                                        <td>{entry.is_valid ? '✅ Yes' : '❌ No'}</td>
                                        <td>{String(entry.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td>
                                        <td>{new Date(entry.submission_date).toLocaleDateString()}</td>
                                    </tr>
                                    {expandedDriverId === entry.user_id && (
                                        <tr>
                                            <td colSpan="11"> {/* Span all columns */}
                                                {loadingExpandedLaps && <p className="loading-message">Loading driver's laps...</p>}
                                                {expandedLapsError && <p className="error-message">{expandedLapsError}</p>}
                                                {!loadingExpandedLaps && !expandedLapsError && expandedDriverLaps && expandedDriverLaps.length > 0 ? (
                                                    <table className="nested-laps-table">
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
                                                            {expandedDriverLaps.map((lap, lapIndex) => (
                                                                <tr key={lap.id || lapIndex}> {/* Use lap.id as key if available, fallback to index */}
                                                                    <td>{lap.lap_time}</td>
                                                                    <td>{lap.s1_time}</td>
                                                                    <td>{lap.s2_time}</td>
                                                                    <td>{lap.s3_time}</td>
                                                                    <td>{lap.is_valid ? '✅ Yes' : '❌ No'}</td>
                                                                    <td>{String(lap.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td>
                                                                    <td>{new Date(lap.submission_date).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                ) : (
                                                    !loadingExpandedLaps && !expandedLapsError && <p className="no-data-message">No additional lap data found for this driver on this track.</p>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default App;