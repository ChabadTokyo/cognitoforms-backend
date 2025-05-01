import express from "express";
import cors from "cors";
import { google } from "googleapis";
import fs from "fs";

const app = express();
app.use(cors()); // Allow frontend requests
const PORT = process.env.PORT || 3000;

const credentials = JSON.parse(fs.readFileSync("./credentials.json"));
const SHEET_ID = "YOUR_SHEET_ID_HERE";
const SHEET_RANGE = "Sheet1!A2:R"; // adjust if your sheet/tab is named differently

async function getAttendanceByDate(targetDate) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return null;

  let summary = {
    date: targetDate,
    totalNight: 0,
    totalMorning: 0,
    totalCantPay: 0,
    totalAll: 0,
  };

  for (const row of rows) {
    const signupDate = new Date(row[5]).toISOString().split("T")[0]; // Column F (index 5)
    if (signupDate !== targetDate) continue;

    const safeNum = (val) => parseInt(val || "0", 10);

    const night = safeNum(row[7]) + safeNum(row[9]);     // H (7), J (9)
    const morning = safeNum(row[11]) + safeNum(row[13]); // L (11), N (13)
    const cantPay = safeNum(row[16]) + safeNum(row[17]); // Q (16), R (17)

    summary.totalNight += night;
    summary.totalMorning += morning;
    summary.totalCantPay += cantPay;
    summary.totalAll += night + morning + cantPay;
  }

  return summary;
}

app.get("/attendance", async (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: "Missing 'date' query param (YYYY-MM-DD)" });
  }

  try {
    const summary = await getAttendanceByDate(date);
    if (!summary) return res.status(404).json({ error: "No data found." });
    res.json(summary);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`✔️ Attendance API running at http://localhost:${PORT}`);
});

