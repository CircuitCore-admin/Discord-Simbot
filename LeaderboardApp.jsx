import React, { useState, useEffect } from 'react';

// Base URL for your Node.js API server
// In a real deployment, replace 'http://localhost:3000' with your actual server URL.
// Make sure this matches the WEB_PORT you set in .env
const API_BASE_URL = 'http://localhost:3000'; // IMPORTANT: Adjust this if your bot runs on a different host/port

// Helper function to format milliseconds back to M:SS.mmm
function formatMsToLapTime(ms) {
  if (ms === null) return 'N/A';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

const App = () => {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState('');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch unique tracks
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tracks`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTracks(['All Tracks', ...data]); // Add 'All Tracks' option
      } catch (err) {
        console.error('Error fetching tracks:', err);
        setError('Failed to load tracks.');
      }
    };
    fetchTracks();
  }, []);

  // Fetch leaderboard data based on selected track
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      let url = `${API_BASE_URL}/api/leaderboard`;
      if (selectedTrack && selectedTrack !== 'All Tracks') {
        url += `?track=${encodeURIComponent(selectedTrack)}`;
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setLeaderboardData(data);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedTrack]); // Re-fetch when selectedTrack changes

  const handleTrackChange = (event) => {
    setSelectedTrack(event.target.value);
  };

  const downloadCSV = () => {
    if (!leaderboardData.length) {
      alert('No data to download!'); // Using alert for simple notification as per instructions
      return;
    }

    const headers = [
      'Track Location', 'Driver Name', 'Team Name', 'Lap Time',
      'S1 Time', 'S2 Time', 'S3 Time', 'Is Valid', 'Custom Setup', 'Submission Date'
    ];

    const rows = leaderboardData.map(row => [
      row.track_location_name,
      row.driver_name,
      row.team_name,
      row.lap_time, // Keep as string for CSV
      row.s1_time,
      row.s2_time,
      row.s3_time,
      row.is_valid ? 'Yes' : 'No',
      row.custom_setup,
      new Date(row.submission_date).toLocaleString() // Format date for CSV
    ]);

    let csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection for download attribute
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedTrack || 'all_tracks'}_leaderboard.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-inter antialiased">
      <div className="max-w-7xl mx-auto bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
        <h1 className="text-4xl font-extrabold text-white mb-6 text-center">F1 Hotlap Leaderboard</h1>

        {error && <div className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">{error}</div>}

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0 md:space-x-4">
          <div className="w-full md:w-1/2">
            <label htmlFor="track-select" className="block text-gray-300 text-sm font-medium mb-2">
              Filter by Track:
            </label>
            <div className="relative">
              <select
                id="track-select"
                className="block w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none transition duration-150 ease-in-out cursor-pointer"
                value={selectedTrack}
                onChange={handleTrackChange}
              >
                {tracks.map((track) => (
                  <option key={track} value={track}>
                    {track}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-300">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 6.096 6.924 4.682 8.338l4.611 4.612z"/>
                </svg>
              </div>
            </div>
          </div>

          <button
            onClick={downloadCSV}
            className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md shadow-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75"
          >
            Download CSV
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-xl text-indigo-400">Loading leaderboard...</div>
        ) : leaderboardData.length === 0 ? (
          <div className="text-center py-10 text-xl text-gray-500">No hotlaps found for this track.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-700 shadow-md">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider rounded-tl-lg">Track</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Lap Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">S1</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">S2</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">S3</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Valid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Custom Setup</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider rounded-tr-lg">Date</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {leaderboardData.map((lap, index) => (
                  <tr key={lap.message_id || index} className="hover:bg-gray-700 transition-colors duration-150 ease-in-out">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{lap.track_location_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lap.driver_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lap.team_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-400">{lap.lap_time}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lap.s1_time || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lap.s2_time || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lap.s3_time || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {lap.is_valid ? <span className="text-green-500">✅ Yes</span> : <span className="text-red-500">❌ No</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {lap.custom_setup === 'Yes' ? <span className="text-blue-400">Yes</span> : <span className="text-gray-400">No</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                      {new Date(lap.submission_date).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;