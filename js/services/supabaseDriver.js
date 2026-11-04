/**
 * TMCare Supabase Driver (Future Scale)
 * โครงสร้างเชื่อมต่อ Supabase PostgreSQL + PostGIS + Storage
 */

const supabaseDriver = {
  client: null,

  getClient() {
    if (this.client) return this.client;
    const url = localStorage.getItem('tmcare_supabase_url') || TMCARE_CONFIG.SUPABASE_URL;
    const key = localStorage.getItem('tmcare_supabase_key') || TMCARE_CONFIG.SUPABASE_ANON_KEY;
    
    if (window.supabase && url && key) {
      this.client = window.supabase.createClient(url, key);
      return this.client;
    }
    return null;
  },

  isConfigured() {
    const url = localStorage.getItem('tmcare_supabase_url') || TMCARE_CONFIG.SUPABASE_URL;
    const key = localStorage.getItem('tmcare_supabase_key') || TMCARE_CONFIG.SUPABASE_ANON_KEY;
    return !!(url && key);
  },

  async getAllData(communityId = null) {
    const client = this.getClient();
    if (!client) throw new Error("ยังไม่ได้กำหนดการเชื่อมต่อ Supabase");

    let benQuery = client.from('beneficiaries').select('*');
    let visitQuery = client.from('visit_logs').select('*');
    let welQuery = client.from('welfare_records').select('*');
    let disQuery = client.from('disaster_statuses').select('*');

    if (communityId) {
      benQuery = benQuery.eq('community_id', communityId);
      visitQuery = visitQuery.eq('community_id', communityId);
      welQuery = welQuery.eq('community_id', communityId);
      disQuery = disQuery.eq('community_id', communityId);
    }

    const [benRes, visitRes, welRes, disRes] = await Promise.all([
      benQuery, visitQuery, welQuery, disQuery
    ]);

    return {
      beneficiaries: benRes.data || [],
      visitLogs: visitRes.data || [],
      welfareRecords: welRes.data || [],
      disasterStatuses: disRes.data || []
    };
  },

  async saveBeneficiary(beneficiary) {
    const client = this.getClient();
    return await client.from('beneficiaries').upsert(beneficiary);
  },

  async saveVisitLog(log) {
    const client = this.getClient();
    return await client.from('visit_logs').insert(log);
  },

  async saveWelfareRecord(record) {
    const client = this.getClient();
    return await client.from('welfare_records').upsert(record);
  },

  async updateDisasterStatus(status) {
    const client = this.getClient();
    return await client.from('disaster_statuses').upsert(status);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = supabaseDriver;
}

