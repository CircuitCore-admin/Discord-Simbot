// leaderboard-frontend/src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// --- SVG Icon Components ---
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" className="icon-check">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
    </svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" className="icon-x">
        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
    </svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 1 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
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
    // Initialize states from localStorage or default values
    const [tracks, setTracks] = useState([]);
    const [selectedTrack, setSelectedTrack] = useState(() => localStorage.getItem('selectedTrack') || '');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [sortColumn, setSortColumn] = useState('lap_time');
    const [sortOrder, setSortOrder] = useState('asc');

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [discordUser, setDiscordUser] = useState(null);
    const [userGuilds, setUserGuilds] = useState([]);
    const [selectedGuildId, setSelectedGuildId] = useState(() => localStorage.getItem('selectedGuildId') || '');

    const [expandedDriverId, setExpandedDriverId] = useState(null);
    const [expandedDriverLaps, setExpandedDriverLaps] = useState(null);
    const [loadingExpandedLaps, setLoadingExpandedLaps] = useState(false);
    const [expandedLapsError, setExpandedLapsError] = useState(null);

    const [downloadingCSV, setDownloadingCSV] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [stayLoggedIn, setStayLoggedIn] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');


    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(25);

    // Special guild ID for centre name feature
    const SPECIAL_GUILD_ID = '1042747615856562187';
    const isSpecialGuild = selectedGuildId === SPECIAL_GUILD_ID;

    // Effect to save selectedGuildId to localStorage
    useEffect(() => {
        localStorage.setItem('selectedGuildId', selectedGuildId);
    }, [selectedGuildId]);

    // Effect to save selectedTrack to localStorage
    useEffect(() => {
        localStorage.setItem('selectedTrack', selectedTrack);
    }, [selectedTrack]);

    const sortableColumnsMap = {
        'Lap Time': 'lap_time', 'S1': 's1_time', 'S2': 's2_time', 'S3': 's3_time',
        'Driver': 'discord_tag', 'Date': 'submission_date', 'Custom Setup': 'custom_setup',
        'Centre': 'centre_name',
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
                const response = await fetch('https://f1-hotlaps.circuitcore.net/auth/me');
                const data = await response.json();
                if (data.isAuthenticated) {
                    setIsAuthenticated(true);
                    setDiscordUser(data.user);
                    setUserGuilds(data.guilds);
                    // If a guild was saved in localStorage, ensure it's still available
                    const storedGuildId = localStorage.getItem('selectedGuildId');
                    if (storedGuildId && data.guilds.some(guild => guild.id === storedGuildId)) {
                        setSelectedGuildId(storedGuildId);
                    } else if (data.guilds.length > 0) {
                        setSelectedGuildId(data.guilds[0].id);
                    } else {
                        setSelectedGuildId(''); // No guilds available
                    }
                } else {
                    const params = new URLSearchParams(window.location.search);
                    const code = params.get('code');
                    if (code) {
                        window.history.pushState({}, document.title, window.location.pathname);
                        const callbackResponse = await fetch('https://f1-hotlaps.circuitcore.net/auth/discord/callback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code }),
                        });
                        if (!callbackResponse.ok) throw new Error('OAuth callback failed');
                        const callbackData = await callbackResponse.json();
                        setIsAuthenticated(true);
                        setDiscordUser(callbackData.user);
                        setUserGuilds(callbackData.guilds);
                        // After successful OAuth, prioritize the first guild if nothing was saved
                        if (callbackData.guilds.length > 0) {
                            setSelectedGuildId(callbackData.guilds[0].id);
                        } else {
                            setSelectedGuildId('');
                        }
                    }
                }
            } catch (e) {
                setError("Failed to connect to authentication server.");
                console.error("Auth error:", e);
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
                const response = await fetch(`https://f1-hotlaps.circuitcore.net/api/tracks?guildId=${encodeURIComponent(selectedGuildId)}`);
                if (!response.ok) throw new Error('Failed to fetch tracks');
                const data = await response.json();
                setTracks(data);
                // If a track was saved in localStorage, ensure it's still available for the selected guild
                const storedTrack = localStorage.getItem('selectedTrack');
                if (storedTrack && data.includes(storedTrack)) {
                    setSelectedTrack(storedTrack);
                } else if (data.length > 0) {
                    setSelectedTrack(data[0]);
                } else {
                    setSelectedTrack(''); // No tracks for this guild
                }
            } catch (e) {
                setError("Failed to load tracks.");
                console.error("Tracks error:", e);
            }
        };
        fetchTracks();
    }, [isAuthenticated, selectedGuildId]);

    useEffect(() => {
        if (!isAuthenticated || !selectedTrack || !selectedGuildId) { setLeaderboardData([]); return; }
        setLoading(true);
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(`https://f1-hotlaps.circuitcore.net/api/leaderboard?track=${encodeURIComponent(selectedTrack)}&sortColumn=${sortColumn}&sortOrder=${sortOrder}&guildId=${encodeURIComponent(selectedGuildId)}`);
                if (!response.ok) throw new Error('Failed to fetch leaderboard');
                const data = await response.json();
                setLeaderboardData(data);
            } catch (e) {
                setError("Failed to load leaderboard data.");
                console.error("Leaderboard error:", e);
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
        setSelectedTrack(''); // Reset track when guild changes
        setLeaderboardData([]);
        setExpandedDriverId(null);
        setExpandedDriverLaps(null);
        setCurrentPage(1);
    };

    const toggleDriverLaps = async (identifier, trackName, event) => {
        if(event) event.stopPropagation();
        
        // Check against the new identifier
        if (expandedDriverId === identifier) {
            setExpandedDriverId(null);
            return;
        }
        
        setExpandedDriverId(identifier); // Set the expanded ID to the tag
        setLoadingExpandedLaps(true);
        try {
            // CHANGE: Send 'discordTag' query parameter instead of 'userId'
            const response = await fetch(`https://f1-hotlaps.circuitcore.net/api/driverLaps?discordTag=${encodeURIComponent(identifier)}&track=${encodeURIComponent(trackName)}&guildId=${encodeURIComponent(selectedGuildId)}`);
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

        if (startDate) {
            const startDateTime = new Date(startDate);
            matchesStartDate = submissionDate >= startDateTime;
        }

        if (endDate) {
            const endDateTime = new Date(endDate);
            matchesEndDate = submissionDate <= endDateTime;
        }

        return matchesSearchTerm && matchesStartDate && matchesEndDate;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentLeaderboardItems = filteredLeaderboard.slice(indexOfFirstItem, indexOfLastItem);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const handleDiscordLogin = () => { window.location.href = `https://f1-hotlaps.circuitcore.net/auth/discord?stayLoggedIn=${stayLoggedIn}`; };

    const handleDiscordLogout = async () => {
        try {
            const response = await fetch('https://f1-hotlaps.circuitcore.net/auth/logout', {
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
                localStorage.removeItem('selectedGuildId');
                localStorage.removeItem('selectedTrack');
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
            }).toString();

            const response = await fetch(`https://f1-hotlaps.circuitcore.net/api/leaderboard/csv?${params}`);
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
                        <div className="control-group">
                            <label htmlFor="startDate">Start</label>
                            <input
                                type="datetime-local"
                                id="startDate"
                                className="search-input"
                                value={startDate}
                                onChange={(e) => {
                                    const newStartDate = e.target.value;
                                    setStartDate(newStartDate);
                                    setCurrentPage(1);
                                    if (endDate && new Date(endDate) < new Date(newStartDate)) {
                                        setEndDate(newStartDate);
                                    }
                                }}
                            />
                        </div>
                        <div className="control-group">
                            <label htmlFor="endDate">End</label>
                            <input
                                type="datetime-local"
                                id="endDate"
                                className="search-input"
                                value={endDate}
                                onChange={(e) => {
                                    const newEndDate = e.target.value;
                                    setEndDate(newEndDate);
                                    setCurrentPage(1);
                                    if (startDate && new Date(newEndDate) < new Date(startDate)) {
                                        setEndDate(startDate);
                                    }
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
                        <div className="stay-logged-in-checkbox"><input type="checkbox" id="stay" checked={stayLoggedIn} onChange={(e) => setStayLoggedIn(e.target.checked)} /><label htmlFor="stay">Stay Logged In</label></div>
                    </div>
                )}
                {loading && leaderboardData.length === 0 && <div className="spinner-container"><div className="spinner"></div></div>}

                {error && <p className="error-message">{error}</p>}

                {!error && isAuthenticated && filteredLeaderboard.length > 0 && (
                    <>
                        <table className={`leaderboard-table ${loading ? 'is-updating' : ''} ${isSpecialGuild ? 'has-centre-column' : ''}`}>
                            <thead>
                                <tr>
                                    <th className="text-center">Rank</th>
                                    {/* CHANGED THIS LINE */}
                                    <th className="sortable text-center" onClick={() => handleSort('Driver')}>Driver {getSortIcon(sortableColumnsMap['Driver'])}</th>

                                    {isSpecialGuild && <th className="sortable text-center" onClick={() => handleSort('Centre')}>Centre {getSortIcon(sortableColumnsMap['Centre'])}</th>}
                                    <th className="sortable text-center" onClick={() => handleSort('Lap Time')}>Lap Time {getSortIcon(sortableColumnsMap['Lap Time'])}</th>
                                    <th className="sortable text-center" onClick={() => handleSort('S1')}>S1 {getSortIcon(sortableColumnsMap['S1'])}</th>
                                    <th className="sortable text-center" onClick={() => handleSort('S2')}>S2 {getSortIcon(sortableColumnsMap['S2'])}</th>
                                    <th className="sortable text-center" onClick={() => handleSort('S3')}>S3 {getSortIcon(sortableColumnsMap['S3'])}</th>
                                    <th className="sortable text-center" onClick={() => handleSort('Custom Setup')}>Setup {getSortIcon(sortableColumnsMap['Custom Setup'])}</th>
                                    <th className="sortable text-center" onClick={() => handleSort('Date')}>Date {getSortIcon(sortableColumnsMap['Date'])}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentLeaderboardItems.map((entry, i) => {
                                    const rank = indexOfFirstItem + i + 1;
                                    return (
                                        <React.Fragment key={entry.user_id}>
                                            <tr className={entry.user_id === discordUser?.id ? 'is-current-user' : ''}>
                                                <td data-label="Rank" className="text-center">{rank}</td>

                                                {/* CHANGED THIS LINE */}
                                                <td data-label="Driver" className="text-center">
                                                    {entry.lap_count > 1
                                                        ? (
                                                            <span
                                                                className="driver-name-link"
                                                                onClick={e => { e.stopPropagation(); toggleDriverLaps(entry.discord_tag, entry.track_location_name); }}
                                                                title="Click to view all laps"
                                                            >
                                                                <span>{entry.discord_tag || entry.driver_name}</span>
                                                                <span className={`expand-arrow ${expandedDriverId === entry.discord_tag ? 'is-expanded' : ''}`}>
                                                                    <ChevronDownIcon />
                                                                </span>
                                                            </span>
                                                        )
                                                        : <span>{entry.discord_tag || entry.driver_name}</span>
                                                    }
                                                </td>

                                                {isSpecialGuild && <td data-label="Centre" className="text-center">{entry.centre_name || '-'}</td>}
                                                <td data-label="Lap Time" className="text-center">{entry.lap_time}</td>
                                                <td data-label="S1" className="text-center">{entry.s1_time}</td>
                                                <td data-label="S2" className="text-center">{entry.s2_time}</td>
                                                <td data-label="S3" className="text-center">{entry.s3_time}</td>
                                                <td data-label="Custom Setup" className="text-center">{entry.custom_setup ? <CheckIcon /> : <XIcon />}</td>
                                                <td data-label="Date" className="text-center" title={new Date(entry.submission_date).toLocaleString()}>{formatDateTime(entry.submission_date)}</td>
                                            </tr>
                                            {expandedDriverId === entry.user_id && (
                                                loadingExpandedLaps ? <tr><td colSpan={isSpecialGuild ? "9" : "8"}><div className="spinner-container" style={{ height: '100px' }}><div className="spinner"></div></div></td></tr> :
                                                    expandedLapsError ? <tr><td colSpan={isSpecialGuild ? "9" : "8"}><p className="error-message">{expandedLapsError}</p></td></tr> :
                                                        expandedDriverLaps && expandedDriverLaps.length > 1 && (
                                                            expandedDriverLaps.filter(lap => lap.submission_date !== entry.submission_date).map(lap => (
                                                                <tr key={lap.id} className="additional-lap-row">
                                                                    <td></td>

                                                                    {/* This cell is for the (empty) driver column, so it should also be centered */}
                                                                    <td className="text-center"></td>

                                                                    {isSpecialGuild && <td data-label="Centre" className="text-center">{lap.centre_name || '-'}</td>}
                                                                    <td data-label="Lap Time" className="text-center">{lap.lap_time}</td>
                                                                    <td data-label="S1" className="text-center">{lap.s1_time}</td>
                                                                    <td data-label="S2" className="text-center">{lap.s2_time}</td>
                                                                    <td data-label="S3" className="text-center">{lap.s3_time}</td>
                                                                    <td data-label="Custom Setup" className="text-center">{lap.custom_setup ? <CheckIcon /> : <XIcon />}</td>
                                                                    <td data-label="Date" className="text-center" title={new Date(lap.submission_date).toLocaleString()}>{formatDateTime(lap.submission_date)}</td>
                                                                </tr>
                                                            ))
                                                        )
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                                {filteredLeaderboard.length === 0 && selectedTrack && (
                                    <tr>
                                        <td colSpan={isSpecialGuild ? "9" : "8"} className="no-data-message">
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
                {!isAuthenticated && !loading && (
                    <p className="no-data-message">Please log in with Discord to view leaderboards.</p>
                )}
                {isAuthenticated && !selectedTrack && !loading && tracks.length > 0 && (
                    <p className="no-data-message">Please select a track to view the leaderboard.</p>
                )}
                {isAuthenticated && !selectedTrack && !loading && tracks.length === 0 && (
                    <p className="no-data-message">No tracks available for this server. Try selecting a different server or check if any hotlaps have been submitted.</p>
                )}
            </div>
        </div>
    );
}

export default App;