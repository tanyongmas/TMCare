/**
 * TMCare Google Apps Script Driver
 * สื่อสารกับ Google Apps Script Web App API
 * เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส
 */

const gasDriver = {
  getApiUrl() {
    return (localStorage.getItem('tmcare_gas_url') || '').trim();
  },

  setApiUrl(url) {
    localStorage.setItem('tmcare_gas_url', (url || '').trim());
  },

  async request(action, params = {}, method = 'GET', body = null) {
    const baseUrl = this.getApiUrl();
    if (!baseUrl) {
      throw new Error("ยังไม่ได้ระบุ Google Apps Script Web App URL ในหน้าตั้งค่า");
    }

    const queryParams = new URLSearchParams({ action, ...params });
    const url = `${baseUrl}?${queryParams.toString()}`;

    const options = {
      method: method,
      redirect: 'follow', // จำเป็นอย่างยิ่งสำหรับการ Redirect ของ Google Apps Script (HTTP 302)
      headers: {
        'Accept': 'application/json'
      }
    };

    if (method === 'POST' && body) {
      // ใช้ text/plain เพื่อป้องกัน CORS Preflight OPTIONS ที่ GAS ไม่รองรับ
      options.headers['Content-Type'] = 'text/plain;charset=utf-8';
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} (${response.statusText})`);
      }
      const data = await response.json();
      if (data.status === 'error') {
        throw new Error(data.message || 'เกิดข้อผิดพลาดในการประมวลผลบน Google Sheets');
      }
      return data;
    } catch (err) {
      console.error(`GAS API Error [${action}]:`, err);
      // แนะนำสาเหตุหากเป็นปัญหา Network/CORS ของ GAS
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error("ไม่สามารถติดต่อ Google Apps Script ได้ กรุณาตรวจสอบว่าตั้งค่า Web App เป็น 'Anyone (ทุกคน)' แล้วหรือไม่");
      }
      throw err;
    }
  },

  // ทดสอบการเชื่อมต่อกับ Google Apps Script (Ping / Test Connection)
  async testConnection(targetUrl = null) {
    const oldUrl = this.getApiUrl();
    if (targetUrl) {
      localStorage.setItem('tmcare_gas_url', targetUrl.trim());
    }

    try {
      const res = await this.request('testConnection');
      return {
        success: true,
        message: res.message || "เชื่อมต่อสำเร็จ",
        databaseName: res.databaseName || "Google Sheets",
        version: res.version || "1.0.0"
      };
    } catch (err) {
      if (targetUrl) {
        localStorage.setItem('tmcare_gas_url', oldUrl); // คืนค่าเดิมหากทดสอบไม่ผ่าน
      }
      return {
        success: false,
        message: err.message
      };
    }
  },

  // ดึงข้อมูลทั้งหมดของระบบ
  async getAllData(communityId = null) {
    return await this.request('getAllData', { communityId: communityId || '' });
  },

  // บันทึก/แก้ไขผู้พิการและกลุ่มเปราะบาง
  async saveBeneficiary(beneficiary) {
    return await this.request('saveBeneficiary', {}, 'POST', beneficiary);
  },

  // บันทึกประวัติการเยี่ยมบ้าน
  async saveVisitLog(log) {
    return await this.request('saveVisitLog', {}, 'POST', log);
  },

  // บันทึก/อัปเดตคำร้องขอสวัสดิการ
  async saveWelfareRecord(record) {
    return await this.request('saveWelfareRecord', {}, 'POST', record);
  },

  // อัปเดตสถานะอพยพ/ภัยพิบัติ
  async updateDisasterStatus(status) {
    return await this.request('updateDisasterStatus', {}, 'POST', status);
  },

  // อัปโหลดรูปภาพไปยัง Google Drive
  async uploadImage(base64Data, filename) {
    return await this.request('uploadImage', {}, 'POST', {
      base64Data,
      filename
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = gasDriver;
}
