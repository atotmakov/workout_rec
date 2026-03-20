function createMockRange({ value = '' } = {}) {
  const r = {
    _value: value,
    getValue: jest.fn(() => r._value),
    setValue: jest.fn(v => { r._value = v; }),
    setFormula: jest.fn(),
    setDataValidation: jest.fn(),
  };
  return r;
}

function createMockSheet(name, { rows = [], lastRow = null } = {}) {
  const rangeMap = {};
  const s = {
    _rows: rows,
    getName: jest.fn(() => name),
    getLastRow: jest.fn(() => (lastRow !== null ? lastRow : rows.length)),
    appendRow: jest.fn(row => s._rows.push(row)),
    getDataRange: jest.fn(() => ({
      getValues: jest.fn(() => s._rows.map(r => [...r])),
    })),
    getRange: jest.fn((rowOrStr, col) => {
      const key = col !== undefined ? `${rowOrStr}:${col}` : `${rowOrStr}`;
      if (!rangeMap[key]) rangeMap[key] = createMockRange();
      return rangeMap[key];
    }),
    getColumn: jest.fn(),
    _getRange: key => rangeMap[key],
  };
  return s;
}

function createMockSpreadsheet(sheets = {}) {
  const sheetMap = {};
  for (const [name, config] of Object.entries(sheets)) {
    sheetMap[name] = createMockSheet(name, config);
  }
  const ss = {
    getSheetByName: jest.fn(name => sheetMap[name] || null),
    getActiveSheet: jest.fn(() => null),
    insertSheet: jest.fn(name => {
      sheetMap[name] = createMockSheet(name, { lastRow: 0 });
      return sheetMap[name];
    }),
    getSpreadsheetTimeZone: jest.fn(() => 'America/New_York'),
    _sheets: sheetMap,
  };
  return ss;
}

module.exports = { createMockRange, createMockSheet, createMockSpreadsheet };
