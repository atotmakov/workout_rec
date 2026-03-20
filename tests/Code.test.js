const { onEdit, onSelectionChange, processDailyWorkouts, updateBalance } = require('../Code');
const { createMockSheet, createMockSpreadsheet } = require('./helpers');

// ─── onEdit ──────────────────────────────────────────────────────────────────

describe('onEdit', () => {
  function makeEvent({ sheetName = 'log', col = 2, row = 3, value = 'Squat', recSheet = null } = {}) {
    const sheet = createMockSheet(sheetName);
    const ss = {
      getActiveSheet: jest.fn(() => sheet),
      getSheetByName: jest.fn(() => recSheet),
    };
    return {
      source: ss,
      range: { rowStart: row, columnStart: col },
      value,
      _sheet: sheet,
      _ss: ss,
    };
  }

  it('does nothing if sheet is not "log"', () => {
    const e = makeEvent({ sheetName: 'workout' });
    onEdit(e);
    expect(e._sheet.getRange).not.toHaveBeenCalled();
  });

  it('does nothing if edited column is not B (2)', () => {
    const e = makeEvent({ col: 3 });
    onEdit(e);
    expect(e._sheet.getRange).not.toHaveBeenCalled();
  });

  it('sets timestamp in col A when it is empty', () => {
    const rec = createMockSheet('rec');
    const e = makeEvent({ row: 3, recSheet: rec });
    const dateCell = e._sheet.getRange(3, 1);
    dateCell._value = '';

    onEdit(e);

    expect(dateCell.setValue).toHaveBeenCalledWith(expect.any(Date));
  });

  it('does not overwrite existing timestamp in col A', () => {
    const existingDate = new Date('2024-01-01');
    const rec = createMockSheet('rec');
    const e = makeEvent({ row: 3, recSheet: rec });
    const dateCell = e._sheet.getRange(3, 1);
    dateCell._value = existingDate;

    onEdit(e);

    expect(dateCell.setValue).not.toHaveBeenCalled();
  });

  it('updates rec!A1 with the new drill value', () => {
    const rec = createMockSheet('rec');
    const e = makeEvent({ value: 'Deadlift', recSheet: rec });

    onEdit(e);

    const recA1 = rec.getRange('A1');
    expect(recA1.setValue).toHaveBeenCalledWith('Deadlift');
  });

  it('backfills empty rows above with the same drill and timestamp', () => {
    const rec = createMockSheet('rec');
    const e = makeEvent({ row: 5, value: 'Bench', recSheet: rec });
    const sheet = e._sheet;

    // Rows 3 and 4 are empty in col B, row 2 has data (stops backfill)
    sheet.getRange(4, 2)._value = '';
    sheet.getRange(3, 2)._value = '';
    sheet.getRange(2, 2)._value = 'OtherDrill';

    onEdit(e);

    expect(sheet.getRange(4, 2).setValue).toHaveBeenCalledWith('Bench');
    expect(sheet.getRange(3, 2).setValue).toHaveBeenCalledWith('Bench');
    expect(sheet.getRange(2, 2).setValue).not.toHaveBeenCalled();
  });
});

// ─── onSelectionChange ────────────────────────────────────────────────────────

describe('onSelectionChange', () => {
  function makeEvent({ sheetName = 'log', col = 2, value = 'Squat', recSheet = null } = {}) {
    const sheet = createMockSheet(sheetName);
    const range = {
      getSheet: jest.fn(() => sheet),
      getColumn: jest.fn(() => col),
      getValue: jest.fn(() => value),
    };
    const ss = { getSheetByName: jest.fn(() => recSheet) };
    return { source: ss, range };
  }

  it('does nothing if sheet is not "log"', () => {
    const rec = createMockSheet('rec');
    const e = makeEvent({ sheetName: 'workout', recSheet: rec });
    onSelectionChange(e);
    expect(e.source.getSheetByName).not.toHaveBeenCalled();
  });

  it('does nothing if column is not B (2)', () => {
    const rec = createMockSheet('rec');
    const e = makeEvent({ col: 3, recSheet: rec });
    onSelectionChange(e);
    expect(e.source.getSheetByName).not.toHaveBeenCalled();
  });

  it('updates rec!A1 with the selected cell value', () => {
    const rec = createMockSheet('rec');
    const e = makeEvent({ value: 'Pull-up', recSheet: rec });

    onSelectionChange(e);

    expect(rec.getRange('A1').setValue).toHaveBeenCalledWith('Pull-up');
  });
});

// ─── processDailyWorkouts ────────────────────────────────────────────────────

describe('processDailyWorkouts', () => {
  function makeSpreadsheet({ logRows = [], workoutRows = [] } = {}) {
    const ss = createMockSpreadsheet({
      log: { rows: [['Date', 'Drill', 'W', 'R'], ...logRows] },
      workout: { rows: [['Date', 'Duration, min', 'Work alone'], ...workoutRows] },
    });
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(ss);
    return ss;
  }

  it('throws if Date column is missing in log sheet', () => {
    const ss = createMockSpreadsheet({
      log: { rows: [['WrongHeader', 'Drill']] },
      workout: { rows: [['Date', 'Duration, min', 'Work alone']] },
    });
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(ss);
    expect(() => processDailyWorkouts()).toThrow("Could not find 'Date' column");
  });

  it('appends a new workout row for each unique date', () => {
    const date = new Date('2024-03-01T10:00:00');
    const ss = makeSpreadsheet({ logRows: [[date, 'Squat', 100, 5]] });

    processDailyWorkouts();

    expect(ss._sheets.workout.appendRow).toHaveBeenCalledTimes(1);
    expect(ss._sheets.workout.appendRow).toHaveBeenCalledWith([date, 0, false]);
  });

  it('calculates duration as minutes between first and last entry of the day', () => {
    const t1 = new Date('2024-03-01T10:00:00');
    const t2 = new Date('2024-03-01T11:30:00');
    const ss = makeSpreadsheet({
      logRows: [[t1, 'Squat', 100, 5], [t2, 'Bench', 80, 8]],
    });

    processDailyWorkouts();

    expect(ss._sheets.workout.appendRow).toHaveBeenCalledWith([t1, 90, false]);
  });

  it('skips rows where Date is not a Date object', () => {
    const ss = makeSpreadsheet({ logRows: [['not a date', 'Squat', 100, 5]] });

    processDailyWorkouts();

    expect(ss._sheets.workout.appendRow).not.toHaveBeenCalled();
  });

  it('does not add duplicate dates that already exist in workout sheet', () => {
    const date = new Date('2024-03-01T10:00:00');
    const ss = makeSpreadsheet({
      logRows: [[date, 'Squat', 100, 5]],
      workoutRows: [[date, 60, false]],
    });

    processDailyWorkouts();

    expect(ss._sheets.workout.appendRow).not.toHaveBeenCalled();
  });

  it('handles multiple days separately', () => {
    const d1 = new Date('2024-03-01T10:00:00');
    const d2 = new Date('2024-03-02T10:00:00');
    const ss = makeSpreadsheet({ logRows: [[d1, 'Squat', 100, 5], [d2, 'Bench', 80, 8]] });

    processDailyWorkouts();

    expect(ss._sheets.workout.appendRow).toHaveBeenCalledTimes(2);
  });
});

// ─── updateBalance ────────────────────────────────────────────────────────────

describe('updateBalance', () => {
  function makeSpreadsheet({ moneyRows = [], workoutRows = [] } = {}) {
    const ss = createMockSpreadsheet({
      money: { rows: [['Date', 'Workouts', 'Sum'], ...moneyRows] },
      workout: { rows: [['Date', 'Duration, min', 'Work alone'], ...workoutRows] },
      balance: { rows: [] },
    });
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(ss);
    return ss;
  }

  it('writes 0 balance when no payments and no workouts', () => {
    const ss = makeSpreadsheet();
    updateBalance();
    expect(ss._sheets.balance.getRange('A1').setValue).toHaveBeenCalledWith(0);
  });

  it('sums paid workouts from money sheet', () => {
    const date = new Date();
    const ss = makeSpreadsheet({
      moneyRows: [[date, 10, 500], [date, 5, 250]],
    });

    updateBalance();

    expect(ss._sheets.balance.getRange('A1').setValue).toHaveBeenCalledWith(15);
  });

  it('subtracts performed workouts from balance', () => {
    const date = new Date();
    const ss = makeSpreadsheet({
      moneyRows: [[date, 10, 500]],
      workoutRows: [[date, 60, false], [date, 45, false]],
    });

    updateBalance();

    expect(ss._sheets.balance.getRange('A1').setValue).toHaveBeenCalledWith(8);
  });

  it('does not count "Work alone" workouts against balance', () => {
    const date = new Date();
    const ss = makeSpreadsheet({
      moneyRows: [[date, 10, 500]],
      workoutRows: [[date, 60, false], [date, 45, true]],
    });

    updateBalance();

    expect(ss._sheets.balance.getRange('A1').setValue).toHaveBeenCalledWith(9);
  });
});
