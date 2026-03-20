const { initializeSpreadsheet, setupTriggers } = require('../initial_setup');
const { createMockSpreadsheet } = require('./helpers');

// ─── initializeSpreadsheet ────────────────────────────────────────────────────

describe('initializeSpreadsheet', () => {
  beforeEach(() => {
    const ss = createMockSpreadsheet();
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(ss);
  });

  it('creates all required sheets when none exist', () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initializeSpreadsheet();
    expect(ss.insertSheet).toHaveBeenCalledWith('drills');
    expect(ss.insertSheet).toHaveBeenCalledWith('log');
    expect(ss.insertSheet).toHaveBeenCalledWith('rec');
    expect(ss.insertSheet).toHaveBeenCalledWith('money');
    expect(ss.insertSheet).toHaveBeenCalledWith('workout');
    expect(ss.insertSheet).toHaveBeenCalledWith('balance');
  });

  it('does not insert sheets that already exist', () => {
    const ss = createMockSpreadsheet({
      drills: { rows: [['Mscl', 'Drill']], lastRow: 1 },
      log: { rows: [['Date', 'Drill', 'W', 'R']], lastRow: 1 },
      rec: {},
      money: { rows: [['Date', 'Workouts', 'Sum']], lastRow: 1 },
      workout: { rows: [['Date', 'Duration, min', 'Work alone']], lastRow: 1 },
      balance: {},
    });
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(ss);

    initializeSpreadsheet();

    expect(ss.insertSheet).not.toHaveBeenCalled();
  });

  it('adds headers to drills sheet when empty', () => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initializeSpreadsheet();
    const drills = ss._sheets['drills'] || ss.insertSheet.mock.results.find(r => r.value.getName() === 'drills' || true)?.value;
    // Find the drills sheet that was created
    const created = ss.insertSheet.mock.results.map(r => r.value).find(s => s.getName() === 'drills');
    expect(created.appendRow).toHaveBeenCalledWith(['Mscl', 'Drill']);
  });

  it('adds headers to log sheet when empty', () => {
    initializeSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const created = ss.insertSheet.mock.results.map(r => r.value).find(s => s.getName() === 'log');
    expect(created.appendRow).toHaveBeenCalledWith(['Date', 'Drill', 'W', 'R']);
  });

  it('adds headers to money sheet when empty', () => {
    initializeSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const created = ss.insertSheet.mock.results.map(r => r.value).find(s => s.getName() === 'money');
    expect(created.appendRow).toHaveBeenCalledWith(['Date', 'Workouts', 'Sum']);
  });

  it('adds headers to workout sheet when empty', () => {
    initializeSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const created = ss.insertSheet.mock.results.map(r => r.value).find(s => s.getName() === 'workout');
    expect(created.appendRow).toHaveBeenCalledWith(['Date', 'Duration, min', 'Work alone']);
  });

  it('sets data validation on log col B', () => {
    initializeSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const log = ss.insertSheet.mock.results.map(r => r.value).find(s => s.getName() === 'log');
    expect(log.getRange('B2:B1000').setDataValidation).toHaveBeenCalled();
  });

  it('sets dropdown validation on rec!A1', () => {
    initializeSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rec = ss.insertSheet.mock.results.map(r => r.value).find(s => s.getName() === 'rec');
    expect(rec.getRange('A1').setDataValidation).toHaveBeenCalled();
  });

  it('sets FILTER formula on rec!A2', () => {
    initializeSpreadsheet();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rec = ss.insertSheet.mock.results.map(r => r.value).find(s => s.getName() === 'rec');
    expect(rec.getRange('A2').setFormula).toHaveBeenCalledWith(
      expect.stringContaining('FILTER')
    );
  });
});

// ─── setupTriggers ────────────────────────────────────────────────────────────

describe('setupTriggers', () => {
  it('deletes all existing triggers', () => {
    const existing = [{ _id: 't1' }, { _id: 't2' }];
    ScriptApp.getProjectTriggers.mockReturnValue(existing);

    setupTriggers();

    expect(ScriptApp.deleteTrigger).toHaveBeenCalledTimes(2);
    expect(ScriptApp.deleteTrigger).toHaveBeenCalledWith(existing[0]);
    expect(ScriptApp.deleteTrigger).toHaveBeenCalledWith(existing[1]);
  });

  it('creates a daily trigger for processDailyWorkouts', () => {
    setupTriggers();
    expect(ScriptApp.newTrigger).toHaveBeenCalledWith('processDailyWorkouts');
  });

  it('creates a daily trigger for updateBalance', () => {
    setupTriggers();
    expect(ScriptApp.newTrigger).toHaveBeenCalledWith('updateBalance');
  });

  it('configures triggers to run daily at hour 0', () => {
    const builder = {
      timeBased: jest.fn().mockReturnThis(),
      everyDays: jest.fn().mockReturnThis(),
      atHour: jest.fn().mockReturnThis(),
      create: jest.fn(),
    };
    ScriptApp.newTrigger.mockReturnValue(builder);

    setupTriggers();

    expect(builder.everyDays).toHaveBeenCalledWith(1);
    expect(builder.atHour).toHaveBeenCalledWith(0);
    expect(builder.create).toHaveBeenCalledTimes(2);
  });
});
