import express from "express";
import cors from "cors";
import { google } from "googleapis";

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

const credentials = JSON.parse(process.env.CREDENTIALS_JSON);
const SHEET_ID = process.env.SHEET_ID;
const SHEET_RANGE = "main!A2:R"; // Adjust if your sheet/tab is different

// Format JS Date to "M/D/YYYY" (e.g., "3/17/2023")
function formatToMDY(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

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
    adultsNight: 0,
    childrenNight: 0,
    totalNight: 0,
    adultsDay: 0,
    childrenDay: 0,
    totalDay: 0,
    totalCantPay: 0,
    totalAll: 0,
  };

  for (const row of rows) {
    const rowDate = row[5]; // Column F
    const inputDate = formatToMDY(targetDate);
    if (rowDate !== inputDate) continue;

    const eventType = (row[6] || "").trim(); // Column G
    const safeNum = (val) => parseInt(val || "0", 10);

    let adults = 0;
    let children = 0;

    if (eventType === "Friday Night") {
      adults = safeNum(row[7]);    // Column H
      children = safeNum(row[9]);  // Column J
      summary.adultsNight += adults;
      summary.childrenNight += children;
      summary.totalNight += adults + children;
    } else if (eventType === "Shabbat Day") {
      adults = safeNum(row[7]);    // Column H
      children = safeNum(row[9]);  // Column J
      summary.adultsDay += adults;
      summary.childrenDay += children;
      summary.totalDay += adults + children;
    } else if (eventType === "Both") {
      adults = safeNum(row[11]);   // Column L
      children = safeNum(row[13]); // Column N
      summary.adultsNight += adults;
      summary.adultsDay += adults;
      summary.childrenNight += children;
      summary.childrenDay += children;
      summary.totalNight += adults + children;
      summary.totalDay += adults + children;
    }

    const cantPay = safeNum(row[16]) + safeNum(row[17]); // Q + R
    summary.totalCantPay += cantPay;
    summary.totalAll += adults + children + cantPay;
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

