// leaderboard-frontend/src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// --- SVG Icon Components ---
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="icon-check">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" className="icon-x">
        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
    </svg>
);

const DownloadIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
    </svg>
);

// --- Reusable Custom Dropdown Component ---
const CustomDropdown = ({ options, selectedValue, onSelect, getIconUrl, getPrefix, defaultLabel, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => (opt.id || opt) === selectedValue);
    const selectedLabel = selectedOption ? (selectedOption.name || selectedOption) : defaultLabel;
    const selectedIcon = selectedOption && getIconUrl ? getIconUrl(selectedOption.id, selectedOption.icon) : null;
    const selectedPrefix = selectedOption && getPrefix ? getPrefix(selectedOption.name || selectedOption) : null;
    
    return (
        <div className="custom-dropdown-container" ref={dropdownRef}>
            <div
                className={`dropdown-header ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                tabIndex={disabled ? -1 : 0}
            >
                {selectedPrefix && <span className="dropdown-prefix">{selectedPrefix}</span>}
                {selectedIcon && <img src={selectedIcon} alt="Icon" className="guild-icon-header" onError={(e) => e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'} />}
                <span className="dropdown-label">{selectedLabel}</span>
                <span className="dropdown-arrow"><ChevronDownIcon /></span>
            </div>
            {isOpen && (
                <ul className="dropdown-list">
                    {options.length === 0 ? (
                        <li className="dropdown-item disabled">No options available</li>
                    ) : (
                        options.map((option) => (
                            <li
                                key={option.id || option}
                                className={`dropdown-item ${selectedValue === (option.id || option) ? 'selected' : ''}`}
                                onClick={() => {
                                    onSelect(option.id || option);
                                    setIsOpen(false);
                                }}
                            >
                                {getPrefix && <span className="dropdown-prefix">{getPrefix(option.name || option)}</span>}
                                {getIconUrl && <img src={getIconUrl(option.id, option.icon)} alt="Option icon" className="guild-icon" onError={(e) => e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png'} />}
                                {option.name || option}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

// --- Helper Functions ---
const getGuildIconUrl = (guildId, iconHash) => {
    if (!guildId) return null;
    if (!iconHash) return `https://cdn.discordapp.com/embed/avatars/0.png`;
    return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=32`;
};

const getUserAvatarUrl = (userId, avatarHash) => {
    if (!avatarHash) return `https://discord.com/assets/f9bb9c4af2b15d3126f001fe48c6680a.png`;
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=32`;
};

const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
};

const trackToCountryCode = {
    'BAHRAIN': 'BH', 'JEDDAH': 'SA', 'AUSTRALIA': 'AU', 'AZERBAIJAN': 'AZ', 'MIAMI': 'US',
    'IMOLA': 'IT', 'MONACO': 'MC', 'SPAIN': 'ES', 'CANADA': 'CA', 'AUSTRIA': 'AT',
    'GREAT BRITAIN': 'GB', 'HUNGARY': 'HU', 'BELGIUM': 'BE', 'NETHERLANDS': 'NL',
    'MONZA': 'IT', 'SINGAPORE': 'SG', 'JAPAN': 'JP', 'QATAR': 'QA',
    'UNITED STATES': 'US', 'MEXICO': 'MX', 'BRAZIL': 'BR', 'LAS VEGAS': 'US', 'ABU DHABI': 'AE',
    'PORTUGAL': 'PT', 'CHINA': 'CN', 'FRANCE': 'FR'
};

const getFlagForTrack = (trackName) => {
    const normalizedTrackName = trackName.toUpperCase();
    const countryCode = trackToCountryCode[normalizedTrackName];
    if (!countryCode) return null;
    
    const base = 0x1F1A5;
    const char1 = String.fromCodePoint(base + countryCode.charCodeAt(0));
    const char2 = String.fromCodePoint(base + countryCode.charCodeAt(1));
    return `${char1}${char2}`;
};

const Pagination = ({ itemsPerPage, totalItems, paginate, currentPage }) => {
    const pageNumbers = [];
    for (let i = 1; i <= Math.ceil(totalItems / itemsPerPage); i++) { pageNumbers.push(i); }
    if (pageNumbers.length <= 1) return null;
    return (
        <nav><ul className="pagination">{pageNumbers.map(number => (
            <li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}>
                <a onClick={() => paginate(number)} href="#!" className="page-link">{number}</a>
            </li>
        ))}</ul></nav>
    );
};

function App() {
    const [tracks, setTracks] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState('');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [sortColumn, setSortColumn] = useState('lap_time');
    const [sortOrder, setSortOrder] = useState('asc');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [discordUser, setDiscordUser] = useState(null);
    const [userGuilds, setUserGuilds] = useState([]);
    const [selectedGuildId, setSelectedGuildId] = useState('');

    const [expandedDriverId, setExpandedDriverId] = useState(null);
    const [expandedDriverLaps, setExpandedDriverLaps] = useState(null);
    const [loadingExpandedLaps, setLoadingExpandedLaps] = useState(false);
    const [expandedLapsError, setExpandedLapsError] = useState(null);

    const [downloadingCSV, setDownloadingCSV] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [stayLoggedIn, setStayLoggedIn] = useState(true);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState(''); // State for start date filter
    const [endDate, setEndDate] = useState('');     // State for end date filter
    const [startTime, setStartTime] = useState(''); // State for start time filter
    const [endTime, setEndTime] = useState('');     // State for end time filter


    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(25);

    const sortableColumnsMap = {
        'Lap Time': 'lap_time', 'S1': 's1_time', 'S2': 's2_time', 'S3': 's3_time',
        'Driver': 'discord_tag', 'Date': 'submission_date', 'Custom Setup': 'custom_setup',
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

    const getSortIcon = (columnDbName) => {
        if (sortColumn === columnDbName) {
            const style = sortOrder === 'desc' ? { transform: 'rotate(180deg)' } : {};
            return (
                <span className="sort-icon" style={style}>
                    <ChevronDownIcon />
                </span>
            );
        }
        return null;
    };

    useEffect(() => {
        const checkAuthStatus = async () => {
            setLoading(true);
            try {
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
                    const params = new URLSearchParams(window.location.search);
                    const code = params.get('code');
                    if (code) {
                        window.history.pushState({}, document.title, window.location.pathname);
                        const callbackResponse = await fetch('https://bottesting.circuitcore.net/auth/discord/callback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code }),
                        });
                        if (!callbackResponse.ok) throw new Error('OAuth callback failed');
                        const callbackData = await callbackResponse.json();
                        setIsAuthenticated(true);
                        setDiscordUser(callbackData.user);
                        setUserGuilds(callbackData.guilds);
                        if (callbackData.guilds.length > 0) {
                            setSelectedGuildId(callbackData.guilds[0].id);
                        }
                    }
                }
            } catch (e) {
                setError("Failed to connect to authentication server.");
            } finally {
                setLoading(false);
            }
        };
        checkAuthStatus();
    }, []);
    
    useEffect(() => {
        if (!isAuthenticated || !selectedGuildId) { setTracks([]); return; }
        const fetchTracks = async () => {
            try {
                const response = await fetch(`https://bottesting.circuitcore.net/api/tracks?guildId=${encodeURIComponent(selectedGuildId)}`);
                if (!response.ok) throw new Error('Failed to fetch tracks');
                const data = await response.json();
                setTracks(data);
                if (!data.includes(selectedTrack) && data.length > 0) {
                    setSelectedTrack(data[0]);
                } else if (data.length === 0) {
                    setSelectedTrack('');
                }
            } catch (e) { setError("Failed to load tracks."); }
        };
        fetchTracks();
    }, [isAuthenticated, selectedGuildId]);

    useEffect(() => {
        if (!isAuthenticated || !selectedTrack || !selectedGuildId) { setLeaderboardData([]); return; }
        setLoading(true);
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(`https://bottesting.circuitcore.net/api/leaderboard?track=${encodeURIComponent(selectedTrack)}&sortColumn=${sortColumn}&sortOrder=${sortOrder}&guildId=${encodeURIComponent(selectedGuildId)}`);
                if (!response.ok) throw new Error('Failed to fetch leaderboard');
                const data = await response.json();
                setLeaderboardData(data);
            } catch (e) {
                setError("Failed to load leaderboard data.");
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [isAuthenticated, selectedTrack, sortColumn, sortOrder, selectedGuildId]);
    
    const handleTrackChange = (value) => {
        setSelectedTrack(value);
        setExpandedDriverId(null);
        setExpandedDriverLaps(null);
        setCurrentPage(1);
    };

    const handleCustomGuildSelect = (guildId) => {
        setSelectedGuildId(guildId);
        setSelectedTrack('');
        setLeaderboardData([]);
        setExpandedDriverId(null);
        setExpandedDriverLaps(null);
        setCurrentPage(1);
    };

    const toggleDriverLaps = async (userId, trackName, event) => {
        if(event) event.stopPropagation();
        if (expandedDriverId === userId) {
            setExpandedDriverId(null);
            return;
        }
        setExpandedDriverId(userId);
        setLoadingExpandedLaps(true);
        try {
            const response = await fetch(`https://bottesting.circuitcore.net/api/driverLaps?userId=${encodeURIComponent(userId)}&track=${encodeURIComponent(trackName)}&guildId=${encodeURIComponent(selectedGuildId)}`);
            if (!response.ok) throw new Error("Failed to fetch driver's laps");
            const data = await response.json();
            setExpandedDriverLaps(data);
        } catch (e) {
            setExpandedLapsError("Failed to load driver's laps.");
        } finally {
            setLoadingExpandedLaps(false);
        }
    };
    
    const filteredLeaderboard = leaderboardData.filter(entry => {
        const matchesSearchTerm = entry.discord_tag.toLowerCase().includes(searchTerm.toLowerCase());
        
        const submissionDate = new Date(entry.submission_date);
        let matchesStartDate = true;
        let matchesEndDate = true;

        // Apply start date/time filter
        if (startDate) {
            const startDateTime = new Date(`${startDate}T${startTime || '00:00'}:00`);
            matchesStartDate = submissionDate >= startDateTime;
        }

        // Apply end date/time filter
        if (endDate) {
            const endDateTime = new Date(`${endDate}T${endTime || '23:59'}:59.999`);
            matchesEndDate = submissionDate <= endDateTime;
        }

        return matchesSearchTerm && matchesStartDate && matchesEndDate;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentLeaderboardItems = filteredLeaderboard.slice(indexOfFirstItem, indexOfLastItem);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const handleDiscordLogin = () => { window.location.href = `https://bottesting.circuitcore.net/auth/discord?stayLoggedIn=${stayLoggedIn}`; };
    
    const handleDiscordLogout = async () => {
        try {
            const response = await fetch('https://bottesting.circuitcore.net/auth/logout', {
                method: 'POST',
            });
            if (response.ok) {
                setIsAuthenticated(false);
                setDiscordUser(null);
                setUserGuilds([]);
                setSelectedGuildId('');
                setSelectedTrack('');
                setLeaderboardData([]);
                setExpandedDriverId(null);
                setExpandedDriverLaps(null);
                setCurrentPage(1);
                setError(null);
            } else {
                console.error('Logout failed:', response.statusText);
                setError('Failed to log out.');
            }
        } catch (e) {
            console.error('Error during logout:', e);
            setError('Failed to connect to logout server.');
        }
    };

    const handleDownloadCSV = async () => {
        setDownloadingCSV(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                track: selectedTrack,
                guildId: selectedGuildId,
                startDate: startDate,
                endDate: endDate,
                startTime: startTime,
                endTime: endTime
            }).toString();

            const response = await fetch(`https://bottesting.circuitcore.net/api/leaderboard/csv?${params}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to download CSV: ${errorText}`);
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
        } catch (e) {
            console.error('Error downloading CSV:', e);
            setError(e.message);
        } finally {
            setDownloadingCSV(false);
        }
    };

    const toggleDarkMode = () => setIsDarkMode(p => !p);
    
    return (
        <div className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
            <header className="app-header">
                <h1>F1 Hotlap Leaderboard</h1>
                {isAuthenticated && discordUser && (
                    <p className="user-info">
                        <img src={getUserAvatarUrl(discordUser.id, discordUser.avatar)} alt="User Avatar" className="user-avatar" onError={(e) => e.target.src = 'https://discord.com/assets/f9bb9c4af2b15d3126f001fe48c6680a.png'} />
                        Logged in as: <strong>{discordUser.global_name || discordUser.username}{discordUser.discriminator && discordUser.discriminator !== "0" ? `#${discordUser.discriminator}` : ''}</strong>
                        <button onClick={handleDiscordLogout} className="discord-logout-button">Logout</button>
                    </p>
                )}
            </header>
            
            <div className="controls-section">
                {isAuthenticated && (
                    <>
                        <div className="control-group">
                            <label>Server</label>
                            <CustomDropdown
                                options={userGuilds}
                                selectedValue={selectedGuildId}
                                onSelect={handleCustomGuildSelect}
                                getIconUrl={getGuildIconUrl}
                                defaultLabel="Select a Server"
                            />
                        </div>
                        <div className="control-group">
                            <label>Track</label>
                            <CustomDropdown
                                options={tracks.map(t => ({ id: t, name: t }))}
                                selectedValue={selectedTrack}
                                onSelect={handleTrackChange}
                                getPrefix={getFlagForTrack}
                                defaultLabel="Select a Track"
                                disabled={!selectedGuildId || tracks.length === 0}
                            />
                        </div>
                         <div className="control-group">
                            <label>Find Driver</label>
                             <input
                                type="text"
                                placeholder="Search by name..."
                                className="search-input"
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        {/* Date and Time Filter Inputs */}
                        <div className="control-group">
                            <label htmlFor="startDate">Start Date</label>
                            <input
                                type="date"
                                id="startDate"
                                className="search-input"
                                value={startDate}
                                onChange={(e) => {
                                    const newStartDate = e.target.value;
                                    setStartDate(newStartDate);
                                    setCurrentPage(1);

                                    // If newStartDate is later than current endDate, adjust endDate
                                    if (endDate && new Date(endDate) < new Date(newStartDate)) {
                                        setEndDate(newStartDate);
                                    }
                                }}
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="startTime">Start Time</label>
                            <input
                                type="time"
                                id="startTime"
                                className="search-input"
                                value={startTime}
                                onChange={(e) => {
                                    setStartTime(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="endDate">End Date</label>
                            <input
                                type="date"
                                id="endDate"
                                className="search-input"
                                value={endDate}
                                onChange={(e) => {
                                    const newEndDate = e.target.value;
                                    setEndDate(newEndDate);
                                    setCurrentPage(1);

                                    // If newEndDate is earlier than current startDate, adjust endDate
                                    if (startDate && new Date(newEndDate) < new Date(startDate)) {
                                        const adjustedEndDate = new Date(startDate);
                                        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1); // Set to one day after start date
                                        setEndDate(adjustedEndDate.toISOString().split('T')[0]);
                                    }
                                }}
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="endTime">End Time</label>
                            <input
                                type="time"
                                id="endTime"
                                className="search-input"
                                value={endTime}
                                onChange={(e) => {
                                    setEndTime(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div className="control-group actions">
                             <button onClick={handleDownloadCSV} disabled={!selectedTrack || !selectedGuildId || loading || downloadingCSV} className="control-button">
                                <DownloadIcon />
                                {downloadingCSV ? 'Downloading...' : 'CSV'}
                            </button>
                            <button onClick={toggleDarkMode} className="control-button">
                                {isDarkMode ? '🌞' : '🌙'}
                            </button>
                        </div>
                    </>
                )}
            </div>
            
            <div className="leaderboard-section">
                {!isAuthenticated && (
                     <div className="login-container">
                        <button onClick={handleDiscordLogin} className="discord-login-button">Login with Discord</button>
                        <div className="stay-logged-in-checkbox"><input type="checkbox" id="stay" checked={stayLoggedIn} onChange={(e)=>setStayLoggedIn(e.target.checked)} /><label htmlFor="stay">Stay Logged In</label></div>
                    </div>
                )}
                 {/* Only show the full page spinner on initial load */}
                {loading && leaderboardData.length === 0 && <div className="spinner-container"><div className="spinner"></div></div>}

                {error && <p className="error-message">{error}</p>}

                {/* Render the table if we have data, even if it's currently loading a new sort */}
                {!error && isAuthenticated && leaderboardData.length > 0 && (
                    <>
                        <table className={`leaderboard-table ${loading ? 'is-updating' : ''}`}>
                             <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th className="sortable" onClick={() => handleSort('Driver')}>Driver {getSortIcon(sortableColumnsMap['Driver'])}</th>
                                    <th className="sortable" onClick={() => handleSort('Lap Time')}>Lap Time {getSortIcon(sortableColumnsMap['Lap Time'])}</th>
                                    <th className="sortable" onClick={() => handleSort('S1')}>S1 {getSortIcon(sortableColumnsMap['S1'])}</th>
                                    <th className="sortable" onClick={() => handleSort('S2')}>S2 {getSortIcon(sortableColumnsMap['S2'])}</th>
                                    <th className="sortable" onClick={() => handleSort('S3')}>S3 {getSortIcon(sortableColumnsMap['S3'])}</th>
                                    <th className="sortable" onClick={() => handleSort('Custom Setup')}>Setup {getSortIcon(sortableColumnsMap['Custom Setup'])}</th>
                                    <th className="sortable" onClick={() => handleSort('Date')}>Date {getSortIcon(sortableColumnsMap['Date'])}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentLeaderboardItems.map((entry, i) => {
                                    const rank = indexOfFirstItem + i + 1;
                                    return (
                                    <React.Fragment key={entry.user_id}>
                                        <tr className={entry.user_id === discordUser?.id ? 'is-current-user' : ''}>
                                          <td data-label="Rank">{rank}</td>
                                          <td data-label="Driver">
                                            {entry.lap_count > 1
                                              ? (
                                                <span
                                                  className="driver-name-link"
                                                  onClick={e => { e.stopPropagation(); toggleDriverLaps(entry.user_id, entry.track_location_name); }}
                                                  title="Click to view all laps"
                                                >
                                                  <span>{entry.discord_tag || entry.driver_name}</span>
                                                  <span className={`expand-arrow ${expandedDriverId === entry.user_id ? 'is-expanded' : ''}`}>
                                                    <ChevronDownIcon/>
                                                  </span>
                                                </span>
                                              )
                                              : <span>{entry.discord_tag || entry.driver_name}</span>
                                            }
                                          </td>
                                            <td data-label="Lap Time">{entry.lap_time}</td>
                                            <td data-label="S1">{entry.s1_time}</td>
                                            <td data-label="S2">{entry.s2_time}</td>
                                            <td data-label="S3">{entry.s3_time}</td>
                                            <td data-label="Custom Setup">{entry.custom_setup ? <CheckIcon /> : <XIcon />}</td>
                                            <td data-label="Date" title={new Date(entry.submission_date).toLocaleString()}>{formatDateTime(entry.submission_date)}</td>
                                        </tr>
                                        {expandedDriverId === entry.user_id && (
                                            loadingExpandedLaps ? <tr><td colSpan="8"><div className="spinner-container" style={{height: '100px'}}><div className="spinner"></div></div></td></tr> :
                                            expandedLapsError ? <tr><td colSpan="8"><p className="error-message">{expandedLapsError}</p></td></tr> :
                                            expandedDriverLaps && expandedDriverLaps.length > 1 && (
                                                expandedDriverLaps.filter(lap => lap.submission_date !== entry.submission_date).map(lap => (
                                                    <tr key={lap.id} className="additional-lap-row">
                                                        <td></td><td></td>
                                                        <td data-label="Lap Time">{lap.lap_time}</td>
                                                        <td data-label="S1">{lap.s1_time}</td>
                                                        <td data-label="S2">{lap.s2_time}</td>
                                                        <td data-label="S3">{lap.s3_time}</td>
                                                        <td data-label="Custom Setup">{lap.custom_setup ? <CheckIcon /> : <XIcon />}</td>
                                                        <td data-label="Date" title={new Date(lap.submission_date).toLocaleString()}>{formatDateTime(lap.submission_date)}</td>
                                                    </tr>
                                                ))
                                            )
                                        )}
                                    </React.Fragment>
                                    )
                                })}
                                 {filteredLeaderboard.length === 0 && selectedTrack && (
                                    <tr>
                                        <td colSpan="8" className="no-data-message">
                                            No results found for "{searchTerm}" on this track.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <Pagination 
                            itemsPerPage={itemsPerPage}
                            totalItems={filteredLeaderboard.length}
                            paginate={paginate}
                            currentPage={currentPage}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
