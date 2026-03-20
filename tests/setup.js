global.Logger = { log: jest.fn() };

global.Utilities = {
  formatDate: jest.fn((date, tz, format) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }),
};

global.SpreadsheetApp = {
  newDataValidation: jest.fn(() => {
    const builder = {
      requireValueInRange: jest.fn(() => builder),
      setAllowInvalid: jest.fn(() => builder),
      build: jest.fn(() => ({})),
    };
    return builder;
  }),
  getActiveSpreadsheet: jest.fn(),
};

global.ScriptApp = {
  getProjectTriggers: jest.fn(() => [{ _id: 'existing' }]),
  deleteTrigger: jest.fn(),
  newTrigger: jest.fn(() => {
    const builder = {
      timeBased: jest.fn(() => builder),
      everyDays: jest.fn(() => builder),
      atHour: jest.fn(() => builder),
      create: jest.fn(),
    };
    return builder;
  }),
};
