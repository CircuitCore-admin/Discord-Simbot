// leaderboard-frontend/src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Helper function to get Discord CDN URL for guild icons
const getGuildIconUrl = (guildId, iconHash) => {
    if (!iconHash) return `https://cdn.discordapp.com/embed/avatars/0.png`; // Generic Discord server icon
    // Discord CDN for guild icons: https://discord.com/developers/docs/reference#image-formatting
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=32`;
};

// Helper function to get Discord CDN URL for user avatars
const getUserAvatarUrl = (userId, avatarHash) => {
    if (!avatarHash) {
        // Fallback for default avatar, considering Discord's new username system
        // Uses the fixed placeholder image now instead of discriminator math
        return `https://discord.com/assets/f9bb9c4af2b15d3126f001fe48c6680a.png`; // Generic Discord logo placeholder
    }
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=32`;
};

// Helper function to format date and time as "6/29/2025 16:08:56"
const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() is 0-indexed
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${month}/${day}/${year}\n${hours}:${minutes}:${seconds}`;
};


function App() {
    const [tracks, setTracks] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState('');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(false); // Used for general loading states, including initial API calls
    const [error, setError] = useState(null);

    const [sortColumn, setSortColumn] = useState('lap_time');
    const [sortOrder, setSortOrder] = useState('asc');

    // State for Discord authentication
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [discordUser, setDiscordUser] = useState(null); // Stores user info if logged in
    const [userGuilds, setUserGuilds] = useState([]); // Stores guilds the user is in (that have leaderboards)

    const [selectedGuildId, setSelectedGuildId] = useState('');

    // State for driver details expansion (for the nested table of all laps)
    const [expandedDriverId, setExpandedDriverId] = useState(null);
    const [expandedDriverLaps, setExpandedDriverLaps] = useState(null);
    const [loadingExpandedLaps, setLoadingExpandedLaps] = useState(false);
    const [expandedLapsError, setExpandedLapsError] = useState(null);

    // State for main leaderboard card expansion on mobile
    const [expandedCardUserId, setExpandedCardUserId] = useState(null);


    // State for custom guild dropdown visibility
    const [showGuildDropdown, setShowGuildDropdown] = useState(false);
    const dropdownRef = useRef(null); // Ref for custom dropdown to handle clicks outside

    // State for CSV download loading
    const [downloadingCSV, setDownloadingCSV] = useState(false);

    // State for Dark Mode
    const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

    // New state for "Stay Logged In" checkbox
    const [stayLoggedIn, setStayLoggedIn] = useState(true); // Default to true


    const sortableColumnsMap = {
        'Lap Time': 'lap_time',
        'S1': 's1_time',
        'S2': 's2_time',
        'S3': 's3_time',
        'Driver': 'discord_tag',
        'Date': 'submission_date',
        'Custom Setup': 'custom_setup',
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

    // --- Discord OAuth Handling & Session Check ---
    useEffect(() => {
        const checkAuthStatus = async () => {
            setLoading(true); // Set loading true at the start of initial data fetch
            setError(null);
            try {
                // Use the new testing domain
                const response = await fetch('https://bottesting.circuitcore.net/auth/me');
                const data = await response.json();

                if (data.isAuthenticated) {
                    setIsAuthenticated(true);
                    setDiscordUser(data.user);
                    setUserGuilds(data.guilds);
                    if (data.guilds.length > 0) {
                        setSelectedGuildId(data.guilds[0].id);
                    }
                } else {
                    // If not authenticated via session, check for OAuth callback code
                    const params = new URLSearchParams(window.location.search);
                    const code = params.get('code');

                    if (code) {
                        // Clear the code from the URL immediately after processing
                        window.history.pushState({}, document.title, window.location.pathname);

                        try {
                            // Use the new testing domain
                            const callbackResponse = await fetch('https://bottesting.circuitcore.net/auth/discord/callback', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ code }),
                            });

                            if (!callbackResponse.ok) {
                                throw new Error(`Discord OAuth callback failed: ${callbackResponse.statusText}`);
                            }

                            const callbackData = await callbackResponse.json();
                            setIsAuthenticated(true);
                            setDiscordUser(callbackData.user);
                            setUserGuilds(callbackData.guilds);
                            if (callbackData.guilds.length > 0) {
                                setSelectedGuildId(callbackData.guilds[0].id);
                            }
                        } catch (e) {
                            console.error("Error during Discord authentication callback:", e);
                            setError("Failed to authenticate with Discord. Please try again.");
                            setIsAuthenticated(false);
                        }
                    }
                }
            } catch (e) {
                console.error("Error checking auth status or during initial Discord authentication:", e);
                setError("Failed to connect to authentication server. Please try again later.");
                setIsAuthenticated(false);
            } finally {
                setLoading(false); // Set loading false after initial data fetch completes or fails
            }
        };

        checkAuthStatus();
    }, []); // Empty dependency array means this runs once on mount

    // Effect to handle clicks outside the custom guild dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowGuildDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    const handleDiscordLogin = () => {
        // Append stayLoggedIn preference to the redirect URL
        // Use the new testing domain
        window.location.href = `https://bottesting.circuitcore.net/auth/discord?stayLoggedIn=${stayLoggedIn}`;
    };

    const handleDiscordLogout = async () => {
        try {
            // Use the new testing domain
            const response = await fetch('https://bottesting.circuitcore.net/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error("Backend logout failed:", response.statusText);
            }

            // Clear all relevant client-side states
            setIsAuthenticated(false);
            setDiscordUser(null);
            setUserGuilds([]);
            setSelectedGuildId('');
            setSelectedTrack('');
            setLeaderboardData([]);
            setExpandedDriverId(null);
            setExpandedDriverLaps(null);
            setExpandedLapsError(null);
            setExpandedCardUserId(null); // Clear expanded card state


            // Optional: Redirect to homepage or refresh after logout
            // window.location.href = '/';
            // window.location.reload();

        } catch (e) {
            console.error("Error during Discord logout:", e);
            // Even if logout fails on the backend, clear client-side state for responsiveness
            setIsAuthenticated(false);
            setDiscordUser(null);
            setUserGuilds([]);
            setSelectedGuildId('');
            setSelectedTrack('');
            setLeaderboardData([]);
            setExpandedDriverId(null);
            setExpandedDriverLaps(null);
            setExpandedLapsError(null);
            setExpandedCardUserId(null); // Clear expanded card state
        }
    };


    // Fetch tracks
    useEffect(() => {
        const fetchTracks = async () => {
            // Only fetch if authenticated and a guild is selected
            if (!isAuthenticated || !selectedGuildId) {
                setTracks([]);
                return;
            }

            try {
                setLoading(true); // Set loading true when fetching tracks (if not already true from initial auth check)
                setError(null);
                // Use the new testing domain
                const response = await fetch(`https://bottesting.circuitcore.net/api/tracks?guildId=${encodeURIComponent(selectedGuildId)}`);
                if (!response.ok) {
                    // Check for unauthorized status explicitly
                    if (response.status === 401 || response.status === 403) {
                        setIsAuthenticated(false); // Session might have expired or user is not allowed
                        setDiscordUser(null);
                        setUserGuilds([]);
                        setSelectedGuildId('');
                        setError("Your session expired or you don't have access. Please log in again.");
                        return;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setTracks(data);
                if (!data.includes(selectedTrack) && data.length > 0) {
                    setSelectedTrack(data[0]);
                } else if (data.length === 0) {
                    setSelectedTrack('');
                }
            } catch (e) {
                console.error("Failed to fetch tracks:", e);
                setError("Failed to load tracks. Please try again later.");
            } finally {
                setLoading(false); // Set loading false after fetching tracks
            }
        };
        fetchTracks();
    }, [isAuthenticated, selectedGuildId, selectedTrack]);


    // Fetch leaderboard data
    useEffect(() => {
        const fetchLeaderboard = async () => {
            // Only fetch if authenticated and track/guild are selected
            if (!isAuthenticated || !selectedTrack || !selectedGuildId) {
                setLeaderboardData([]);
                setLoading(false); // Ensure loading is false if conditions not met
                return;
            }

            setLoading(true);
            setError(null);
            try {
                // Use the new testing domain
                const response = await fetch(
                    `https://bottesting.circuitcore.net/api/leaderboard?track=${encodeURIComponent(selectedTrack)}&sortColumn=${sortColumn}&sortOrder=${sortOrder}&guildId=${encodeURIComponent(selectedGuildId)}`
                );
                if (!response.ok) {
                    // Check for unauthorized status explicitly
                    if (response.status === 401 || response.status === 403) {
                        setIsAuthenticated(false); // Session might have expired or user is not allowed
                        setDiscordUser(null);
                        setUserGuilds([]);
                        setSelectedGuildId('');
                        setError("Your session expired or you don't have access. Please log in again.");
                        return;
                    }
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
    }, [isAuthenticated, selectedTrack, sortColumn, sortOrder, selectedGuildId]);

    const handleTrackChange = (event) => {
        setSelectedTrack(event.target.value);
        // Collapse expanded driver details and card when track changes
        setExpandedDriverId(null);
        setExpandedDriverLaps(null);
        setExpandedLapsError(null);
        setExpandedCardUserId(null); // Collapse expanded card state
    };

    // Handle selection from custom guild dropdown
    const handleCustomGuildSelect = (guildId) => {
        setSelectedGuildId(guildId);
        setSelectedTrack('');
        setLeaderboardData([]);
        setExpandedDriverId(null); // Also collapse on guild change
        setExpandedDriverLaps(null); // Also collapse on guild change
        setExpandedLapsError(null); // Also collapse on guild change
        setExpandedCardUserId(null); // Collapse expanded card state
        setShowGuildDropdown(false); // Close dropdown after selection
    };

    const getSortIcon = (columnDbName) => {
        if (sortColumn === columnDbName) {
            return sortOrder === 'asc' ? '▲' : '▼';
        }
        return '';
    };

    // Function to toggle a specific driver's *all* laps for a track (nested table)
    // This is triggered by clicking on the driver's name within the card
    const toggleDriverLaps = async (userId, trackName, event) => {
        // Stop propagation to prevent the parent <tr>'s onClick (card expansion) from firing
        event.stopPropagation();

        if (expandedDriverId === userId) {
            setExpandedDriverId(null); // Collapse if already expanded
            setExpandedDriverLaps(null); // Clear laps too
            setExpandedLapsError(null);
            return;
        }

        if (!selectedGuildId) {
            setExpandedLapsError("Guild ID is required to fetch driver's laps.");
            return;
        }

        setExpandedDriverId(userId); // Expand this driver
        setLoadingExpandedLaps(true);
        setExpandedLapsError(null);
        setExpandedDriverLaps(null); // Clear previous laps

        try {
            // Use the new testing domain
            const response = await fetch(
                `https://bottesting.circuitcore.net/api/driverLaps?userId=${encodeURIComponent(userId)}&track=${encodeURIComponent(trackName)}&guildId=${encodeURIComponent(selectedGuildId)}`
            );
            if (!response.ok) {
                // Check for unauthorized status explicitly
                if (response.status === 401 || response.status === 403) {
                    setIsAuthenticated(false); // Session might have expired or user is not allowed
                    setDiscordUser(null);
                    setUserGuilds([]);
                    setSelectedGuildId('');
                    setError("Your session expired or you don't have access. Please log in again.");
                    return;
                }
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

    // Function to handle CSV download
    const handleDownloadCSV = async () => {
        if (!selectedTrack || !selectedGuildId) {
            console.warn('Please select a track and a Discord server before downloading CSV.');
            return;
        }
        setDownloadingCSV(true); // Set loading state for CSV
        try {
            // Use the new testing domain
            const response = await fetch(`https://bottesting.circuitcore.net/api/leaderboard/csv?track=${encodeURIComponent(selectedTrack)}&guildId=${encodeURIComponent(selectedGuildId)}`);
            if (!response.ok) {
                // Check for unauthorized status explicitly
                if (response.status === 401 || response.status === 403) {
                    setIsAuthenticated(false); // Session might have expired or user is not allowed
                    setDiscordUser(null);
                    setUserGuilds([]);
                    setSelectedGuildId('');
                    setError("Your session expired or you don't have access. Please log in again.");
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedTrack.replace(/[^a-zA-Z0-9]/g, '_')}_leaderboard.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download CSV: ' + (err.message || 'Unknown error'));
        } finally {
            setDownloadingCSV(false); // Reset loading state for CSV
        }
    };

    // Toggle Dark Mode
    const toggleDarkMode = () => {
        setIsDarkMode(prevMode => !prevMode);
    };

    // Determine current selected guild name and icon for display
    const currentSelectedGuild = userGuilds.find(g => g.id === selectedGuildId);
    const currentSelectedGuildName = currentSelectedGuild?.name || (selectedGuildId ? 'Unknown Server' : 'Select a server');
    const currentSelectedGuildIcon = currentSelectedGuild?.icon;


    return (
        <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}> {/* Apply dark/light mode class */}
            <header className="app-header">
                <h1>F1 Hotlap Leaderboard</h1>
                {/* Display user info if authenticated, otherwise login button */}
                {isAuthenticated && discordUser && (
                    <p className="user-info">
                        <img src={getUserAvatarUrl(discordUser.id, discordUser.avatar)} alt="User Avatar" className="user-avatar" onError={(e) => e.target.src = 'https://discord.com/assets/f9bb9c4af2b15d3126f001fe48c6680a.png'} />
                        Logged in as: <strong>{discordUser.global_name || discordUser.username}{discordUser.discriminator && discordUser.discriminator !== "0" ? `#${discordUser.discriminator}` : ''}</strong>
                        <button onClick={handleDiscordLogout} className="discord-logout-button">Logout</button>
                    </p>
                )}
                {/* Display current guild if selected */}
                {selectedGuildId && (
                    <p className="guild-display-message">
                        {currentSelectedGuildIcon && <img src={getGuildIconUrl(selectedGuildId, currentSelectedGuildIcon)} alt="Guild Icon" className="guild-icon-display" onError={(e) => e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'} />}
                        Displaying Leaderboard for Guild: <strong>{currentSelectedGuildName}</strong>
                    </p>
                )}
            </header>

            <div className="filter-section">
                {loading && !isAuthenticated ? ( // Show loading message only for initial auth/guild data fetch
                    <p className="loading-message">Loading authentication and server data...</p>
                ) : (
                    !isAuthenticated ? (
                        <div className="login-container">
                            <button onClick={handleDiscordLogin} className="discord-login-button">
                                <img src="https://discord.com/assets/f9bb9c4af2b15d3126f001fe48c6680a.png" alt="Discord Logo" className="discord-logo-icon" onError={(e) => e.target.style.display = 'none'} />
                                Login with Discord
                            </button>
                            <div className="stay-logged-in-checkbox">
                                <input
                                    type="checkbox"
                                    id="stayLoggedIn"
                                    checked={stayLoggedIn}
                                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                                />
                                <label htmlFor="stayLoggedIn">Stay Logged In (1 day)</label>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Custom Server Dropdown */}
                            <div className="custom-dropdown-container" ref={dropdownRef}>
                                <label htmlFor="guild-select-custom">Select Server:</label>
                                <div
                                    id="guild-select-custom"
                                    className={`dropdown-header ${showGuildDropdown ? 'open' : ''}`}
                                    onClick={() => setShowGuildDropdown(!showGuildDropdown)}
                                    tabIndex="0"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setShowGuildDropdown(prev => !prev);
                                        }
                                    }}
                                >
                                    {selectedGuildId ? (
                                        <>
                                            <img src={getGuildIconUrl(selectedGuildId, currentSelectedGuildIcon)} alt="Server Icon" className="guild-icon-header" onError={(e) => e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'} />
                                            <span>{currentSelectedGuildName}</span>
                                        </>
                                    ) : (
                                        <span>{userGuilds.length > 0 ? "Select a server" : "No leaderboards available"}</span>
                                    )}
                                    <span className="dropdown-arrow"></span>
                                </div>
                                {showGuildDropdown && (
                                    <ul className="dropdown-list">
                                        {userGuilds.length === 0 ? (
                                            <li className="dropdown-item disabled">No leaderboards available</li>
                                        ) : (
                                            userGuilds.map((guild) => (
                                                <li
                                                    key={guild.id}
                                                    className={`dropdown-item ${selectedGuildId === guild.id ? 'selected' : ''}`}
                                                    onClick={() => handleCustomGuildSelect(guild.id)}
                                                    tabIndex="0"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            handleCustomGuildSelect(guild.id);
                                                        }
                                                    }}
                                                >
                                                    <img src={getGuildIconUrl(guild.id, guild.icon)} alt="Server Icon" className="guild-icon" onError={(e) => e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'} />
                                                    {guild.name}
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                )}
                            </div>

                            <label htmlFor="track-select">Filter by Track:</label>
                            <select id="track-select" onChange={handleTrackChange} value={selectedTrack} disabled={!selectedGuildId}>
                                {tracks.length === 0 ? (
                                    <option value="">{selectedGuildId ? 'No tracks available' : 'Select a server first'}</option>
                                ) : (
                                    tracks.map((track) => (
                                        <option key={track} value={track}>
                                            {track}
                                        </option>
                                    ))
                                )}
                            </select>

                            <button onClick={handleDownloadCSV} disabled={!selectedTrack || !selectedGuildId || loading || downloadingCSV} className="download-csv-button">
                                {downloadingCSV ? 'Downloading...' : 'Download CSV'}
                            </button>
                        </>
                    )
                )}
                <button onClick={toggleDarkMode} className="dark-mode-toggle">
                    {isDarkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
                </button>
            </div>

            <div className="leaderboard-section">
                {/* Note: Leaderboard table content should go here */}
                {loading && isAuthenticated ? ( // Show loading message for leaderboard data after auth
                    <p className="loading-message">Loading leaderboard data...</p>
                ) : (
                    !isAuthenticated ? (
                        <p className="no-data-message">Please log in with Discord to view leaderboards.</p>
                    ) : (
                        <>
                            {!selectedGuildId ? (
                                <p className="no-data-message">Select a Discord server from the dropdown above to view its leaderboard.</p>
                            ) : (
                                <>
                                    {error && <p className="error-message">{error}</p>}
                                    {!error && leaderboardData.length === 0 && (
                                        <p className="no-data-message">No hotlap data available for {selectedTrack || 'the selected track'} in this guild.</p>
                                    )}
                                    {!error && leaderboardData.length > 0 && (
                                        <table className="leaderboard-table">
                                            <thead>
                                                <tr>
                                                    <th>Rank</th>
                                                    <th className="sortable" onClick={() => handleSort('Driver')}>
                                                        Driver <span className="sort-icon">{getSortIcon('discord_tag')}</span>
                                                    </th>
                                                    <th className="sortable" onClick={() => handleSort('Lap Time')}>
                                                        Lap Time <span className="sort-icon">{getSortIcon('lap_time')}</span>
                                                    </th>
                                                    <th className="sortable" onClick={() => handleSort('S1')}>
                                                        S1 <span className="sort-icon">{getSortIcon('s1_time')}</span>
                                                    </th>
                                                    <th className="sortable" onClick={() => handleSort('S2')}>
                                                        S2 <span className="sort-icon">{getSortIcon('s2_time')}</span>
                                                    </th>
                                                    <th className="sortable" onClick={() => handleSort('S3')}>
                                                        S3 <span className="sort-icon">{getSortIcon('s3_time')}</span>
                                                    </th>
                                                    <th className="sortable" onClick={() => handleSort('Custom Setup')}>
                                                        Custom Setup <span className="sort-icon">{getSortIcon('custom_setup')}</span>
                                                    </th>
                                                    <th className="sortable" onClick={() => handleSort('Date')}>
                                                        Date <span className="sort-icon">{getSortIcon('submission_date')}</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leaderboardData.map((entry, index) => (
                                                    <React.Fragment key={entry.user_id}>
                                                        {/* Main leaderboard row. Click this to expand/collapse card details on mobile. */}
                                                        {/* Add 'card-expanded' class when expandedCardUserId matches */}
                                                        <tr
                                                            className={`${expandedDriverId === entry.user_id ? 'expanded-nested-table' : ''} ${expandedCardUserId === entry.user_id ? 'card-expanded' : ''}`}
                                                            onClick={() => setExpandedCardUserId(prevId => prevId === entry.user_id ? null : entry.user_id)}
                                                        >
                                                            <td data-label="Rank">{index + 1}</td>
                                                            <td
                                                                data-label="Driver"
                                                                className={`driver-name-link ${expandedDriverId === entry.user_id ? 'nested-expanded' : ''}`}
                                                                // This onClick handles the NESTED TABLE expansion
                                                                onClick={(event) => toggleDriverLaps(entry.user_id, entry.track_location_name, event)}
                                                                title={`Click to see all laps for ${entry.discord_tag || entry.driver_name} on this track`}
                                                            >
                                                                <span title={entry.discord_tag || entry.driver_name}>
                                                                    {entry.discord_tag || entry.driver_name}
                                                                </span>
                                                                {/* Arrow for nested table expansion */}
                                                                <span className="expand-arrow">{expandedDriverId === entry.user_id ? '▲' : '▼'}</span>
                                                            </td>
                                                            <td data-label="Lap Time">{entry.lap_time}</td>
                                                            <td data-label="S1">{entry.s1_time}</td>
                                                            <td data-label="S2">{entry.s2_time}</td>
                                                            <td data-label="S3">{entry.s3_time}</td>
                                                            <td data-label="Custom Setup">{String(entry.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td>
                                                            <td data-label="Date">{formatDateTime(entry.submission_date)}</td>
                                                        </tr>
                                                        {/* This row contains the nested table of all laps, still expands on driver name click */}
                                                        {expandedDriverId === entry.user_id && (
                                                            <tr>
                                                                {/* colSpan is 8 (Rank, Driver, Lap Time, S1, S2, S3, Custom Setup, Date) */}
                                                                <td colSpan="8">
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
                                                                                    <th>Custom Setup</th>
                                                                                    <th>Date</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {expandedDriverLaps.map((lap, lapIndex) => (
                                                                                    <tr key={lap.id || lapIndex}>
                                                                                        <td data-label="Lap Time">{lap.lap_time}</td>
                                                                                        <td data-label="S1">{lap.s1_time}</td>
                                                                                        <td data-label="S2">{lap.s2_time}</td>
                                                                                        <td data-label="S3">{lap.s3_time}</td>
                                                                                        <td data-label="Custom Setup">{String(lap.custom_setup) === 'true' ? '✅ Yes' : '❌ No'}</td>
                                                                                        <td data-label="Date">{formatDateTime(lap.submission_date)}</td>
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
                                </>
                            )}
                        </>
                    )
                )}
            </div>
        </div>
    );
}

export default App;
