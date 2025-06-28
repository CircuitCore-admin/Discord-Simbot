function parseAndValidate(rawText) {
  const text = rawText.toLowerCase().replace(/\s+/g, ' ');
  const summary = {
    track: null,
    lapTime: null,
    sectors: [],
    assists: [],
    valid: true,
    notes: [],
  };

  // ✅ Example Rule: Must contain lap time in format like 1:XX.XXX or 0:XX.XXX
  const lapTimeMatch = text.match(/\b[0-9]:[0-5][0-9]\.[0-9]{3}\b/);
  if (lapTimeMatch) {
    summary.lapTime = lapTimeMatch[0];
  } else {
    summary.valid = false;
    summary.notes.push('Missing or unreadable lap time.');
  }

  // ✅ Example Rule: Must have 3 sector times
  const sectorMatches = [...text.matchAll(/\b[0-9]{2}\.[0-9]{3}\b/g)];
  if (sectorMatches.length >= 3) {
    summary.sectors = sectorMatches.slice(0, 3).map(m => m[0]);
  } else {
    summary.valid = false;
    summary.notes.push('Less than 3 sector times detected.');
  }

  // 🛠️ Add more rules based on your examples:
  if (text.includes('invalid lap')) {
    summary.valid = false;
    summary.notes.push('Lap marked as invalid in the screenshot.');
  }

  // etc...

  return summary;
}

module.exports = { parseAndValidate };
