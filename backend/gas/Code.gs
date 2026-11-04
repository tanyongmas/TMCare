/**
 * ==========================================================================
 * TMCare - Google Apps Script Backend (Code.gs)
 * ระบบติดตามและดูแลผู้พิการและกลุ่มเปราะบาง เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส
 * ==========================================================================
 * 
 * วิธีการติดตั้งและใช้งาน:
 * 1. สร้าง Google Sheets ขึ้นมา 1 ไฟล์ ตั้งชื่อว่า "TMCare_Database_Tanyongmas"
 * 2. ไปที่เมนู "ส่วนขยาย (Extensions)" -> "Apps Script"
 * 3. ลบโค้ดเดิมทั้งหมดในไฟล์ Code.gs แล้ววางโค้ดชุดนี้ลงไปแทน
 * 4. ที่แถบเครื่องมือด้านบน เลือกฟังก์ชัน "setupDatabase" แล้วกดปุ่ม "เรียกใช้ (Run)"
 *    (กด "ตรวจสอบสิทธิ์ (Review Permissions)" -> เลือกบัญชี Google -> กด "ขั้นสูง (Advanced)" -> "ไปที่... (ไม่ปลอดภัย)" -> "อนุญาต (Allow)")
 * 5. กดปุ่ม "ทำให้ใช้งานได้ (Deploy)" (สีน้ำเงินมุมขวาบน) -> เลือก "การทำให้ใช้งานได้รายการใหม่ (New Deployment)"
 * 6. กดที่ไอคอนรูปฟันเฟือง ⚙️ ด้านซ้าย เลือกประเภท "เว็บแอปพลิเคชัน (Web App)"
 *    - คำอธิบาย: TMCare API Production
 *    - ดำเนินการในฐานะ (Execute as): ตัวฉัน (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง (Who has access): ทุกคน (Anyone)  *** สำคัญมาก! ต้องเลือก Anyone ***
 * 7. กดปุ่ม "ทำให้ใช้งานได้ (Deploy)" และคัดลอก "URL ของเว็บแอป (Web App URL)"
 * 8. นำ URL ที่ได้ไปวางในเมนู "ตั้งค่าฐานข้อมูล" ในระบบ TMCare Web App แล้วกด "ทดสอบการเชื่อมต่อ"
 */

// รายชื่อตาราง (Sheet Tabs) ใน Google Sheets
var SHEETS = {
  COMMUNITIES: "communities",
  USERS: "users",
  BENEFICIARIES: "beneficiaries",
  VISIT_LOGS: "visit_logs",
  WELFARE_RECORDS: "welfare_records",
  DISASTER_STATUS: "disaster_status"
};

/**
 * ----------------------------------------------------
 * 1. ฟังก์ชันสร้างตารางและลงข้อมูลตั้งต้น (กดรันครั้งแรก)
 * ----------------------------------------------------
 */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. communities (ตาราง 7 ชุมชน)
  var sCom = getOrCreateSheet(ss, SHEETS.COMMUNITIES);
  var comHeaders = ["id", "name", "default_pin", "lat", "lng", "description"];
  sCom.getRange(1, 1, 1, comHeaders.length).setValues([comHeaders]);
  formatHeaderRow(sCom, comHeaders.length, "#e11d48");

  var comData = [
    ["COM-01", "ชุมชนตลาดกลางผลไม้", "111111", 6.2785, 101.7312, "พื้นที่เศรษฐกิจและตลาดกลางค้าส่งผลไม้ ตันหยงมัส"],
    ["COM-02", "ชุมชนโรงเรียนแหลมทองวิทยา", "222222", 6.2742, 101.7348, "บริเวณใกล้โรงเรียนแหลมทองวิทยา"],
    ["COM-03", "ชุมชนโรงเรียนเจริญศึกษา", "333333", 6.2721, 101.7325, "บริเวณโรงเรียนเจริญศึกษาและชุมชนโดยรอบ"],
    ["COM-04", "ชุมชนวงเวียนลองกอง", "444444", 6.2764, 101.7352, "จุดศูนย์กลางสัญลักษณ์วงเวียนลองกองตันหยงมัส"],
    ["COM-05", "ชุมชนโรงภาพยนต์", "555555", 6.2778, 101.7369, "ย่านชุมชนโรงภาพยนต์เก่าและร้านค้า"],
    ["COM-06", "ชุมชนสุขาภิบาล", "666666", 6.2798, 101.7340, "ชุมชนสุขาภิบาลเดิมใจกลางตันหยงมัส"],
    ["COM-07", "ชุมชนดารุสสลาม", "777777", 6.2705, 101.7380, "ชุมชนดารุสสลามและมัสยิดในพื้นที่"]
  ];
  if (sCom.getLastRow() <= 1) {
    sCom.getRange(2, 1, comData.length, comHeaders.length).setValues(comData);
  }

  // 2. users (บัญชีผู้ใช้งาน)
  var sUsers = getOrCreateSheet(ss, SHEETS.USERS);
  var userHeaders = ["id", "username", "pin", "fullName", "role", "communityId", "phone", "updatedAt"];
  sUsers.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);
  formatHeaderRow(sUsers, userHeaders.length, "#e11d48");

  var userData = [
    ["usr-exec", "executive", "999999", "นายกเทศมนตรีตำบลตันหยงมัส", "executive", "", "081-950xxxx", new Date()],
    ["usr-officer", "officer", "888888", "นักพัฒนาชุมชน / กองสวัสดิการสังคม", "officer", "", "089-870xxxx", new Date()],
    ["usr-com-1", "com01", "111111", "ประธานชุมชนตลาดกลางผลไม้", "committee", "COM-01", "084-312xxxx", new Date()],
    ["usr-com-2", "com02", "222222", "ประธานชุมชนโรงเรียนแหลมทองวิทยา", "committee", "COM-02", "082-223xxxx", new Date()],
    ["usr-com-3", "com03", "333333", "ประธานชุมชนโรงเรียนเจริญศึกษา", "committee", "COM-03", "089-445xxxx", new Date()],
    ["usr-com-4", "com04", "444444", "ประธานชุมชนวงเวียนลองกอง", "committee", "COM-04", "081-556xxxx", new Date()],
    ["usr-com-5", "com05", "555555", "ประธานชุมชนโรงภาพยนต์", "committee", "COM-05", "086-667xxxx", new Date()],
    ["usr-com-6", "com06", "666666", "ประธานชุมชนสุขาภิบาล", "committee", "COM-06", "087-778xxxx", new Date()],
    ["usr-com-7", "com07", "777777", "ประธานชุมชนดารุสสลาม", "committee", "COM-07", "085-889xxxx", new Date()]
  ];
  if (sUsers.getLastRow() <= 1) {
    sUsers.getRange(2, 1, userData.length, userHeaders.length).setValues(userData);
  }

  // 3. beneficiaries (ทะเบียนผู้พิการและกลุ่มเปราะบาง)
  var sBen = getOrCreateSheet(ss, SHEETS.BENEFICIARIES);
  var benHeaders = [
    "id", "communityId", "cidMasked", "prefix", "firstName", "lastName", 
    "birthDate", "age", "phone", "address", "lat", "lng", 
    "vulnerabilityType", "disabilityTypes", "adlScore", "triageLevel", 
    "livingStatus", "caregiverName", "caregiverPhone", "chronicDiseases", 
    "drugAllergies", "medicalDevices", "hospitalRef", "photoUrl", "updatedAt"
  ];
  sBen.getRange(1, 1, 1, benHeaders.length).setValues([benHeaders]);
  formatHeaderRow(sBen, benHeaders.length, "#e11d48");

  // ใส่ข้อมูลเริ่มต้น 10 รายชื่อแรกของ ทต.ตันหยงมัส
  var initialBeneficiaries = [
    ["BEN-001", "COM-01", "1-9602-00045-xx-1", "นาย", "ดอเลาะ", "มามะ", "1948-03-12", 78, "084-555-1234", "45/2 ถ.เทศบาล 1 ชุมชนตลาดกลางผลไม้", 6.2788, 101.7315, "ผู้พิการทางการเคลื่อนไหว และผู้สูงอายุติดเตียง", "การเคลื่อนไหวหรือทางร่างกาย", 4, "red", "active", "นางฟาตีเมาะ มามะ (บุตรสาว)", "084-555-1234", "โรคหลอดเลือดสมอง (Stroke) อัมพาตครึ่งซีก, ความดันโลหิตสูง", "ไม่มี", "เตียงลมป้องกันแผลกดทับ, สายให้อาหารทางจมูก (NG Tube)", "รพ.ระแงะ", "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=300", new Date()],
    ["BEN-002", "COM-01", "3-9602-00123-xx-8", "นาง", "คอลีเยาะ", "ดือเระ", "1960-07-20", 66, "081-332-9874", "12 ชุมชนตลาดกลางผลไม้", 6.2779, 101.7308, "ผู้พิการทางการเห็น", "ทางการเห็น", 12, "yellow", "active", "นายมะ ดือเระ (สามี)", "081-332-9874", "เบาหวาน, ต้อหินสองข้างสูญเสียการมองเห็นเกือบสมบูรณ์", "แพ้ยาเพนิซิลลิน (Penicillin)", "ไม้เท้าขาว", "รพ.ระแงะ", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300", new Date()],
    ["BEN-003", "COM-02", "1-9602-00234-xx-5", "นางสาว", "ซูไรดา", "วาเด็ง", "1995-11-04", 31, "089-991-2345", "78/1 ซอยแหลมทอง 2 ชุมชนโรงเรียนแหลมทองวิทยา", 6.2745, 101.7351, "ผู้พิการทางสติปัญญาและการเรียนรู้", "ทางสติปัญญา", 8, "yellow", "active", "นางรอกียะห์ วาเด็ง (มารดา)", "089-991-2345", "โรคลมชัก (Epilepsy)", "ไม่มี", "ไม่มี", "รพ.ระแงะ", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300", new Date()],
    ["BEN-004", "COM-02", "3-9602-00345-xx-2", "นาย", "อับดุลเลาะ", "เจ๊ะอูมา", "1942-01-15", 84, "086-778-9012", "102 ชุมชนโรงเรียนแหลมทองวิทยา", 6.2738, 101.7342, "ผู้สูงอายุติดเตียงและภาวะสมองเสื่อม", "ความชรา/ติดเตียง", 2, "red", "active", "นายอารีฟีน เจ๊ะอูมา (บุตรชาย)", "086-778-9012", "โรคไตวายเรื้อรัง, โรคหัวใจ, ปอดอุดกั้นเรื้อรัง (COPD)", "แพ้ยาแอสไพริน", "ถังออกซิเจนขนาด 1.5 คิว, ที่นอนลม", "รพ.ระแงะ", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300", new Date()],
    ["BEN-005", "COM-03", "1-9602-00456-xx-9", "เด็กชาย", "มูฮัมหมัด", "สาและ", "2015-05-18", 11, "082-345-6789", "33 ถ.เจริญศึกษา ชุมชนโรงเรียนเจริญศึกษา", 6.2725, 101.7328, "ผู้พิการทางการได้ยินหรือสื่อความหมาย", "ทางการได้ยินหรือสื่อความหมาย", 18, "green", "active", "นางฟาติมา สาและ (มารดา)", "082-345-6789", "ไม่มีโรคประจำตัวรุนแรง", "ไม่มี", "เครื่องช่วยฟังแบบทัดหลังใบหู", "รพ.ระแงะ", "https://images.unsplash.com/photo-1543332164-6e82f355badc?w=300", new Date()],
    ["BEN-006", "COM-04", "3-9602-00567-xx-6", "นาย", "สมเกียรติ", "แซ่ลิ้ม", "1954-09-09", 72, "081-445-5667", "55/1 วงเวียนลองกอง ชุมชนวงเวียนลองกอง", 6.2766, 101.7354, "ผู้พิการทางร่างกาย อัมพฤกษ์ครึ่งซีกขวา", "การเคลื่อนไหวหรือทางร่างกาย", 10, "yellow", "active", "นางเพ็ญศรี แซ่ลิ้ม (ภรรยา)", "081-445-5667", "ความดันโลหิตสูง, ไขมันในเลือดสูง", "ไม่มี", "รถเข็นนั่งวีลแชร์ (Wheelchair)", "รพ.ระแงะ", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300", new Date()],
    ["BEN-007", "COM-05", "3-9602-00678-xx-3", "นาง", "มารียะห์", "ดอเลาะ", "1939-08-25", 87, "084-223-1199", "89 ชุมชนโรงภาพยนต์", 6.2775, 101.7372, "ผู้สูงอายุติดบ้าน ภาวะกระดูกสะโพกหักหลังผ่าตัด", "การเคลื่อนไหว", 7, "yellow", "active", "นางสาวฮามีดะห์ ดอเลาะ (หลานสาว)", "084-223-1199", "โรคกระดูกพรุน, ความดันโลหิตสูง", "แพ้ยากลุ่ม NSAIDs", "วอล์กเกอร์ช่วยเดิน 4 ขา", "รพ.ระแงะ", "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300", new Date()],
    ["BEN-008", "COM-06", "1-9602-00789-xx-0", "นาย", "อับดุลฮาฟิซ", "กะดามุ", "1988-12-10", 38, "089-112-3344", "14/5 ชุมชนสุขาภิบาล", 6.2801, 101.7342, "ผู้พิการทางการเคลื่อนไหว ขาขาดระดับเหนือเข่าข้างซ้าย", "การเคลื่อนไหวหรือทางร่างกาย", 16, "green", "active", "นางแอเสาะ กะดามุ (ภรรยา)", "089-112-3344", "ไม่มี", "ไม่มี", "ขาเทียมระดับเหนือเข่า", "รพ.ระแงะ", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300", new Date()],
    ["BEN-009", "COM-06", "3-9602-00890-xx-7", "นาง", "แมะวอ", "เปาะซา", "1945-04-03", 81, "086-334-5566", "109 ชุมชนสุขาภิบาล", 6.2795, 101.7337, "ผู้ป่วยติดเตียงระยะประคับประคอง และแผลกดทับระดับ 3", "ติดเตียง 100%", 1, "red", "active", "นายอิสมาแอ เปาะซา (บุตร)", "086-334-5566", "มะเร็งตับระยะลุกลาม, ดีซ่าน, เบาหวาน", "ไม่มี", "เครื่องผลิตออกซิเจน 5 ลิตร, เตียงปรับระดับ 3 ไก", "รพ.ระแงะ", "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=300", new Date()],
    ["BEN-010", "COM-07", "1-9602-00901-xx-4", "นาย", "การีม", "เจะดือราแม", "1973-06-30", 53, "087-556-7788", "21 ชุมชนดารุสสลาม", 6.2709, 101.7383, "ผู้พิการทางการเคลื่อนไหว แขนขาอ่อนแรงจากอุบัติเหตุ", "การเคลื่อนไหว", 9, "yellow", "active", "นางรอยฮาน เจะดือราแม (ภรรยา)", "087-556-7788", "ความดันโลหิตสูง", "ไม่มี", "รถเข็นนั่งวีลแชร์แบบพับได้", "รพ.ระแงะ", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300", new Date()]
  ];
  if (sBen.getLastRow() <= 1) {
    sBen.getRange(2, 1, initialBeneficiaries.length, benHeaders.length).setValues(initialBeneficiaries);
  }

  // 4. visit_logs (ประวัติการเยี่ยมบ้าน)
  var sVis = getOrCreateSheet(ss, SHEETS.VISIT_LOGS);
  var visHeaders = ["id", "beneficiaryId", "communityId", "visitorName", "visitDate", "healthStatus", "livingCondition", "notes", "photoUrl", "createdAt"];
  sVis.getRange(1, 1, 1, visHeaders.length).setValues([visHeaders]);
  formatHeaderRow(sVis, visHeaders.length, "#e11d48");

  // 5. welfare_records (ประวัติคำร้องและสวัสดิการ)
  var sWel = getOrCreateSheet(ss, SHEETS.WELFARE_RECORDS);
  var welHeaders = ["id", "beneficiaryId", "communityId", "requestType", "itemDetail", "amount", "status", "requestedBy", "requestDate", "deliveryDate", "notes", "approvedBy"];
  sWel.getRange(1, 1, 1, welHeaders.length).setValues([welHeaders]);
  formatHeaderRow(sWel, welHeaders.length, "#e11d48");

  var initialWelfare = [
    ["WEL-001", "BEN-001", "COM-01", "ผ้าอ้อมผู้ใหญ่", "ผ้าอ้อมผู้ใหญ่สำเร็จรูป Size L (โครงการ สปสช.)", "3 แพ็ค/เดือน", "delivered", "ประธานชุมชนตลาดกลางผลไม้", "2026-10-15", "2026-10-20", "ผู้ป่วยติดเตียงต้องการใช้ประจำต่อเนื่อง", "ผอ.กองสวัสดิการสังคม"],
    ["WEL-002", "BEN-004", "COM-02", "กายอุปกรณ์", "ถังออกซิเจนสำรองขนาด 1.5 คิว", "1 ถัง", "requested", "ประธานชุมชนโรงเรียนแหลมทองวิทยา", "2026-10-28", "", "ผู้ป่วยใช้เครื่องผลิตออกซิเจนไฟฟ้า ต้องมีถังสำรองกรณีไฟดับช่วงน้ำท่วม", ""],
    ["WEL-003", "BEN-006", "COM-04", "กายอุปกรณ์", "เบาะรองนั่งป้องกันแผลกดทับสำหรับรถเข็นวีลแชร์", "1 ชิ้น", "approved", "ประธานชุมชนวงเวียนลองกอง", "2026-10-25", "", "รอรับมอบจากศูนย์บริการคนพิการจังหวัด", "ผอ.กองสวัสดิการสังคม"]
  ];
  if (sWel.getLastRow() <= 1) {
    sWel.getRange(2, 1, initialWelfare.length, welHeaders.length).setValues(initialWelfare);
  }

  // 6. disaster_status (สถานะการอพยพช่วงภัยพิบัติ)
  var sDis = getOrCreateSheet(ss, SHEETS.DISASTER_STATUS);
  var disHeaders = ["beneficiaryId", "communityId", "evacStatus", "needsDetail", "shelterName", "updatedAt"];
  sDis.getRange(1, 1, 1, disHeaders.length).setValues([disHeaders]);
  formatHeaderRow(sDis, disHeaders.length, "#e11d48");

  var initialDisaster = [
    ["BEN-001", "COM-01", "need_help", "ต้องการเรือท้องแบนและทีมกู้ชีพเคลื่อนย้ายผู้ป่วยติดเตียง", "-", new Date()],
    ["BEN-002", "COM-01", "safe_at_home", "ปลอดภัย อยู่บ้านชั้น 2 น้ำยังไม่ท่วมถึง", "-", new Date()],
    ["BEN-003", "COM-02", "safe_at_home", "ปลอดภัย พักอาศัยกับครอบครัว", "-", new Date()],
    ["BEN-004", "COM-02", "need_help", "ต้องการเครื่องปั่นไฟสำรองสำหรับเครื่องผลิตออกซิเจน", "-", new Date()],
    ["BEN-005", "COM-03", "safe_at_home", "ปลอดภัย น้ำยังไม่ท่วม", "-", new Date()],
    ["BEN-006", "COM-04", "evacuated", "อพยพเรียบร้อย มีญาติดูแลใกล้ชิด", "ศูนย์พักพิงชั่วคราว หอประชุมอำเภอระแงะ", new Date()],
    ["BEN-007", "COM-05", "safe_at_home", "ปลอดภัย สภาพแวดล้อมปกติ", "-", new Date()],
    ["BEN-008", "COM-06", "safe_at_home", "ปลอดภัย ช่วยเหลือตนเองได้", "-", new Date()],
    ["BEN-009", "COM-06", "need_help", "ผู้ป่วยวิกฤตติดเตียง น้ำเริ่มเข้าซอย ต้องการรถพยาบาลเคลื่อนย้ายด่วน", "-", new Date()],
    ["BEN-010", "COM-07", "safe_at_home", "ปลอดภัย อยู่ในพื้นที่ดอน", "-", new Date()]
  ];
  if (sDis.getLastRow() <= 1) {
    sDis.getRange(2, 1, initialDisaster.length, disHeaders.length).setValues(initialDisaster);
  }

  Logger.log("✅ สำเร็จ: สร้างฐานข้อมูลและโครงสร้างตารางของ TMCare เทศบาลตำบลตันหยงมัส เรียบร้อยแล้ว!");
}

/**
 * ฟังก์ชันช่วยตกแต่งแถวหัวตาราง (Header)
 */
function formatHeaderRow(sheet, numCols, bgColor) {
  var range = sheet.getRange(1, 1, 1, numCols);
  range.setBackground(bgColor || "#e11d48");
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * ----------------------------------------------------
 * 2. รับ Request แบบ GET (ดึงข้อมูล)
 * ----------------------------------------------------
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
    var communityId = (e && e.parameter && e.parameter.communityId) ? e.parameter.communityId : null;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. ทดสอบการเชื่อมต่อ (Ping / Test Connection)
    if (action === "ping" || action === "testConnection") {
      return jsonResponse({
        status: "success",
        message: "เชื่อมต่อกับ Google Sheets ของ เทศบาลตำบลตันหยงมัส สำเร็จ!",
        databaseName: ss.getName(),
        version: "1.0.0",
        timestamp: new Date()
      });
    }

    // 2. ดึงข้อมูลทั้งหมดของระบบ (หรือกรองตามชุมชน)
    if (action === "getAllData") {
      var beneficiaries = getSheetDataAsJson(ss.getSheetByName(SHEETS.BENEFICIARIES));
      var visitLogs = getSheetDataAsJson(ss.getSheetByName(SHEETS.VISIT_LOGS));
      var welfareRecords = getSheetDataAsJson(ss.getSheetByName(SHEETS.WELFARE_RECORDS));
      var disasterStatuses = getSheetDataAsJson(ss.getSheetByName(SHEETS.DISASTER_STATUS));
      var communities = getSheetDataAsJson(ss.getSheetByName(SHEETS.COMMUNITIES));
      var users = getSheetDataAsJson(ss.getSheetByName(SHEETS.USERS));

      // กรองตามชุมชน (Community Scoping) หากมีการระบุ
      if (communityId) {
        beneficiaries = beneficiaries.filter(function(b) { return b.communityId === communityId; });
        visitLogs = visitLogs.filter(function(v) { return v.communityId === communityId; });
        welfareRecords = welfareRecords.filter(function(w) { return w.communityId === communityId; });
        disasterStatuses = disasterStatuses.filter(function(d) { return d.communityId === communityId; });
      }

      return jsonResponse({
        status: "success",
        beneficiaries: beneficiaries,
        visitLogs: visitLogs,
        welfareRecords: welfareRecords,
        disasterStatuses: disasterStatuses,
        communities: communities,
        users: users
      });
    }

    return jsonResponse({ status: "error", message: "ไม่รู้จักคำสั่ง action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * ----------------------------------------------------
 * 3. รับ Request แบบ POST (บันทึก / อัปเดต / อัปโหลด)
 * ----------------------------------------------------
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: "error", message: "ไม่พบข้อมูลส่งมาใน Request body" });
    }

    var data = JSON.parse(e.postData.contents);
    var action = (e.parameter && e.parameter.action) ? e.parameter.action : (data.action || "");
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. บันทึก/แก้ไขข้อมูลผู้พิการ (Beneficiary)
    if (action === "saveBeneficiary") {
      var sheetBen = ss.getSheetByName(SHEETS.BENEFICIARIES);
      data.updatedAt = new Date();
      upsertRowById(sheetBen, data, "id");
      return jsonResponse({ status: "success", data: data });
    }

    // 2. บันทึกการเยี่ยมบ้าน (Visit Log)
    if (action === "saveVisitLog") {
      var sheetVis = ss.getSheetByName(SHEETS.VISIT_LOGS);
      data.createdAt = new Date();
      upsertRowById(sheetVis, data, "id");
      return jsonResponse({ status: "success", data: data });
    }

    // 3. บันทึก/อัปเดตคำร้องขอสวัสดิการ (Welfare Record)
    if (action === "saveWelfareRecord") {
      var sheetWel = ss.getSheetByName(SHEETS.WELFARE_RECORDS);
      upsertRowById(sheetWel, data, "id");
      return jsonResponse({ status: "success", data: data });
    }

    // 4. อัปเดตสถานะอพยพ/ภัยพิบัติ (Disaster Status)
    if (action === "updateDisasterStatus") {
      var sheetDis = ss.getSheetByName(SHEETS.DISASTER_STATUS);
      data.updatedAt = new Date();
      upsertRowById(sheetDis, data, "beneficiaryId");
      return jsonResponse({ status: "success", data: data });
    }

    // 5. อัปโหลดภาพถ่ายการเยี่ยมบ้านขึ้น Google Drive อัตโนมัติ
    if (action === "uploadImage") {
      var folderName = "TMCare_Photos_Tanyongmas";
      var folders = DriveApp.getFoldersByName(folderName);
      var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

      var contentType = data.base64Data.substring(5, data.base64Data.indexOf(';'));
      var bytes = Utilities.base64Decode(data.base64Data.substr(data.base64Data.indexOf('base64,') + 7));
      var filename = data.filename || ("visit_" + new Date().getTime() + ".jpg");
      var blob = Utilities.newBlob(bytes, contentType, filename);
      var file = folder.createFile(blob);
      
      // ตั้งสิทธิ์เข้าถึงเพื่อให้แสดงผลภาพบนหน้าเว็บได้
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      // URL ที่แสดงผลได้โดยตรงในแท็ก <img src="...">
      var directPhotoUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w800";

      return jsonResponse({
        status: "success",
        fileId: file.getId(),
        fileUrl: directPhotoUrl
      });
    }

    return jsonResponse({ status: "error", message: "ไม่รู้จักคำสั่ง action POST: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * ----------------------------------------------------
 * 4. Helper Functions
 * ----------------------------------------------------
 */

// แปลงชีตเป็น JSON Array ตามหัวคอลัมน์แถวที่ 1
function getSheetDataAsJson(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var result = [];
  for (var i = 0; i < rows.length; i++) {
    var item = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var val = rows[i][j];
      // แปลงวันที่ Date object เป็น ISO string เพื่อง่ายต่อการใช้งาน
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss'Z'");
      }
      item[key] = val;
    }
    result.push(item);
  }
  return result;
}

// แทรกแถวใหม่ หรือ อัปเดตแถวเดิมตาม ID
function upsertRowById(sheet, data, idFieldName) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var idColIdx = headers.indexOf(idFieldName);
  if (idColIdx === -1) throw new Error("ไม่พบคอลัมน์หลัก ID: " + idFieldName);

  var rowIndex = -1;
  if (lastRow > 1) {
    var ids = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] == data[idFieldName]) {
        rowIndex = i + 2; // +2 เพราะเริ่มจากแถว 2 (แถว 1 คือ Header)
        break;
      }
    }
  }

  var rowValues = [];
  for (var j = 0; j < headers.length; j++) {
    var field = headers[j];
    var val = data[field] !== undefined ? data[field] : "";
    if (val instanceof Date) {
      val = Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    }
    rowValues.push(val);
  }

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// ส่งผลลัพธ์แบบ JSON
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
