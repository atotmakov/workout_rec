function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== "log") return;

  const watchedColumn = 2;   // Column B
  const timestampColumn = 1; // Column A
  const row = e.range.rowStart;
  const col = e.range.columnStart;

  if (col === watchedColumn) {
    const newValue = e.value;
    const now = new Date();

    // --- NEW FEATURE: Fill empty rows above ---
    // Start from the row immediately above the one you edited
    let currentRow = row - 1;
    
    // Loop upwards until we hit a non-empty cell in Column B or row 1
    while (currentRow >= 1) {
      let cellB = sheet.getRange(currentRow, watchedColumn);
      let cellA = sheet.getRange(currentRow, timestampColumn);
      
      // If Column B is empty, fill it and add the date to Column A
      if (cellB.getValue() === "") {
        cellB.setValue(newValue);
        if (cellA.getValue() === "") {
          cellA.setValue(now);
        }
        currentRow--;
      } else {
        // Stop the loop once we hit a row that already has data
        break; 
      }
    }

    // --- ORIGINAL LOGIC ---
    // 1) Set date in current row (column A) if empty
    const dateCell = sheet.getRange(row, timestampColumn);
    if (dateCell.getValue() === "") {
      dateCell.setValue(now);
    }

    // 2) Update the "rec" sheet cell A1
    const recSheet = e.source.getSheetByName("rec");
    if (recSheet) {
      recSheet.getRange("A1").setValue(newValue);
    }
  }
}


function onSelectionChange(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  
  // 1. Check if we are on the "log" sheet and in Column B (index 2)
  if (sheetName === "log" && range.getColumn() === 2) {
    
    // 2. Get the value from the selected cell
    const value = range.getValue();
    Logger.log(value);  
    // 3. Set the value in "rec" sheet cell A1
    const recSheet = e.source.getSheetByName("rec");
    
    if (recSheet) {
      recSheet.getRange("A1").setValue(value);
    }
  }
}

function test() {
  console.log("test triggered");
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getActiveSheet();
  Logger.log(sheet.getName());
  
  sheet = ss.getSheetByName("rec");
  Logger.log(sheet.getName());
  sheet.getRange("B1").setValue("fsd");

}

/**
 * Processes logs to find unique dates, calculates duration, 
 * and adds new records to the workout table.
 */
function processDailyWorkouts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("log");
  const workoutSheet = ss.getSheetByName("workout");

  // 1. Get Log Data (Assuming "Date" is in the first column of the log table)
  // Adjust the column index if your "Date" column is different
  const logData = logSheet.getDataRange().getValues();
  const logHeader = logData.shift(); // Remove header
  const dateColIndex = logHeader.indexOf("Date");

  if (dateColIndex === -1) {
    throw new Error("Could not find 'Date' column in log sheet.");
  }

  // 2. Group min/max times by unique date
  const dateGroups = {};
  logData.forEach(row => {
    let rawDate = row[dateColIndex];
    if (!(rawDate instanceof Date)) return;

    // Use date string as key (YYYY-MM-DD) to group unique days
    let dateKey = Utilities.formatDate(rawDate, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
    let timeValue = rawDate.getTime();

    if (!dateGroups[dateKey]) {
      dateGroups[dateKey] = { min: timeValue, max: timeValue, originalDate: rawDate };
    } else {
      dateGroups[dateKey].min = Math.min(dateGroups[dateKey].min, timeValue);
      dateGroups[dateKey].max = Math.max(dateGroups[dateKey].max, timeValue);
    }
  });

  // 3. Get existing workout dates to prevent duplicates
  const workoutData = workoutSheet.getDataRange().getValues();
  const workoutHeader = workoutData.shift();
  const workoutDateColIndex = workoutHeader.indexOf("date");
  
  const existingDates = new Set(workoutData.map(row => {
    let d = row[workoutDateColIndex];
    return d instanceof Date ? Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd") : "";
  }));

  // 4. Form tuples and append to "workout" sheet
  for (let dateKey in dateGroups) {
    if (!existingDates.has(dateKey)) {
      let group = dateGroups[dateKey];
      
      // Calculate duration in minutes (max - min)
      let durationMs = group.max - group.min;
      let durationMinutes = Math.round(durationMs / (1000 * 60));

      // Tuple: [date, duration, 0, 0]
      let rowToInsert = [group.originalDate, durationMinutes, 0, 0];
      
      workoutSheet.appendRow(rowToInsert);
    }
  }
}

/**
 * Calculates the balance based on paid workouts vs. actual workouts performed.
 * Updates cell A1 in the "balance" tab.
 */
function updateBalance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- 1. Calculate Positive Income (from "money" sheet) ---
  const moneySheet = ss.getSheetByName("money");
  const moneyData = moneySheet.getDataRange().getValues();
  const moneyHeader = moneyData.shift();
  const paidColIndex = moneyHeader.indexOf("workouts");
  
  let totalPaidWorkouts = 0;
  if (paidColIndex !== -1) {
    moneyData.forEach(row => {
      let val = parseFloat(row[paidColIndex]);
      if (!isNaN(val)) totalPaidWorkouts += val;
    });
  }

  // --- 2. Calculate Negative Income (from "workout" sheet) ---
  const workoutSheet = ss.getSheetByName("workout");
  const workoutData = workoutSheet.getDataRange().getValues();
  const workoutHeader = workoutData.shift();
  const workAloneColIndex = workoutHeader.indexOf("work alone");
  
  let totalPerformedWorkouts = 0;
  workoutData.forEach(row => {
    // Only count if "work alone" is NOT "1"
    // (Assuming row has data; skips completely empty rows)
    if (row.join("").length > 0 && String(row[workAloneColIndex]) !== "1") {
      totalPerformedWorkouts++;
    }
  });

  // --- 3. Update Balance (in "balance" sheet A1) ---
  const balanceSheet = ss.getSheetByName("balance");
  const finalBalance = totalPaidWorkouts - totalPerformedWorkouts;
  
  balanceSheet.getRange("A1").setValue(finalBalance);
}
