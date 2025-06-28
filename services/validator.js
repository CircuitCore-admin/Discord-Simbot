function parseAndValidate(rawText) {
  const lines = rawText.toLowerCase().split('\n').map(l => l.trim()).filter(l => l);
  const summary = {
    lapTime: null,
    sectors: [],
    assists: [],
    valid: true,
    notes: [],
  };

  // Look for fastest lap block
  const startIndex = lines.findIndex(line => line.includes('fastest lap'));
  if (startIndex === -1 || startIndex + 2 >= lines.length) {
    summary.valid = false;
    summary.notes.push('Could not find fastest lap block.');
    return summary;
  }

  const topLapLine = lines[startIndex + 2]; // First result row under header
  console.log('\n--- VALIDATOR DEBUG ---');
console.log('Top Raw Line:', topLapLine);
console.log('Flattened:', topLapLine.replace(/\s+/g, ' '));

  const flatLine = topLapLine.replace(/\s+/g, ' ');

  // Extract lap time
  const lapTimeMatch = flatLine.match(/\b[0-9]:[0-5][0-9]\.[0-9]{3}\b/);
  if (lapTimeMatch) {
    summary.lapTime = lapTimeMatch[0];
  } else {
    summary.valid = false;
    summary.notes.push('Missing or unreadable lap time.');
  }

  // Extract 3 sector times
  const sectorMatches = [...flatLine.matchAll(/\b[0-9]{2}\.[0-9]{3}\b/g)];
  if (sectorMatches.length >= 3) {
    summary.sectors = sectorMatches.slice(0, 3).map(m => m[0]);
  } else {
    summary.valid = false;
    summary.notes.push('Less than 3 sector times detected.');
  }

  // Check for penalty (basic: presence of icon-like symbol)
  if (flatLine.includes('pen') || flatLine.includes('pen.') || flatLine.includes('[e') || flatLine.includes('penalty')) {
    const penaltyIconNearby = flatLine.match(/pen[.\s]+[^ ]{1,2}/); // basic "not empty" check after 'pen'
    if (penaltyIconNearby) {
      summary.valid = false;
      summary.notes.push('Penalty detected on lap.');
    }
  }

  return summary;
}

module.exports = { parseAndValidate };
