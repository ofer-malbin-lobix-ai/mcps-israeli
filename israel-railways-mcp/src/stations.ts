/**
 * Israel Railways station data.
 * Station IDs and names in Hebrew/English from rail.co.il.
 */

export interface Station {
  id: string;
  nameHe: string;
  nameEn: string;
}

export const STATIONS: Station[] = [
  { id: "1220", nameHe: "תחנה מרכזית המפרץ", nameEn: "HaMifrats Central Station" },
  { id: "1240", nameHe: "יקנעם - כפר יהושע", nameEn: "Yokne'am-Kfar Yehoshu'a" },
  { id: "1250", nameHe: "מגדל העמק - כפר ברוך", nameEn: "Migdal Ha'emek-Kfar Barukh" },
  { id: "1260", nameHe: "עפולה ר. איתן", nameEn: "Afula R.Eitan" },
  { id: "1280", nameHe: "בית שאן", nameEn: "Beit She'an" },
  { id: "1300", nameHe: "חוצות המפרץ", nameEn: "Hutsot HaMifrats" },
  { id: "1400", nameHe: "קריית מוצקין", nameEn: "Kiryat Motzkin" },
  { id: "1500", nameHe: "עכו", nameEn: "Ako" },
  { id: "1600", nameHe: "נהריה", nameEn: "Nahariya" },
  { id: "1820", nameHe: "אחיהוד", nameEn: "Ahihud" },
  { id: "1840", nameHe: "כרמיאל", nameEn: "Karmiel" },
  { id: "2100", nameHe: "חיפה מרכז - השמונה", nameEn: "Haifa Center-HaShmona" },
  { id: "2200", nameHe: "חיפה - בת גלים", nameEn: "Haifa-Bat Galim" },
  { id: "2300", nameHe: "חיפה - חוף הכרמל", nameEn: "Haifa-Hof HaKarmel" },
  { id: "2500", nameHe: "עתלית", nameEn: "Atlit" },
  { id: "2800", nameHe: "בנימינה", nameEn: "Binyamina" },
  { id: "2820", nameHe: "קיסריה - פרדס חנה", nameEn: "Caesarea-Pardes Hana" },
  { id: "2940", nameHe: "רעננה מערב", nameEn: "Ra'anana West" },
  { id: "2960", nameHe: "רעננה דרום", nameEn: "Ra'anana South" },
  { id: "300", nameHe: "פאתי מודיעין", nameEn: "Pa'ate Modi'in" },
  { id: "3100", nameHe: "חדרה - מערב", nameEn: "Hadera-West" },
  { id: "3300", nameHe: "נתניה", nameEn: "Netanya" },
  { id: "3310", nameHe: "נתניה - ספיר", nameEn: "Netanya-Sapir" },
  { id: "3400", nameHe: "בית יהושע", nameEn: "Bet Yehoshu'a" },
  { id: "3500", nameHe: "הרצליה", nameEn: "Hertsliya" },
  { id: "3600", nameHe: "תל אביב - אוניברסיטה", nameEn: "Tel Aviv-University" },
  { id: "3700", nameHe: "תל אביב - סבידור מרכז", nameEn: "Tel Aviv-Savidor Center" },
  { id: "400", nameHe: "מודיעין - מרכז", nameEn: "Modi'in-Center" },
  { id: "4100", nameHe: "בני ברק", nameEn: "Bnei Brak" },
  { id: "4170", nameHe: "פתח תקווה - קריית אריה", nameEn: "Petah Tikva-Kiryat Arye" },
  { id: "4250", nameHe: "פתח תקווה - סגולה", nameEn: "Petah Tikva-Segula" },
  { id: "4600", nameHe: "תל אביב - השלום", nameEn: "Tel Aviv-HaShalom" },
  { id: "4640", nameHe: "צומת חולון", nameEn: "Holon Junction" },
  { id: "4660", nameHe: "חולון - וולפסון", nameEn: "Holon-Wolfson" },
  { id: "4680", nameHe: "בת ים - יוספטל", nameEn: "Bat Yam-Yoseftal" },
  { id: "4690", nameHe: "בת ים - קוממיות", nameEn: "Bat Yam-Komemiyut" },
  { id: "4800", nameHe: "כפר חב\"ד", nameEn: "Kfar Habad" },
  { id: "4900", nameHe: "תל אביב - ההגנה", nameEn: "Tel Aviv-HaHagana" },
  { id: "5000", nameHe: "לוד", nameEn: "Lod" },
  { id: "5010", nameHe: "רמלה", nameEn: "Ramla" },
  { id: "5150", nameHe: "לוד - גני אביב", nameEn: "Lod-Gane Aviv" },
  { id: "5200", nameHe: "רחובות", nameEn: "Rehovot" },
  { id: "5300", nameHe: "באר יעקב", nameEn: "Be'er Ya'akov" },
  { id: "5410", nameHe: "יבנה - מזרח", nameEn: "Yavne-East" },
  { id: "5800", nameHe: "אשדוד - עד הלום", nameEn: "Ashdod-Ad Halom" },
  { id: "5900", nameHe: "אשקלון", nameEn: "Ashkelon" },
  { id: "6150", nameHe: "קריית מלאכי - יואב", nameEn: "Kiryat Malakhi-Yoav" },
  { id: "6300", nameHe: "בית שמש", nameEn: "Bet Shemesh" },
  { id: "6500", nameHe: "ירושלים - גן החיות", nameEn: "Jerusalem-Biblical Zoo" },
  { id: "6700", nameHe: "ירושלים - מלחה", nameEn: "Jerusalem-Malha" },
  { id: "680", nameHe: "ירושלים - יצחק נבון", nameEn: "Jerusalem-Yitzhak Navon" },
  { id: "6900", nameHe: "מזכרת בתיה", nameEn: "Mazkeret Batya" },
  { id: "700", nameHe: "קריית חיים", nameEn: "Kiryat Hayim" },
  { id: "7000", nameHe: "קריית גת", nameEn: "Kiryat Gat" },
  { id: "7300", nameHe: "באר שבע - צפון", nameEn: "Be'er Sheva-North" },
  { id: "7320", nameHe: "באר שבע - מרכז", nameEn: "Be'er Sheva-Center" },
  { id: "7500", nameHe: "דימונה", nameEn: "Dimona" },
  { id: "8550", nameHe: "להבים - רהט", nameEn: "Lehavim-Rahat" },
  { id: "8600", nameHe: "נתב\"ג", nameEn: "Ben Gurion Airport" },
  { id: "8700", nameHe: "כפר סבא - נורדאו", nameEn: "Kfar Sava-Nordau" },
  { id: "8800", nameHe: "ראש העין - צפון", nameEn: "Rosh Ha'Ayin-North" },
  { id: "9000", nameHe: "יבנה - מערב", nameEn: "Yavne-West" },
  { id: "9100", nameHe: "ראשון לציון - הראשונים", nameEn: "Rishon LeTsiyon-HaRishonim" },
  { id: "9200", nameHe: "הוד השרון - סוקולוב", nameEn: "Hod HaSharon-Sokolov" },
  { id: "9600", nameHe: "שדרות", nameEn: "Sderot" },
  { id: "9650", nameHe: "נתיבות", nameEn: "Netivot" },
  { id: "9700", nameHe: "אופקים", nameEn: "Ofakim" },
  { id: "9800", nameHe: "ראשון לציון - משה דיין", nameEn: "Rishon LeTsiyon-Moshe Dayan" },
];

const stationsByName = new Map<string, Station>();
for (const s of STATIONS) {
  stationsByName.set(s.nameEn.toLowerCase(), s);
  stationsByName.set(s.nameHe, s);
  // Common shortcuts
  const shortEn = s.nameEn.split("-")[0].split("(")[0].trim().toLowerCase();
  if (!stationsByName.has(shortEn)) {
    stationsByName.set(shortEn, s);
  }
}

export function findStation(query: string): Station | undefined {
  const q = query.trim();

  // Direct ID match
  const byId = STATIONS.find((s) => s.id === q);
  if (byId) return byId;

  // Exact name match
  const byName = stationsByName.get(q.toLowerCase()) ?? stationsByName.get(q);
  if (byName) return byName;

  // Fuzzy: contains match
  const lower = q.toLowerCase();
  return STATIONS.find(
    (s) =>
      s.nameEn.toLowerCase().includes(lower) ||
      s.nameHe.includes(q)
  );
}
