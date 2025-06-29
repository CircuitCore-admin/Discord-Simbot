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

    // Completely REMOVED: excludeInvalidLaps state as it is no longer used
    // const [excludeInvalidLaps, setExcludeInvalidLaps] = useState(false);

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
        'Driver': 'discord_tag', // Sort by discord_tag for consistency with display
        'Team': 'team_name',
        'Date': 'submission_date',
        // Completely REMOVED: 'Valid' from sortableColumnsMap
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
                // IMPORTANT: Removed excludeInvalid parameter from fetch call as backend no longer expects it for the main leaderboard
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
        // IMPORTANT: Removed excludeInvalidLaps from dependency array as it's no longer a filter
        fetchLeaderboard();
    }, [selectedTrack, sortColumn, sortOrder]);

    const handleTrackChange = (event) => {
        setSelectedTrack(event.target.value);
    };

    // Completely REMOVED: handleExcludeInvalidToggle function

    const getSortIcon = (columnDbName) => {
        if (sortColumn === columnDbName) {
            return sortOrder === 'asc' ? '▲' : '▼';
        }
        return '';
    };

    // Function to fetch a specific driver's *all* laps for a track
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
            // This fetch still correctly includes `is_valid` in the backend query results
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

    // ADDED: Function to handle CSV download
    const handleDownloadCSV = async () => {
        if (!selectedTrack) {
            alert('Please select a track first.');
            return;
        }
        try {
            // Fetch CSV directly from the backend endpoint, no excludeInvalid param
            const response = await fetch(`http://localhost:3000/api/leaderboard/csv?track=${encodeURIComponent(selectedTrack)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob(); // Get the response as a Blob
            const url = window.URL.createObjectURL(blob); // Create a temporary URL for the blob
            const a = document.createElement('a'); // Create a temporary anchor element
            a.href = url;
            a.download = `${selectedTrack.replace(/[^a-zA-Z0-9]/g, '_')}_leaderboard.csv`; // Set the download filename
            document.body.appendChild(a); // Append to body (necessary for Firefox)
            a.click(); // Programmatically click the link to trigger download
            a.remove(); // Clean up the element
            window.URL.revokeObjectURL(url); // Release the object URL
        } catch (err) {
            alert('Failed to download CSV: ' + (err.message || 'Unknown error'));
            console.error('Error downloading CSV:', err);
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

                {/* COMPLETELY REMOVED: The entire toggle-container div for "Exclude Invalid Laps" */}

                {/* ADDED: CSV Download Button */}
                <button onClick={handleDownloadCSV} disabled={!selectedTrack || loading} style={{ marginLeft: '15px', padding: '8px 12px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #ccc' }}>
                    Download CSV
                </button>
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
                                    Driver {getSortIcon('discord_tag')}
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
                                {/* COMPLETELY REMOVED: 'Valid' column header from the main table */}
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
                                <React.Fragment key={entry.user_id}>
                                    <tr className={expandedDriverId === entry.user_id ? 'expanded' : ''}>
                                        <td>{index + 1}</td>
                                        <td>{entry.track_location_name}</td>
                                        <td
                                            className="driver-name-link"
                                            onClick={() => toggleDriverLaps(entry.user_id, entry.track_location_name)}
                                            title="Click to see all laps for this driver on this track"
                                        >
                                            {entry.discord_tag || entry.driver_name} {expandedDriverId === entry.user_id ? '▲' : '▼'}
                                        </td>
                                        <td>{entry.team_name}</td>
                                        <td>{entry.lap_time}</td>
                                        <td>{entry.s1_time}</td>
                                        <td>{entry.s2_time}</td>
                                        <td>{entry.s3_time}</td>
                                        {/* COMPLETELY REMOVED: 'Valid' cell from the main leaderboard table */}
                                        <td>{String(entry.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td>
                                        {/* Updated to show full date, time, and timezone on hover (via title attribute) and a more readable format for display */}
                                        <td title={new Date(entry.submission_date).toLocaleString()}>
                                            {new Date(entry.submission_date).toLocaleDateString()}
                                        </td>
                                    </tr>
                                    {expandedDriverId === entry.user_id && (
                                        <tr>
                                            {/* colSpan is 9: Rank, Track, Driver, Team, Lap Time, S1, S2, S3, Custom Setup, Date (10 columns total)
                                                The nested table expands across all columns of the parent table,
                                                so the colSpan should match the number of columns in the parent table.
                                                Rank (1) + Track (1) + Driver (1) + Team (1) + Lap Time (1) + S1 (1) + S2 (1) + S3 (1) + Custom Setup (1) + Date (1) = 10 columns.
                                            */}
                                            <td colSpan="10">
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
                                                                {/* REMOVED: 'Valid' column header from nested table */}
                                                                <th>Custom Setup</th>
                                                                <th>Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {expandedDriverLaps.map((lap, lapIndex) => (
                                                                <tr key={lap.id || lapIndex}>
                                                                    <td>{lap.lap_time}</td>
                                                                    <td>{lap.s1_time}</td>
                                                                    <td>{lap.s2_time}</td>
                                                                    <td>{lap.s3_time}</td>
                                                                    {/* REMOVED: 'Valid' cell from nested table */}
                                                                    <td>{String(lap.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td>
                                                                    <td title={new Date(lap.submission_date).toLocaleString()}>
                                                                        {new Date(lap.submission_date).toLocaleDateString()}
                                                                    </td>
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
