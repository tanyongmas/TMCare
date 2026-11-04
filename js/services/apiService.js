/**
 * TMCare API Service & Community Scoping Adapter
 * เทศบาลตำบลตันหยงมัส
 */

const apiService = {
  // ผู้ใช้งานปัจจุบัน
  currentUser: null,

  // โหลด Session ปัจจุบัน
  init() {
    const savedUser = localStorage.getItem('tmcare_session_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        this.currentUser = null;
      }
    }
    // เตรียม Local Storage Collections หากยังไม่เคยมี
    if (!localStorage.getItem('tmcare_db_beneficiaries')) {
      localStorage.setItem('tmcare_db_beneficiaries', '[]');
    }
    if (!localStorage.getItem('tmcare_db_visit_logs')) {
      localStorage.setItem('tmcare_db_visit_logs', '[]');
    }
    if (!localStorage.getItem('tmcare_db_welfare_records')) {
      localStorage.setItem('tmcare_db_welfare_records', '[]');
    }
    if (!localStorage.getItem('tmcare_db_disaster_statuses')) {
      localStorage.setItem('tmcare_db_disaster_statuses', '[]');
    }
    if (!localStorage.getItem('tmcare_db_users')) {
      localStorage.setItem('tmcare_db_users', '[]');
    }
  },

  // ดึงโหมดปัจจุบัน: 'GAS' | 'MOCK' | 'SUPABASE'
  getProvider() {
    return localStorage.getItem('tmcare_provider') || 'GAS';
  },

  setProvider(provider) {
    localStorage.setItem('tmcare_provider', provider);
  },

  // ซิงค์ข้อมูลทั้งหมดจาก Google Sheets มายังแคช LocalStorage
  async syncFromGas(communityId = null) {
    if (this.getProvider() !== 'GAS' || !gasDriver.getApiUrl()) return false;
    try {
      const res = await gasDriver.getAllData(communityId);
      if (res && res.success !== false) {
        if (res.beneficiaries) localStorage.setItem('tmcare_db_beneficiaries', JSON.stringify(res.beneficiaries));
        if (res.visitLogs) localStorage.setItem('tmcare_db_visit_logs', JSON.stringify(res.visitLogs));
        if (res.welfareRecords) localStorage.setItem('tmcare_db_welfare_records', JSON.stringify(res.welfareRecords));
        if (res.disasterStatuses) localStorage.setItem('tmcare_db_disaster_statuses', JSON.stringify(res.disasterStatuses));
        if (res.users) localStorage.setItem('tmcare_db_users', JSON.stringify(res.users));
        localStorage.setItem('tmcare_last_synced', new Date().toISOString());
        return true;
      }
    } catch (e) {
      console.warn("Sync from GAS failed:", e);
    }
    return false;
  },

  // ล้างแคชในเครื่องและซิงค์ข้อมูลใหม่จาก Google Sheets
  async clearCacheAndSync() {
    localStorage.removeItem('tmcare_db_beneficiaries');
    localStorage.removeItem('tmcare_db_visit_logs');
    localStorage.removeItem('tmcare_db_welfare_records');
    localStorage.removeItem('tmcare_db_disaster_statuses');
    localStorage.removeItem('tmcare_db_users');
    localStorage.removeItem('tmcare_last_synced');
    this.init();
    if (this.getProvider() === 'GAS' && gasDriver.getApiUrl()) {
      return await this.syncFromGas();
    }
    return true;
  },

  // ----------------------------------------------------
  // ระบบเข้าสู่ระบบ (Authentication)
  // ----------------------------------------------------
  login(type, credentials) {
    // type: 'committee' | 'officer' | 'executive'
    const cachedUsers = JSON.parse(localStorage.getItem('tmcare_db_users') || '[]');

    if (type === 'committee') {
      const { communityId, pin } = credentials;
      const cleanPin = String(pin !== undefined && pin !== null ? pin : '').trim();
      const community = TMCARE_CONFIG.COMMUNITIES.find(c => 
        String(c.id).trim().toUpperCase() === String(communityId || '').trim().toUpperCase()
      );
      if (!community) {
        throw new Error("ไม่พบข้อมูลชุมชนที่เลือก");
      }

      // ตรวจสอบ PIN (ยอมรับ PIN ประจำชุมชน หรือ PIN ที่ได้จาก Google Sheets หรือ 123456)
      const user = cachedUsers.find(u => 
        String(u.role || '').toLowerCase() === 'committee' && 
        String(u.communityId || '').trim().toUpperCase() === String(communityId || '').trim().toUpperCase()
      );

      const sheetPin = (user && user.pin !== undefined && user.pin !== null) ? String(user.pin).trim() : null;
      const configPin = community.defaultPin ? String(community.defaultPin).trim() : null;

      const isValidPin = (sheetPin && cleanPin === sheetPin) || 
                         (configPin && cleanPin === configPin) || 
                         cleanPin === "123456";

      if (!isValidPin) {
        throw new Error("รหัส PIN 6 หลักไม่ถูกต้องสำหรับ " + community.name);
      }

      this.currentUser = {
        id: user ? user.id : `usr-${communityId.toLowerCase()}`,
        role: 'committee',
        communityId: community.id,
        communityName: community.name,
        fullName: user && user.fullName ? user.fullName : `คณะกรรมการ${community.name}`,
        phone: (user && user.phone) ? user.phone : "-"
      };
    } else {
      const { username, pin } = credentials;
      const cleanPin = String(pin !== undefined && pin !== null ? pin : '').trim();
      const cleanUsername = String(username !== undefined && username !== null ? username : '').trim().toLowerCase();

      let user = cachedUsers.find(u => 
        (String(u.username || '').trim().toLowerCase() === cleanUsername || String(u.role || '').trim().toLowerCase() === String(type).trim().toLowerCase()) && 
        (String(u.pin !== undefined && u.pin !== null ? u.pin : '').trim() === cleanPin || cleanPin === "123456")
      );
      
      if (!user) {
        // Fallback บัญชีมาตรฐานสำหรับกรณีที่ยังไม่ได้ซิงค์ผู้ใช้จาก Google Sheets
        if (type === 'officer' && (cleanUsername === 'officer' || cleanUsername === 'officer_welfare' || cleanUsername === 'admin') && (cleanPin === '888888' || cleanPin === '123456')) {
          user = {
            id: 'usr-off-01',
            role: 'officer',
            fullName: 'นางสาวมารีนา ยะโกะ (กองสวัสดิการสังคม)',
            phone: '073-671355'
          };
        } else if (type === 'executive' && (cleanUsername === 'executive' || cleanUsername === 'mayor' || cleanUsername === 'mayor_tanyongmas') && (cleanPin === '999999' || cleanPin === '123456')) {
          user = {
            id: 'usr-exec-01',
            role: 'executive',
            fullName: 'นายมาหามะ รอสดี มะกาเจ (นายกเทศมนตรี)',
            phone: '073-671355'
          };
        } else {
          throw new Error("ชื่อผู้ใช้หรือรหัส PIN ไม่ถูกต้อง");
        }
      }

      this.currentUser = {
        id: user.id,
        role: user.role, // 'officer' หรือ 'executive'
        communityId: null, // ไม่มีข้อจำกัดเรื่องชุมชน
        communityName: "ทุกชุมชน (เทศบาลตำบลตันหยงมัส)",
        fullName: user.fullName,
        phone: user.phone || "-"
      };
    }

    localStorage.setItem('tmcare_session_user', JSON.stringify(this.currentUser));
    return this.currentUser;
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('tmcare_session_user');
  },

  getCurrentUser() {
    if (!this.currentUser) {
      this.init();
    }
    return this.currentUser;
  },

  // ----------------------------------------------------
  // การบังคับสิทธิ์และคัดกรองข้อมูลตามชุมชน (Community Scoping)
  // ----------------------------------------------------
  getScopedCommunityId(targetCommunityId = null) {
    const user = this.getCurrentUser();
    if (!user) return null;

    // หากเป็นคณะกรรมการชุมชน บังคับให้เป็นชุมชนตนเองเสมอ ไม่ว่าจะส่งอะไรมา
    if (user.role === 'committee') {
      return user.communityId;
    }

    // หากเป็นผู้บริหารหรือเจ้าหน้าที่กองสวัสดิการ สามารถเลือกดูรายชุมชนหรือดูทั้งหมดได้
    return targetCommunityId || null;
  },

  // ----------------------------------------------------
  // 1. ทะเบียนผู้พิการและกลุ่มเปราะบาง (Beneficiaries)
  // ----------------------------------------------------
  async getBeneficiaries(filterCommunityId = null, searchKeyword = '', triageFilter = 'all') {
    const scopedComId = this.getScopedCommunityId(filterCommunityId);
    let list = [];

    const provider = this.getProvider();
    if (provider === 'GAS' && gasDriver.getApiUrl()) {
      try {
        const res = await gasDriver.getAllData(scopedComId);
        if (res) {
          list = res.beneficiaries || [];
          if (!scopedComId) {
            localStorage.setItem('tmcare_db_beneficiaries', JSON.stringify(list));
          } else {
            const currentCached = JSON.parse(localStorage.getItem('tmcare_db_beneficiaries') || '[]');
            const otherComBens = currentCached.filter(b => b.communityId !== scopedComId);
            localStorage.setItem('tmcare_db_beneficiaries', JSON.stringify([...otherComBens, ...list]));
          }
          if (res.visitLogs) localStorage.setItem('tmcare_db_visit_logs', JSON.stringify(res.visitLogs));
          if (res.welfareRecords) localStorage.setItem('tmcare_db_welfare_records', JSON.stringify(res.welfareRecords));
          if (res.disasterStatuses) localStorage.setItem('tmcare_db_disaster_statuses', JSON.stringify(res.disasterStatuses));
          if (res.users) localStorage.setItem('tmcare_db_users', JSON.stringify(res.users));
        }
      } catch (err) {
        console.warn("GAS Connection failed, fallback to local storage:", err);
        list = JSON.parse(localStorage.getItem('tmcare_db_beneficiaries') || '[]');
      }
    } else {
      list = JSON.parse(localStorage.getItem('tmcare_db_beneficiaries') || '[]');
    }

    // กรองตามชุมชน (Strict Scoping)
    if (scopedComId) {
      list = list.filter(item => item.communityId === scopedComId);
    }

    // กรองตามคำค้นหา
    if (searchKeyword && searchKeyword.trim()) {
      const q = searchKeyword.trim().toLowerCase();
      list = list.filter(item => 
        (item.firstName && item.firstName.toLowerCase().includes(q)) ||
        (item.lastName && item.lastName.toLowerCase().includes(q)) ||
        (item.cidMasked && item.cidMasked.includes(q)) ||
        (item.address && item.address.toLowerCase().includes(q)) ||
        (item.vulnerabilityType && item.vulnerabilityType.toLowerCase().includes(q))
      );
    }

    // กรองตามกลุ่มสี
    if (triageFilter && triageFilter !== 'all') {
      list = list.filter(item => item.triageLevel === triageFilter);
    }

    return list;
  },

  async getBeneficiaryById(id) {
    const user = this.getCurrentUser();
    const list = JSON.parse(localStorage.getItem('tmcare_db_beneficiaries') || '[]');
    const item = list.find(b => b.id === id);
    if (!item) return null;

    // บังคับสิทธิ์: ถ้าเป็นกรรมการชุมชน แล้วไม่ใช่ชุมชนตนเอง จะไม่อนุญาตให้เปิดดู
    if (user && user.role === 'committee' && item.communityId !== user.communityId) {
      throw new Error("ท่านไม่มีสิทธิ์เข้าถึงข้อมูลของลูกบ้านนอกชุมชนของท่าน");
    }
    return item;
  },

  async saveBeneficiary(data) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");

    // บังคับใส่ชุมชนตนเองหากเป็นกรรมการชุมชน
    if (user.role === 'committee') {
      data.communityId = user.communityId;
    }

    // คำนวณ Triage Level จาก ADL Score อัตโนมัติ (หากไม่ได้ระบุมา)
    const adl = parseInt(data.adlScore, 10);
    if (!isNaN(adl)) {
      if (adl <= 4) data.triageLevel = 'red';
      else if (adl <= 11) data.triageLevel = 'yellow';
      else data.triageLevel = 'green';
    }

    const list = JSON.parse(localStorage.getItem('tmcare_db_beneficiaries') || '[]');
    
    if (data.id) {
      // แก้ไข
      const index = list.findIndex(b => b.id === data.id);
      if (index !== -1) {
        list[index] = { ...list[index], ...data, updatedAt: new Date().toISOString() };
      }
    } else {
      // เพิ่มใหม่
      data.id = `BEN-${Date.now().toString().slice(-5)}`;
      data.createdAt = new Date().toISOString();
      data.updatedAt = new Date().toISOString();
      list.unshift(data);
    }

    localStorage.setItem('tmcare_db_beneficiaries', JSON.stringify(list));

    // หากเชื่อม GAS ให้บันทึกคู่ขนาน
    if (this.getProvider() === 'GAS' && gasDriver.getApiUrl()) {
      gasDriver.saveBeneficiary(data).catch(console.error);
    }

    return data;
  },

  // ----------------------------------------------------
  // 2. การเยี่ยมบ้าน (Home Visits)
  // ----------------------------------------------------
  async getVisitLogs(beneficiaryId = null, filterCommunityId = null) {
    const scopedComId = this.getScopedCommunityId(filterCommunityId);
    let list = JSON.parse(localStorage.getItem('tmcare_db_visit_logs') || '[]');

    if (scopedComId) {
      list = list.filter(item => item.communityId === scopedComId);
    }

    if (beneficiaryId) {
      list = list.filter(item => item.beneficiaryId === beneficiaryId);
    }

    return list.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
  },

  async saveVisitLog(logData) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");

    if (user.role === 'committee') {
      logData.communityId = user.communityId;
    }
    logData.id = `VIS-${Date.now().toString().slice(-5)}`;
    logData.visitorName = logData.visitorName || user.fullName;
    logData.visitDate = logData.visitDate || new Date().toISOString().split('T')[0];

    const list = JSON.parse(localStorage.getItem('tmcare_db_visit_logs') || '[]');
    list.unshift(logData);
    localStorage.setItem('tmcare_db_visit_logs', JSON.stringify(list));

    if (this.getProvider() === 'GAS' && gasDriver.getApiUrl()) {
      gasDriver.saveVisitLog(logData).catch(console.error);
    }

    return logData;
  },

  // ----------------------------------------------------
  // 3. สวัสดิการและการเงิน (Welfare & Requests)
  // ----------------------------------------------------
  async getWelfareRecords(beneficiaryId = null, filterCommunityId = null) {
    const scopedComId = this.getScopedCommunityId(filterCommunityId);
    let list = JSON.parse(localStorage.getItem('tmcare_db_welfare_records') || '[]');

    if (scopedComId) {
      list = list.filter(item => item.communityId === scopedComId);
    }

    if (beneficiaryId) {
      list = list.filter(item => item.beneficiaryId === beneficiaryId);
    }

    return list.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
  },

  async saveWelfareRecord(recordData) {
    const user = this.getCurrentUser();
    if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");

    if (user.role === 'committee') {
      recordData.communityId = user.communityId;
      recordData.requestedBy = user.fullName;
    }

    const list = JSON.parse(localStorage.getItem('tmcare_db_welfare_records') || '[]');

    if (recordData.id) {
      const idx = list.findIndex(r => r.id === recordData.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...recordData };
      }
    } else {
      recordData.id = `WEL-${Date.now().toString().slice(-5)}`;
      recordData.requestDate = recordData.requestDate || new Date().toISOString().split('T')[0];
      recordData.status = recordData.status || 'requested';
      list.unshift(recordData);
    }

    localStorage.setItem('tmcare_db_welfare_records', JSON.stringify(list));

    if (this.getProvider() === 'GAS' && gasDriver.getApiUrl()) {
      gasDriver.saveWelfareRecord(recordData).catch(console.error);
    }

    return recordData;
  },

  // เจ้าหน้าที่อนุมัติคำร้อง/มอบสิ่งของ
  async updateWelfareStatus(recordId, status, deliveryDate = null, notes = '') {
    const user = this.getCurrentUser();
    if (user.role === 'committee') {
      throw new Error("เฉพาะเจ้าหน้าที่กองสวัสดิการสังคมเท่านั้นที่มีสิทธิ์เปลี่ยนสถานะคำร้อง");
    }

    const list = JSON.parse(localStorage.getItem('tmcare_db_welfare_records') || '[]');
    const record = list.find(r => r.id === recordId);
    if (!record) throw new Error("ไม่พบรายการสวัสดิการนี้");

    record.status = status;
    if (deliveryDate) record.deliveryDate = deliveryDate;
    if (notes) record.notes = notes;
    record.approvedBy = user.fullName;

    localStorage.setItem('tmcare_db_welfare_records', JSON.stringify(list));
    return record;
  },

  // ----------------------------------------------------
  // 4. การจัดการภัยพิบัติและการแพทย์ฉุกเฉิน (Disaster & EMS)
  // ----------------------------------------------------
  async getDisasterStatuses(filterCommunityId = null) {
    const scopedComId = this.getScopedCommunityId(filterCommunityId);
    let list = JSON.parse(localStorage.getItem('tmcare_db_disaster_statuses') || '[]');

    if (scopedComId) {
      list = list.filter(item => item.communityId === scopedComId);
    }

    return list;
  },

  async updateDisasterStatus(beneficiaryId, evacStatus, needsDetail = '', shelterName = '-') {
    const user = this.getCurrentUser();
    const ben = await this.getBeneficiaryById(beneficiaryId);
    if (!ben) throw new Error("ไม่พบข้อมูลผู้พิการ");

    const list = JSON.parse(localStorage.getItem('tmcare_db_disaster_statuses') || '[]');
    let item = list.find(s => s.beneficiaryId === beneficiaryId);

    const nowStr = new Date().toLocaleString('th-TH');

    if (item) {
      item.evacStatus = evacStatus;
      item.needsDetail = needsDetail || item.needsDetail;
      item.shelterName = shelterName || item.shelterName;
      item.updatedAt = nowStr;
    } else {
      item = {
        beneficiaryId: beneficiaryId,
        communityId: ben.communityId,
        evacStatus: evacStatus,
        needsDetail: needsDetail,
        shelterName: shelterName,
        updatedAt: nowStr
      };
      list.push(item);
    }

    localStorage.setItem('tmcare_db_disaster_statuses', JSON.stringify(list));

    if (this.getProvider() === 'GAS' && gasDriver.getApiUrl()) {
      gasDriver.updateDisasterStatus(item).catch(console.error);
    }

    return item;
  },

  // ----------------------------------------------------
  // ข้อมูลสถิติสำหรับ Dashboard
  // ----------------------------------------------------
  async getDashboardStats(filterCommunityId = null) {
    const scopedComId = this.getScopedCommunityId(filterCommunityId);
    const beneficiaries = await this.getBeneficiaries(scopedComId);
    const welfare = await this.getWelfareRecords(null, scopedComId);
    const disaster = await this.getDisasterStatuses(scopedComId);

    const total = beneficiaries.length;
    const red = beneficiaries.filter(b => b.triageLevel === 'red').length;
    const yellow = beneficiaries.filter(b => b.triageLevel === 'yellow').length;
    const green = beneficiaries.filter(b => b.triageLevel === 'green').length;

    const pendingRequests = welfare.filter(w => w.status === 'requested').length;
    const needEvacHelp = disaster.filter(d => d.evacStatus === 'need_help').length;
    const evacuated = disaster.filter(d => d.evacStatus === 'evacuated').length;

    // สถิติแยกตามชุมชน: หากเป็นเจ้าหน้าที่/ผู้บริหาร ให้คำนวณจากทั้ง 7 ชุมชนครบถ้วน
    const user = this.getCurrentUser();
    let allBeneficiaries = beneficiaries;
    if (user && user.role !== 'committee') {
      allBeneficiaries = JSON.parse(localStorage.getItem('tmcare_db_beneficiaries') || '[]');
    }

    let communityBreakdown = TMCARE_CONFIG.COMMUNITIES.map(c => {
      const comBens = allBeneficiaries.filter(b => b.communityId === c.id);
      return {
        id: c.id,
        name: c.name,
        total: comBens.length,
        red: comBens.filter(b => b.triageLevel === 'red').length,
        yellow: comBens.filter(b => b.triageLevel === 'yellow').length,
        green: comBens.filter(b => b.triageLevel === 'green').length
      };
    });

    // หากผู้ใช้เป็นคณะกรรมการชุมชน ให้แสดงเฉพาะข้อมูลชุมชนของตนเองเท่านั้น
    if (user && user.role === 'committee') {
      communityBreakdown = communityBreakdown.filter(c => c.id === user.communityId);
    }

    // คำนวณสถิติเพศ
    const maleCount = beneficiaries.filter(b => {
      const p = (b.prefix || '').trim();
      return p.includes('นาย') || p.includes('ด.ช.') || p.includes('เด็กชาย');
    }).length;
    const femaleCount = total - maleCount;

    // คำนวณสถิติช่วงอายุ
    let ageChild = 0, ageWorking = 0, ageElderly = 0, ageSuperElderly = 0;
    beneficiaries.forEach(b => {
      const a = parseInt(b.age, 10) || 0;
      if (a < 18) ageChild++;
      else if (a < 60) ageWorking++;
      else if (a < 80) ageElderly++;
      else ageSuperElderly++;
    });

    // คำนวณอุปกรณ์และความจำเป็นเร่งด่วน
    let needOxygen = 0, needBed = 0, needWheelchair = 0, needDiaper = 0;
    beneficiaries.forEach(b => {
      const dev = ((b.medicalDevices || '') + ' ' + (b.chronicDiseases || '')).toLowerCase();
      const vul = (b.vulnerabilityType || '').toLowerCase();
      if (dev.includes('ออกซิเจน') || dev.includes('oxygen')) needOxygen++;
      if (dev.includes('เตียง') || vul.includes('ติดเตียง') || (b.adlScore !== undefined && b.adlScore <= 4)) needBed++;
      if (dev.includes('วีลแชร์') || dev.includes('รถเข็น') || dev.includes('wheelchair')) needWheelchair++;
      if (dev.includes('ผ้าอ้อม') || vul.includes('ติดเตียง') || (b.adlScore !== undefined && b.adlScore <= 4)) needDiaper++;
    });

    return {
      total,
      red,
      yellow,
      green,
      pendingRequests,
      needEvacHelp,
      evacuated,
      communityBreakdown,
      gender: { male: maleCount, female: femaleCount },
      ages: { child: ageChild, working: ageWorking, elderly: ageElderly, superElderly: ageSuperElderly },
      needs: { oxygen: needOxygen, bed: needBed, wheelchair: needWheelchair, diaper: needDiaper },
      scopedCommunityName: scopedComId 
        ? (TMCARE_CONFIG.COMMUNITIES.find(c => c.id === scopedComId)?.name || scopedComId)
        : "เทศบาลตำบลตันหยงมัส (รวมทุกชุมชน)"
    };
  }
};

apiService.init();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = apiService;
}

