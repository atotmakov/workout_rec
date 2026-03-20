/**
 * Run once to initialize all required sheets with headers, validation, and formulas.
 * Safe to re-run — skips sheets that already exist.
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function getOrCreateSheet(name) {
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  // --- drills: Mscl | Drill ---
  const drills = getOrCreateSheet("drills");
  if (drills.getLastRow() === 0) {
    drills.appendRow(["Mscl", "Drill"]);
  }

  // --- log: Date | Drill | W | R ---
  const log = getOrCreateSheet("log");
  if (log.getLastRow() === 0) {
    log.appendRow(["Date", "Drill", "W", "R"]);
  }
  // Dropdown validation on Drill column (B) from drills!Drill
  const drillValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(drills.getRange("B2:B1000"), true)
    .setAllowInvalid(false)
    .build();
  log.getRange("B2:B1000").setDataValidation(drillValidation);

  // --- rec: A1 dropdown selector, A2 FILTER formula ---
  const rec = getOrCreateSheet("rec");
  const recValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(drills.getRange("B2:B1000"), true)
    .setAllowInvalid(true)
    .build();
  rec.getRange("A1").setDataValidation(recValidation);
  rec.getRange("A2").setFormula('=FILTER(log!A:D, log!B:B=A1)');

  // --- money: table "payments" — Date | Workouts | Sum ---
  const money = getOrCreateSheet("money");
  if (money.getLastRow() === 0) {
    money.appendRow(["Date", "Workouts", "Sum"]);
  }

  // --- workout: table "workouts" — Date | Duration, min | Work alone ---
  const workout = getOrCreateSheet("workout");
  if (workout.getLastRow() === 0) {
    workout.appendRow(["Date", "Duration, min", "Work alone"]);
  }

  // --- balance: result written to A1 by updateBalance() ---
  getOrCreateSheet("balance");

  Logger.log("Spreadsheet initialized.");
}

/**
 * Run once to install time-based triggers.
 * processDailyWorkouts and updateBalance run once a day at midnight.
 * Safe to re-run — removes existing triggers first.
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("processDailyWorkouts")
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  ScriptApp.newTrigger("updateBalance")
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  Logger.log("Triggers installed.");
}
