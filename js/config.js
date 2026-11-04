/**
 * TMCare Configuration
 * เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส
 */

const TMCARE_CONFIG = {
  APP_NAME: "TMCare - ระบบติดตามและดูแลผู้พิการและกลุ่มเปราะบาง",
  MUNICIPALITY: "เทศบาลตำบลตันหยงมัส",
  PROVINCE: "อำเภอระแงะ จังหวัดนราธิวาส",
  VERSION: "1.0.0",

  // Data Mode: 'GAS' | 'MOCK' | 'SUPABASE'
  // ค่าเริ่มต้นเป็น 'GAS' เชื่อมต่อ Google Sheets ผ่าน Google Apps Script
  DATA_PROVIDER: localStorage.getItem('tmcare_provider') || 'GAS',
  
  // URL สำหรับ Google Apps Script Web App (เมื่อ Deploy แล้ว)
  GAS_API_URL: localStorage.getItem('tmcare_gas_url') || '',

  // Supabase Config (สำหรับอนาคต)
  SUPABASE_URL: localStorage.getItem('tmcare_supabase_url') || '',
  SUPABASE_ANON_KEY: localStorage.getItem('tmcare_supabase_key') || '',

  // พิกัดศูนย์กลางเทศบาลตำบลตันหยงมัส (ใกล้สถานีรถไฟตันหยงมัส / สำนักงานเทศบาล)
  MAP_CENTER: {
    lat: 6.2758,
    lng: 101.7335,
    zoom: 15
  },

  // 7 ชุมชนในเขตเทศบาลตำบลตันหยงมัส
  COMMUNITIES: [
    {
      id: "COM-01",
      name: "ชุมชนตลาดกลางผลไม้",
      defaultPin: "111111",
      lat: 6.2785,
      lng: 101.7312,
      description: "พื้นที่เศรษฐกิจและตลาดกลางค้าส่งผลไม้ ตันหยงมัส"
    },
    {
      id: "COM-02",
      name: "ชุมชนโรงเรียนแหลมทองวิทยา",
      defaultPin: "222222",
      lat: 6.2742,
      lng: 101.7348,
      description: "บริเวณใกล้โรงเรียนแหลมทองวิทยา"
    },
    {
      id: "COM-03",
      name: "ชุมชนโรงเรียนเจริญศึกษา",
      defaultPin: "333333",
      lat: 6.2721,
      lng: 101.7325,
      description: "บริเวณโรงเรียนเจริญศึกษาและชุมชนโดยรอบ"
    },
    {
      id: "COM-04",
      name: "ชุมชนวงเวียนลองกอง",
      defaultPin: "444444",
      lat: 6.2764,
      lng: 101.7352,
      description: "จุดศูนย์กลางสัญลักษณ์วงเวียนลองกองตันหยงมัส"
    },
    {
      id: "COM-05",
      name: "ชุมชนโรงภาพยนต์",
      defaultPin: "555555",
      lat: 6.2778,
      lng: 101.7369,
      description: "ย่านชุมชนโรงภาพยนต์เก่าและร้านค้า"
    },
    {
      id: "COM-06",
      name: "ชุมชนสุขาภิบาล",
      defaultPin: "666666",
      lat: 6.2798,
      lng: 101.7340,
      description: "ชุมชนสุขาภิบาลเดิมใจกลางตันหยงมัส"
    },
    {
      id: "COM-07",
      name: "ชุมชนดารุสสลาม",
      defaultPin: "777777",
      lat: 6.2705,
      lng: 101.7380,
      description: "ชุมชนดารุสสลามและมัสยิดในพื้นที่"
    }
  ],

  // เบอร์ติดต่อฉุกเฉินในพื้นที่
  EMERGENCY_CONTACTS: [
    { title: "สายด่วนการแพทย์ฉุกเฉิน", number: "1669", desc: "ศูนย์นเรนทร ทั่วประเทศ" },
    { title: "กู้ชีพ-กู้ภัย เทศบาลตำบลตันหยงมัส", number: "073-671355", desc: "งานป้องกันและบรรเทาสาธารณภัย ทต.ตันหยงมัส" },
    { title: "โรงพยาบาลระแงะ (รพ.ตันหยงมัส)", number: "073-671046", desc: "แผนกอุบัติเหตุ-ฉุกเฉิน" },
    { title: "สภ.ระแงะ", number: "073-671191", desc: "สถานีตำรวจภูธรระแงะ" }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TMCARE_CONFIG;
}

