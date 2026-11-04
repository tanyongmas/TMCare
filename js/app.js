/**
 * TMCare Main Application Controller
 * เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส
 */

const app = {
  currentTab: 'dashboard',
  currentCommunityFilter: null,
  currentTriageFilter: 'all',
  currentWelfareFilter: 'all',
  currentEvacFilter: 'all',
  dashboardMap: null,
  dashboardMarkersLayer: null,
  disasterMap: null,
  disasterMarkersLayer: null,
  triageChart: null,

  async init() {
    console.log("Initializing TMCare Application...");
    apiService.init();

    // ตรวจสอบสถานะการเข้าสู่ระบบ
    const user = apiService.getCurrentUser();
    if (!user) {
      this.openModal('modal-login');
    } else {
      this.updateUserUI(user);
      await this.loadCurrentView();
    }

    this.setupEventListeners();
  },

  setupEventListeners() {
    // SOS Quick Call
    const sosBtn = document.getElementById('btn-quick-sos');
    if (sosBtn) {
      sosBtn.addEventListener('click', () => {
        if (confirm("ต้องการโทรออกสายด่วนการแพทย์ฉุกเฉิน 1669 ทันทีหรือไม่?")) {
          window.location.href = "tel:1669";
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm("ต้องการออกจากระบบ / สลับบัญชีผู้ใช้งานหรือไม่?")) {
          apiService.logout();
          window.location.reload();
        }
      });
    }

    // DB Status button
    const dbBtn = document.getElementById('btn-db-status');
    if (dbBtn) {
      dbBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    // Escape key closes open modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['modal-beneficiary', 'modal-visit', 'modal-welfare', 'modal-ems-card', 'modal-settings'].forEach(id => {
          this.closeModal(id);
        });
      }
    });

    // Before Print Hook (Automatic data population for Ctrl+P)
    window.addEventListener('beforeprint', () => {
      this.preparePrintData();
    });
  },

  // ----------------------------------------------------
  // ระบบเข้าสู่ระบบ (Authentication UI)
  // ----------------------------------------------------
  switchLoginTab(type) {
    const tabCom = document.getElementById('tab-btn-login-com');
    const tabOfficer = document.getElementById('tab-btn-login-officer');
    const formCom = document.getElementById('form-login-committee');
    const formOfficer = document.getElementById('form-login-officer');

    if (type === 'committee') {
      tabCom.className = "py-2 rounded-lg bg-white text-rose-700 shadow-sm transition";
      tabOfficer.className = "py-2 rounded-lg text-slate-500 hover:text-slate-800 transition";
      formCom.classList.remove('hidden');
      formOfficer.classList.add('hidden');
    } else {
      tabOfficer.className = "py-2 rounded-lg bg-white text-rose-700 shadow-sm transition";
      tabCom.className = "py-2 rounded-lg text-slate-500 hover:text-slate-800 transition";
      formOfficer.classList.remove('hidden');
      formCom.classList.add('hidden');
    }
  },

  handleLoginCommittee(e) {
    e.preventDefault();
    const comSelect = document.getElementById('login-com-select');
    const pinInput = document.getElementById('login-com-pin');

    const communityId = comSelect.value;
    const pin = pinInput.value.trim();

    if (!communityId) {
      alert("กรุณาเลือกชุมชนที่ท่านรับผิดชอบ");
      return;
    }

    try {
      const user = apiService.login('committee', { communityId, pin });
      this.closeModal('modal-login');
      this.updateUserUI(user);
      this.loadCurrentView();
    } catch (err) {
      alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
    }
  },

  handleLoginOfficer(e) {
    e.preventDefault();
    const roleSelect = document.getElementById('login-officer-role');
    const pinInput = document.getElementById('login-officer-pin');

    const role = roleSelect.value;
    const pin = pinInput.value.trim();

    try {
      const user = apiService.login(role, { username: role, pin });
      this.closeModal('modal-login');
      this.updateUserUI(user);
      this.loadCurrentView();
    } catch (err) {
      alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
    }
  },

  updateUserUI(user) {
    if (!user) return;

    // Header Badges
    const roleBadge = document.getElementById('user-badge-role');
    const comBadge = document.getElementById('user-badge-community');
    const mobileComName = document.getElementById('mobile-community-name');
    const mobileRoleLabel = document.getElementById('mobile-role-label');
    const dbProviderName = document.getElementById('db-provider-name');

    if (roleBadge) {
      if (user.role === 'committee') {
        roleBadge.textContent = "คณะกรรมการชุมชน";
      } else if (user.role === 'officer') {
        roleBadge.textContent = "เจ้าหน้าที่กองสวัสดิการฯ";
      } else {
        roleBadge.textContent = "ผู้บริหารเทศบาล";
      }
    }

    if (comBadge) {
      comBadge.textContent = user.communityName || "ทต.ตันหยงมัส";
    }

    if (mobileComName) {
      mobileComName.textContent = user.communityName || "ทต.ตันหยงมัส";
    }
    if (mobileRoleLabel) {
      mobileRoleLabel.textContent = user.role === 'committee' ? 'กรรมการชุมชน' : 'เทศบาล';
    }

    if (dbProviderName) {
      const p = apiService.getProvider();
      dbProviderName.textContent = p === 'GAS' ? 'Google Sheets' : (p === 'MOCK' ? 'LocalStorage' : p);
    }

    const dbDot = document.getElementById('db-indicator-dot');
    const gasBanner = document.getElementById('gas-setup-banner');
    if (apiService.getProvider() === 'GAS') {
      const hasUrl = !!gasDriver.getApiUrl();
      if (dbDot) {
        dbDot.className = hasUrl ? "w-2 h-2 rounded-full bg-emerald-400" : "w-2 h-2 rounded-full bg-amber-400 animate-ping";
      }
      if (gasBanner) {
        if (!hasUrl) {
          gasBanner.classList.remove('hidden');
        } else {
          gasBanner.classList.add('hidden');
        }
      }
    } else {
      if (gasBanner) gasBanner.classList.add('hidden');
      if (dbDot) dbDot.className = "w-2 h-2 rounded-full bg-slate-400";
    }

    // ปรับ UI ตามบทบาท (Scoping Controls)
    const comFilterBox = document.getElementById('dashboard-com-filter-box');
    const benFilterBox = document.getElementById('filter-community-box');
    const benScopeHint = document.getElementById('ben-scope-hint');

    if (user.role === 'committee') {
      // คณะกรรมการชุมชนถูกล็อกเฉพาะชุมชนตนเอง
      if (comFilterBox) comFilterBox.classList.add('hidden');
      if (benFilterBox) benFilterBox.classList.add('hidden');
      if (benScopeHint) benScopeHint.textContent = `แสดงเฉพาะลูกบ้านใน ${user.communityName} (มีสิทธิ์เข้าถึงเฉพาะชุมชนนี้)`;
    } else {
      // เจ้าหน้าที่และผู้บริหารสามารถเลือกสลับดูรายชุมชนได้
      if (comFilterBox) comFilterBox.classList.remove('hidden');
      if (benFilterBox) benFilterBox.classList.remove('hidden');
      if (benScopeHint) benScopeHint.textContent = `สามารถตรวจสอบข้อมูลได้ครบทั้ง 7 ชุมชนในเขต ทต.ตันหยงมัส`;

      this.populateCommunityDropdowns();
    }
  },

  populateCommunityDropdowns() {
    const selects = [
      document.getElementById('select-dashboard-community'),
      document.getElementById('select-ben-community'),
      document.getElementById('form-ben-community')
    ];

    selects.forEach(select => {
      if (!select) return;
      const isForm = select.id === 'form-ben-community';
      const currentVal = select.value;
      
      select.innerHTML = isForm 
        ? '<option value="">-- กรุณาเลือกชุมชน --</option>' 
        : '<option value="">-- รวมทั้ง 7 ชุมชน --</option>';

      TMCARE_CONFIG.COMMUNITIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.id}: ${c.name}`;
        select.appendChild(opt);
      });

      if (currentVal) select.value = currentVal;
    });
  },

  // ----------------------------------------------------
  // การสลับแท็บ (Tab Navigation)
  // ----------------------------------------------------
  async switchTab(tabId) {
    this.currentTab = tabId;

    // ซ่อนทุกแท็บ
    ['dashboard', 'beneficiaries', 'welfare', 'disaster'].forEach(id => {
      const tabEl = document.getElementById(`tab-${id}`);
      if (tabEl) tabEl.classList.add('hidden');
    });

    // แสดงแท็บที่เลือก
    const activeEl = document.getElementById(`tab-${tabId}`);
    if (activeEl) activeEl.classList.remove('hidden');

    // อัปเดตสไตล์ Nav bar
    document.querySelectorAll('.nav-tab').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.className = "nav-tab active-tab py-3 px-2 md:px-4 text-xs md:text-sm font-semibold border-b-2 border-rose-600 text-rose-700 flex items-center space-x-1.5";
      } else {
        btn.className = "nav-tab py-3 px-2 md:px-4 text-xs md:text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-1.5";
      }
    });

    // อัปเดตสไตล์ Mobile Nav bar
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-mobile-tab') === tabId) {
        btn.className = "mobile-tab-btn flex flex-col items-center text-rose-600 active-mobile-tab";
      } else {
        btn.className = "mobile-tab-btn flex flex-col items-center text-slate-400";
      }
    });

    await this.loadCurrentView();

    // Invalidate size on visible maps
    setTimeout(() => {
      if (tabId === 'dashboard' && this.dashboardMap) {
        this.dashboardMap.invalidateSize();
      } else if (tabId === 'disaster' && this.disasterMap) {
        this.disasterMap.invalidateSize();
      }
    }, 250);
  },

  async loadCurrentView() {
    if (this.currentTab === 'dashboard') {
      await this.renderDashboard();
    } else if (this.currentTab === 'beneficiaries') {
      await this.renderBeneficiaries();
    } else if (this.currentTab === 'welfare') {
      await this.renderWelfare();
    } else if (this.currentTab === 'disaster') {
      await this.renderDisaster();
    }
  },

  // ----------------------------------------------------
  // 1. DASHBOARD CONTROLLER
  // ----------------------------------------------------
  async renderDashboard() {
    const stats = await apiService.getDashboardStats(this.currentCommunityFilter);

    // ปรับตัวเลขสถิติ
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-red').textContent = stats.red;
    document.getElementById('stat-yellow').textContent = stats.yellow;
    document.getElementById('stat-green').textContent = stats.green;
    document.getElementById('stat-pending-welfare').textContent = stats.pendingRequests;
    document.getElementById('stat-need-help').textContent = stats.needEvacHelp;

    // Scope Badge
    const scopeBadge = document.getElementById('dashboard-scope-badge');
    if (scopeBadge) {
      scopeBadge.textContent = stats.scopedCommunityName;
    }

    // Disaster Banner
    const bannerCount = document.getElementById('banner-need-help-count');
    if (bannerCount) {
      bannerCount.textContent = `${stats.needEvacHelp} ราย`;
    }

    // Pending Welfare Badge
    const welfareBadge = document.getElementById('badge-pending-welfare');
    if (welfareBadge) {
      if (stats.pendingRequests > 0) {
        welfareBadge.textContent = stats.pendingRequests;
        welfareBadge.classList.remove('hidden');
      } else {
        welfareBadge.classList.add('hidden');
      }
    }

    // Dynamic Community Breakdown Table Title
    const user = apiService.getCurrentUser();
    const tableTitleEl = document.getElementById('title-community-breakdown');
    if (tableTitleEl) {
      if (user && user.role === 'committee') {
        tableTitleEl.textContent = `สรุปสถานการณ์: ${user.communityName} (ข้อมูลในความรับผิดชอบ)`;
      } else {
        tableTitleEl.textContent = "สรุปสถานการณ์จำแนกตาม 7 ชุมชน ทต.ตันหยงมัส";
      }
    }

    // อัปเดตตารางสรุปชุมชน
    const tbody = document.getElementById('table-community-breakdown');
    if (tbody) {
      tbody.innerHTML = '';
      stats.communityBreakdown.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
          <td class="py-2.5 px-3 font-medium text-slate-800">
            <div>${c.name}</div>
            <div class="text-[10px] text-slate-400">รหัส: ${c.id}</div>
          </td>
          <td class="py-2.5 px-2 text-center font-bold text-red-600">${c.red}</td>
          <td class="py-2.5 px-2 text-center text-amber-600 font-medium">${c.yellow}</td>
          <td class="py-2.5 px-2 text-center text-emerald-600 font-medium">${c.green}</td>
          <td class="py-2.5 px-2 text-center font-bold text-slate-700">${c.total}</td>
          <td class="py-2.5 px-2 text-center">
            <button onclick="app.viewCommunityBeneficiaries('${c.id}')" class="text-rose-600 hover:text-rose-800 underline text-[11px]">
              ดูรายชื่อ
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // อัปเดตสถิติเชิงลึก: สัดส่วนเพศ
    if (stats.gender) {
      const totalGender = (stats.gender.male + stats.gender.female) || 1;
      const malePct = Math.round((stats.gender.male / totalGender) * 100);
      const femalePct = 100 - malePct;

      const elMale = document.getElementById('stat-gender-male');
      const elFemale = document.getElementById('stat-gender-female');
      const elMalePct = document.getElementById('stat-gender-male-pct');
      const elFemalePct = document.getElementById('stat-gender-female-pct');
      const barMale = document.getElementById('bar-gender-male');
      const barFemale = document.getElementById('bar-gender-female');

      if (elMale) elMale.textContent = stats.gender.male;
      if (elFemale) elFemale.textContent = stats.gender.female;
      if (elMalePct) elMalePct.textContent = `${malePct}%`;
      if (elFemalePct) elFemalePct.textContent = `${femalePct}%`;
      if (barMale) barMale.style.width = `${malePct}%`;
      if (barFemale) barFemale.style.width = `${femalePct}%`;
    }

    // อัปเดตสถิติเชิงลึก: กลุ่มช่วงอายุ
    if (stats.ages) {
      const elChild = document.getElementById('stat-age-child');
      const elWorking = document.getElementById('stat-age-working');
      const elElderly = document.getElementById('stat-age-elderly');
      const elSuper = document.getElementById('stat-age-super-elderly');

      if (elChild) elChild.textContent = `${stats.ages.child} ราย`;
      if (elWorking) elWorking.textContent = `${stats.ages.working} ราย`;
      if (elElderly) elElderly.textContent = `${stats.ages.elderly} ราย`;
      if (elSuper) elSuper.textContent = `${stats.ages.superElderly} ราย`;
    }

    // อัปเดตสถิติเชิงลึก: อุปกรณ์และความจำเป็นเร่งด่วน
    if (stats.needs) {
      const elOxy = document.getElementById('stat-need-oxygen');
      const elBed = document.getElementById('stat-need-bed');
      const elWheel = document.getElementById('stat-need-wheelchair');
      const elDiaper = document.getElementById('stat-need-diaper');

      if (elOxy) elOxy.textContent = `${stats.needs.oxygen} ราย`;
      if (elBed) elBed.textContent = `${stats.needs.bed} ราย`;
      if (elWheel) elWheel.textContent = `${stats.needs.wheelchair} ราย`;
      if (elDiaper) elDiaper.textContent = `${stats.needs.diaper} ราย`;
    }

    // Legend พร้อมแสดงสัดส่วนเปอร์เซ็นต์
    const totalTriage = (stats.red + stats.yellow + stats.green) || 1;
    const redPct = Math.round((stats.red / totalTriage) * 100);
    const yellowPct = Math.round((stats.yellow / totalTriage) * 100);
    const greenPct = 100 - redPct - yellowPct;

    const elLegRed = document.getElementById('chart-legend-red');
    const elLegYellow = document.getElementById('chart-legend-yellow');
    const elLegGreen = document.getElementById('chart-legend-green');
    if (elLegRed) elLegRed.textContent = `${stats.red} ราย (${redPct}%)`;
    if (elLegYellow) elLegYellow.textContent = `${stats.yellow} ราย (${yellowPct}%)`;
    if (elLegGreen) elLegGreen.textContent = `${stats.green} ราย (${greenPct}%)`;

    // อัปเดต Donut Chart
    this.renderTriageChart(stats.red, stats.yellow, stats.green);

    // อัปเดตแผนที่พิกัด GIS ในหน้าภาพรวม (Dashboard Map)
    await this.renderDashboardMap();

    // จัดเตรียมข้อมูลสำหรับพิมพ์รายงาน A4 แนวนอน
    this.preparePrintData();
  },

  async renderDashboardMap() {
    const mapDiv = document.getElementById('dashboard-gis-map');
    if (!mapDiv) return;

    if (!this.dashboardMap) {
      this.dashboardMap = L.map('dashboard-gis-map').setView(
        [TMCARE_CONFIG.MAP_CENTER.lat, TMCARE_CONFIG.MAP_CENTER.lng], 
        TMCARE_CONFIG.MAP_CENTER.zoom
      );
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors | TMCare ทต.ตันหยงมัส'
      }).addTo(this.dashboardMap);

      this.dashboardMarkersLayer = L.layerGroup().addTo(this.dashboardMap);
    }

    this.dashboardMarkersLayer.clearLayers();

    // ดึงรายชื่อกลุ่มเปราะบางตามตัวกรองชุมชนปัจจุบัน
    const beneficiaries = await apiService.getBeneficiaries(this.currentCommunityFilter);

    beneficiaries.forEach(b => {
      if (!b.lat || !b.lng) return;

      let pinClass = 'pin-green';
      let iconClass = 'fa-solid fa-person-walking';
      let pulseHtml = '';

      if (b.triageLevel === 'red') {
        pinClass = 'pin-red';
        iconClass = 'fa-solid fa-bed-pulse';
        pulseHtml = '<div class="pin-pulse-red"></div>';
      } else if (b.triageLevel === 'yellow') {
        pinClass = 'pin-yellow';
        iconClass = 'fa-solid fa-wheelchair';
      }

      const iconHtml = `
        <div class="map-pin-marker">
          <div class="map-pin-body ${pinClass}">
            <i class="${iconClass}"></i>
          </div>
          ${pulseHtml}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: iconHtml,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
        popupAnchor: [0, -40]
      });

      L.marker([b.lat, b.lng], { icon: customIcon })
        .bindPopup(this.createMapPopupContent(b), { maxWidth: 300, minWidth: 260 })
        .addTo(this.dashboardMarkersLayer);
    });

    setTimeout(() => {
      if (this.dashboardMap) this.dashboardMap.invalidateSize();
    }, 200);
  },

  resetDashboardMapCenter() {
    if (this.dashboardMap) {
      this.dashboardMap.setView([TMCARE_CONFIG.MAP_CENTER.lat, TMCARE_CONFIG.MAP_CENTER.lng], TMCARE_CONFIG.MAP_CENTER.zoom);
    }
  },

  renderTriageChart(red, yellow, green) {
    const ctx = document.getElementById('chart-triage');
    if (!ctx) return;

    if (this.triageChart) {
      this.triageChart.destroy();
    }

    this.triageChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['🔴 แดง (ติดเตียง)', '🟡 เหลือง (ติดบ้าน)', '🟢 เขียว (ติดสังคม)'],
        datasets: [{
          data: [red, yellow, green],
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        cutout: '65%'
      }
    });
  },

  filterDashboardCommunity(comId) {
    this.currentCommunityFilter = comId || null;
    this.renderDashboard();
  },

  viewCommunityBeneficiaries(comId) {
    const user = apiService.getCurrentUser();
    if (user.role === 'committee' && user.communityId !== comId) {
      alert("ท่านสามารถดูข้อมูลได้เฉพาะชุมชนของท่านเท่านั้น");
      return;
    }
    const comSelect = document.getElementById('select-ben-community');
    if (comSelect) comSelect.value = comId;
    this.switchTab('beneficiaries');
  },

  // ----------------------------------------------------
  // 2. BENEFICIARIES & VISITS CONTROLLER
  // ----------------------------------------------------
  async renderBeneficiaries() {
    const searchVal = document.getElementById('input-search-ben')?.value || '';
    const triageVal = document.getElementById('select-triage-filter')?.value || 'all';
    const comVal = document.getElementById('select-ben-community')?.value || null;

    const list = await apiService.getBeneficiaries(comVal, searchVal, triageVal);
    const container = document.getElementById('beneficiaries-list');
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white p-8 rounded-xl text-center text-slate-400 border border-slate-200">
          <i class="fa-solid fa-folder-open text-4xl mb-2 text-slate-300"></i>
          <p>ไม่พบข้อมูลผู้พิการหรือกลุ่มเปราะบางตามเงื่อนไขที่ค้นหา</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => {
      const triageClass = item.triageLevel === 'red' ? 'triage-border-red' : (item.triageLevel === 'yellow' ? 'triage-border-yellow' : 'triage-border-green');
      const badgeClass = item.triageLevel === 'red' ? 'triage-badge-red' : (item.triageLevel === 'yellow' ? 'triage-badge-yellow' : 'triage-badge-green');
      const triageLabel = item.triageLevel === 'red' ? '🔴 สีแดง (ติดเตียง/วิกฤต)' : (item.triageLevel === 'yellow' ? '🟡 สีเหลือง (ติดบ้าน)' : '🟢 สีเขียว (ติดสังคม)');
      const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === item.communityId)?.name || item.communityId;

      return `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 card-hover ${triageClass} flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-start justify-between gap-2.5">
              <div class="flex items-center space-x-2.5 min-w-0">
                <img src="${item.photoUrl || 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=100'}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=100'" alt="photo" class="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0">
                <div class="min-w-0">
                  <h4 class="font-bold text-slate-800 text-sm truncate">${item.prefix}${item.firstName} ${item.lastName}</h4>
                  <div class="text-[11px] text-slate-500 truncate">อายุ ${item.age || '-'} ปี | เลข ปชช: ${item.cidMasked || '-'}</div>
                </div>
              </div>
              <span class="${badgeClass} shrink-0">
                ${triageLabel}
              </span>
            </div>

            <div class="mt-2.5 text-xs text-slate-600 space-y-1">
              <div class="flex items-center space-x-1.5 text-rose-800 font-medium">
                <i class="fa-solid fa-location-dot text-amber-500"></i>
                <span>${comName}</span>
              </div>
              <div class="truncate text-slate-500"><i class="fa-solid fa-house text-slate-400 mr-1"></i>${item.address}</div>
              <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] space-y-0.5">
                <div><strong class="text-slate-700">ภาวะเปราะบาง:</strong> ${item.vulnerabilityType}</div>
                <div><strong class="text-slate-700">คะแนน ADL:</strong> <span class="font-bold">${item.adlScore || 0}/20</span> | <strong>โรค:</strong> ${item.chronicDiseases || '-'}</div>
                <div><strong class="text-rose-600">อุปกรณ์พยุงชีพ:</strong> ${item.medicalDevices || 'ไม่มี'}</div>
              </div>
            </div>
          </div>

          <!-- Action Buttons Grid -->
          <div class="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <button onclick="app.openVisitModal('${item.id}')" class="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/90 font-medium py-1.5 px-1 rounded-lg text-center flex flex-col items-center transition shadow-xs">
              <i class="fa-solid fa-stethoscope mb-0.5 text-sky-600"></i>
              <span class="text-[10px] font-semibold">บันทึกเยี่ยม</span>
            </button>
            <button onclick="app.openEmsCard('${item.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium py-1.5 px-1 rounded-lg text-center flex flex-col items-center">
              <i class="fa-solid fa-truck-medical mb-0.5 text-rose-600"></i>
              <span class="text-[10px]">บัตรฉุกเฉิน</span>
            </button>
            <button onclick="app.openWelfareModalFor('${item.id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium py-1.5 px-1 rounded-lg text-center flex flex-col items-center">
              <i class="fa-solid fa-hand-holding-dollar mb-0.5 text-emerald-600"></i>
              <span class="text-[10px]">ขอสวัสดิการ</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  handleSearchBeneficiary() {
    this.renderBeneficiaries();
  },

  openAddBeneficiaryModal() {
    const user = apiService.getCurrentUser();
    document.getElementById('form-beneficiary').reset();
    document.getElementById('form-ben-id').value = '';
    document.getElementById('modal-ben-title').textContent = "ลงทะเบียนผู้พิการ/กลุ่มเปราะบางรายใหม่";

    const comSelect = document.getElementById('form-ben-community');
    if (user.role === 'committee') {
      comSelect.value = user.communityId;
      comSelect.disabled = true;
    } else {
      comSelect.disabled = false;
    }

    this.updateAdlPreview(8);
    this.openModal('modal-beneficiary');
  },

  updateAdlPreview(score) {
    const val = parseInt(score, 10);
    const badge = document.getElementById('form-adl-badge');
    if (!badge) return;

    if (val <= 4) {
      badge.className = "px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800";
      badge.textContent = "🔴 สีแดง (วิกฤต/ติดเตียง พึ่งพิง 100%)";
    } else if (val <= 11) {
      badge.className = "px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800";
      badge.textContent = "🟡 สีเหลือง (ติดบ้าน พึ่งพิงปานกลาง)";
    } else {
      badge.className = "px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800";
      badge.textContent = "🟢 สีเขียว (ติดสังคม ช่วยเหลือตนเองได้)";
    }
  },

  getCurrentGPS() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          document.getElementById('form-ben-lat').value = pos.coords.latitude.toFixed(6);
          document.getElementById('form-ben-lng').value = pos.coords.longitude.toFixed(6);
          alert("จับพิกัด GPS สำเร็จ: " + pos.coords.latitude.toFixed(4) + ", " + pos.coords.longitude.toFixed(4));
        },
        err => {
          // หากผู้ใช้ไม่ได้เปิด GPS บนเครื่อง ให้ใช้พิกัดกลาง ทต.ตันหยงมัส
          document.getElementById('form-ben-lat').value = TMCARE_CONFIG.MAP_CENTER.lat;
          document.getElementById('form-ben-lng').value = TMCARE_CONFIG.MAP_CENTER.lng;
          alert("ไม่สามารถเข้าถึง GPS ได้ ระบบได้ตั้งค่าพิกัดศูนย์กลาง ทต.ตันหยงมัส ให้แทน");
        }
      );
    }
  },

  async handleSaveBeneficiary(e) {
    e.preventDefault();
    const user = apiService.getCurrentUser();

    const data = {
      id: document.getElementById('form-ben-id').value || null,
      communityId: user.role === 'committee' ? user.communityId : document.getElementById('form-ben-community').value,
      prefix: document.getElementById('form-ben-prefix').value,
      firstName: document.getElementById('form-ben-firstname').value,
      lastName: document.getElementById('form-ben-lastname').value,
      cidMasked: document.getElementById('form-ben-cid').value,
      phone: document.getElementById('form-ben-phone').value,
      address: document.getElementById('form-ben-address').value,
      lat: parseFloat(document.getElementById('form-ben-lat').value) || TMCARE_CONFIG.MAP_CENTER.lat,
      lng: parseFloat(document.getElementById('form-ben-lng').value) || TMCARE_CONFIG.MAP_CENTER.lng,
      adlScore: parseInt(document.getElementById('form-ben-adl').value, 10) || 0,
      vulnerabilityType: document.getElementById('form-ben-vulnerability').value,
      chronicDiseases: document.getElementById('form-ben-chronic').value,
      drugAllergies: document.getElementById('form-ben-allergies').value,
      medicalDevices: document.getElementById('form-ben-devices').value,
      hospitalRef: document.getElementById('form-ben-hospital').value,
      caregiverName: document.getElementById('form-ben-caregiver-name').value,
      caregiverPhone: document.getElementById('form-ben-caregiver-phone').value
    };

    try {
      await apiService.saveBeneficiary(data);
      alert("บันทึกข้อมูลผู้พิการ/กลุ่มเปราะบางเรียบร้อยแล้ว");
      this.closeModal('modal-beneficiary');
      await this.renderBeneficiaries();
    } catch (err) {
      alert("บันทึกไม่สำเร็จ: " + err.message);
    }
  },

  // ----------------------------------------------------
  // 3. HOME VISITS CONTROLLER
  // ----------------------------------------------------
  async openVisitModal(beneficiaryId) {
    const ben = await apiService.getBeneficiaryById(beneficiaryId);
    if (!ben) return;

    document.getElementById('form-visit').reset();
    document.getElementById('visit-ben-id').value = ben.id;
    document.getElementById('modal-visit-patient-name').textContent = `${ben.prefix}${ben.firstName} ${ben.lastName} (${ben.vulnerabilityType})`;
    document.getElementById('visit-date').value = new Date().toISOString().split('T')[0];

    this.openModal('modal-visit');
  },

  async handleSaveVisit(e) {
    e.preventDefault();
    const benId = document.getElementById('visit-ben-id').value;
    const ben = await apiService.getBeneficiaryById(benId);

    const logData = {
      beneficiaryId: benId,
      communityId: ben.communityId,
      visitDate: document.getElementById('visit-date').value,
      healthStatus: document.getElementById('visit-vitals').value,
      livingCondition: document.getElementById('visit-condition').value,
      notes: document.getElementById('visit-notes').value,
      photoUrl: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=300&auto=format&fit=crop&q=60"
    };

    try {
      await apiService.saveVisitLog(logData);
      alert("บันทึกประวัติการเยี่ยมบ้านเรียบร้อยแล้ว");
      this.closeModal('modal-visit');
    } catch (err) {
      alert("บันทึกไม่สำเร็จ: " + err.message);
    }
  },

  // ----------------------------------------------------
  // 4. WELFARE CONTROLLER
  // ----------------------------------------------------
  async renderWelfare() {
    const user = apiService.getCurrentUser();
    const records = await apiService.getWelfareRecords(null, this.currentCommunityFilter);
    const container = document.getElementById('welfare-list');
    if (!container) return;

    let filtered = records;
    if (this.currentWelfareFilter !== 'all') {
      filtered = filtered.filter(r => r.status === this.currentWelfareFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white p-8 rounded-xl text-center text-slate-400 border border-slate-200">
          <i class="fa-solid fa-gift text-4xl mb-2 text-slate-300"></i>
          <p>ไม่มีรายการคำร้องสวัสดิการในหมวดนี้</p>
        </div>
      `;
      return;
    }

    const beneficiaries = await apiService.getBeneficiaries();

    container.innerHTML = filtered.map(item => {
      const ben = beneficiaries.find(b => b.id === item.beneficiaryId);
      const benName = ben ? `${ben.prefix}${ben.firstName} ${ben.lastName}` : item.beneficiaryId;
      const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === item.communityId)?.name || item.communityId;

      let statusBadge = '';
      if (item.status === 'requested') {
        statusBadge = '<span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">รอตรวจสอบ/อนุมัติ</span>';
      } else if (item.status === 'approved') {
        statusBadge = '<span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold">อนุมัติแล้ว (รอส่งมอบ)</span>';
      } else if (item.status === 'delivered') {
        statusBadge = '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">ส่งมอบเรียบร้อย</span>';
      }

      // Action for officer only
      let officerActions = '';
      if (user.role !== 'committee') {
        if (item.status === 'requested') {
          officerActions = `
            <button onclick="app.handleUpdateWelfareStatus('${item.id}', 'approved')" class="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded text-xs font-semibold">
              อนุมัติคำร้อง
            </button>
          `;
        } else if (item.status === 'approved') {
          officerActions = `
            <button onclick="app.handleUpdateWelfareStatus('${item.id}', 'delivered')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-xs font-semibold">
              บันทึกการส่งมอบแล้ว
            </button>
          `;
        }
      }

      return `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2 text-xs">
          <div class="flex items-start justify-between">
            <div>
              <span class="text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded">${comName}</span>
              <h4 class="font-bold text-slate-800 text-sm mt-1">${item.itemDetail}</h4>
              <p class="text-slate-500 text-xs">ลูกบ้าน: <strong class="text-slate-700">${benName}</strong></p>
            </div>
            ${statusBadge}
          </div>

          <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div><strong>ผู้ส่งคำร้อง:</strong> ${item.requestedBy || '-'} (วันที่ ${item.requestDate})</div>
            <div><strong>จำนวน/งบประมาณ:</strong> ${item.amount || '-'}</div>
            <div><strong>เหตุผลความจำเป็น:</strong> ${item.notes || '-'}</div>
            ${item.deliveryDate ? `<div class="text-emerald-700 font-semibold"><strong>วันที่ส่งมอบ:</strong> ${item.deliveryDate}</div>` : ''}
          </div>

          ${officerActions ? `<div class="pt-2 flex justify-end space-x-2 border-t border-slate-100">${officerActions}</div>` : ''}
        </div>
      `;
    }).join('');
  },

  filterWelfareStatus(status) {
    this.currentWelfareFilter = status;
    document.querySelectorAll('.welfare-status-btn').forEach(btn => {
      if (btn.getAttribute('data-welfare-status') === status) {
        btn.className = "welfare-status-btn active-welfare-btn px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800";
      } else {
        btn.className = "welfare-status-btn px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200";
      }
    });
    this.renderWelfare();
  },

  async openNewWelfareModal() {
    const beneficiaries = await apiService.getBeneficiaries();
    const select = document.getElementById('welfare-ben-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกลูกบ้าน --</option>';
    beneficiaries.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.prefix}${b.firstName} ${b.lastName} (${b.vulnerabilityType})`;
      select.appendChild(opt);
    });

    document.getElementById('form-welfare').reset();
    this.openModal('modal-welfare');
  },

  openWelfareModalFor(beneficiaryId) {
    this.openNewWelfareModal();
    setTimeout(() => {
      const select = document.getElementById('welfare-ben-select');
      if (select) select.value = beneficiaryId;
    }, 50);
  },

  async handleSaveWelfare(e) {
    e.preventDefault();
    const benId = document.getElementById('welfare-ben-select').value;
    const ben = await apiService.getBeneficiaryById(benId);
    if (!ben) return;

    const recordData = {
      beneficiaryId: benId,
      communityId: ben.communityId,
      requestType: document.getElementById('welfare-type-select').value,
      itemDetail: document.getElementById('welfare-item-detail').value,
      amount: "1 ชุด / ตามสิทธิ",
      notes: document.getElementById('welfare-notes').value,
      status: "requested"
    };

    try {
      await apiService.saveWelfareRecord(recordData);
      alert("ยื่นคำร้องขอสวัสดิการเรียบร้อยแล้ว กองสวัสดิการสังคมจะดำเนินการตรวจสอบต่อไป");
      this.closeModal('modal-welfare');
      await this.renderWelfare();
    } catch (err) {
      alert("ยื่นคำร้องไม่สำเร็จ: " + err.message);
    }
  },

  async handleUpdateWelfareStatus(recordId, status) {
    try {
      const deliveryDate = status === 'delivered' ? new Date().toISOString().split('T')[0] : null;
      await apiService.updateWelfareStatus(recordId, status, deliveryDate);
      alert("ปรับปรุงสถานะคำร้องเรียบร้อยแล้ว");
      await this.renderWelfare();
    } catch (err) {
      alert("ดำเนินการไม่สำเร็จ: " + err.message);
    }
  },

  // ----------------------------------------------------
  // 5. DISASTER & EMS CONTROLLER (พร้อมแผนที่ Leaflet)
  // ----------------------------------------------------
  async renderDisaster() {
    await this.initLeafletMap();
    await this.renderDisasterChecklist();
  },

  async initLeafletMap() {
    const mapDiv = document.getElementById('gis-map');
    if (!mapDiv) return;

    // สร้าง Disaster Map instance ครั้งแรก
    if (!this.disasterMap) {
      this.disasterMap = L.map('gis-map').setView([TMCARE_CONFIG.MAP_CENTER.lat, TMCARE_CONFIG.MAP_CENTER.lng], TMCARE_CONFIG.MAP_CENTER.zoom);
      
      // OpenStreetMap Tiles (ฟรี 100%)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors | TMCare เทศบาลตำบลตันหยงมัส'
      }).addTo(this.disasterMap);

      this.disasterMarkersLayer = L.layerGroup().addTo(this.disasterMap);
    }

    this.disasterMarkersLayer.clearLayers();

    // ดึงรายชื่อกลุ่มเปราะบาง
    const beneficiaries = await apiService.getBeneficiaries();

    beneficiaries.forEach(b => {
      if (!b.lat || !b.lng) return;

      let pinClass = 'pin-green';
      let iconClass = 'fa-solid fa-person-walking';
      let pulseHtml = '';

      if (b.triageLevel === 'red') {
        pinClass = 'pin-red';
        iconClass = 'fa-solid fa-bed-pulse';
        pulseHtml = '<div class="pin-pulse-red"></div>';
      } else if (b.triageLevel === 'yellow') {
        pinClass = 'pin-yellow';
        iconClass = 'fa-solid fa-wheelchair';
      }

      const iconHtml = `
        <div class="map-pin-marker">
          <div class="map-pin-body ${pinClass}">
            <i class="${iconClass}"></i>
          </div>
          ${pulseHtml}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-div-icon',
        html: iconHtml,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
        popupAnchor: [0, -40]
      });

      L.marker([b.lat, b.lng], { icon: customIcon })
        .bindPopup(this.createMapPopupContent(b), { maxWidth: 300, minWidth: 260 })
        .addTo(this.disasterMarkersLayer);
    });

    // Fit Bounds หากมีหมุด
    setTimeout(() => {
      if (this.disasterMap) this.disasterMap.invalidateSize();
    }, 200);
  },

  // สร้าง Card Popup บนแผนที่ สวยงาม สีเดียวชัดเจน และเป็นระเบียบ
  createMapPopupContent(b) {
    const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === b.communityId)?.name || b.communityId;
    
    let headerBgColor = 'bg-emerald-600';
    let triageIcon = 'fa-solid fa-person-walking';
    let triageBadge = '🟢 ติดสังคม';
    let triagePillClass = 'bg-emerald-800/90 text-white';

    if (b.triageLevel === 'red') {
      headerBgColor = 'bg-red-600';
      triageIcon = 'fa-solid fa-bed-pulse';
      triageBadge = '🔴 ติดเตียง/วิกฤต';
      triagePillClass = 'bg-red-800/90 text-white';
    } else if (b.triageLevel === 'yellow') {
      headerBgColor = 'bg-amber-500';
      triageIcon = 'fa-solid fa-wheelchair';
      triageBadge = '🟡 ติดบ้าน';
      triagePillClass = 'bg-amber-700/90 text-white';
    }

    return `
      <div class="custom-map-popup bg-white text-slate-800 font-sans">
        <!-- Solid Color Header based on Triage Level -->
        <div class="p-3 ${headerBgColor} text-white flex items-center justify-between pr-8">
          <div class="flex items-center space-x-2 truncate">
            <div class="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0">
              <i class="${triageIcon} text-xs"></i>
            </div>
            <div class="truncate">
              <h4 class="font-bold text-sm leading-tight text-white truncate">${b.prefix}${b.firstName} ${b.lastName}</h4>
              <div class="text-[10px] text-white/90 font-medium">📍 ${comName}</div>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${triagePillClass} shrink-0 ml-1">
            ${triageBadge}
          </span>
        </div>

        <!-- Body Content -->
        <div class="p-3 space-y-2 text-xs">
          <!-- Address & Caregiver -->
          <div class="flex items-start space-x-1.5 text-slate-600">
            <i class="fa-solid fa-location-dot text-amber-500 text-xs mt-0.5 shrink-0"></i>
            <span class="text-[11.5px] leading-snug line-clamp-2">${b.address}</span>
          </div>

          <!-- Structured Health Box -->
          <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">ภาวะเปราะบาง:</span>
              <span class="font-semibold text-slate-800 text-right truncate max-w-[150px]">${b.vulnerabilityType}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">โรคประจำตัว:</span>
              <span class="font-semibold text-slate-800 text-right truncate max-w-[150px]">${b.chronicDiseases || '-'}</span>
            </div>
            ${b.medicalDevices && b.medicalDevices !== 'ไม่มี' ? `
            <div class="flex items-center justify-between bg-red-50 -mx-1 px-1.5 py-1 rounded-lg text-red-700 font-semibold border border-red-100">
              <span class="flex items-center space-x-1"><i class="fa-solid fa-plug text-red-500"></i><span>อุปกรณ์พยุงชีพ:</span></span>
              <span class="truncate max-w-[130px] font-bold text-red-800">${b.medicalDevices}</span>
            </div>` : ''}
            <div class="flex items-center justify-between pt-0.5 border-t border-slate-200/50">
              <span class="text-slate-500">ผู้ดูแล:</span>
              <span class="text-slate-700 font-medium">${b.caregiverName || '-'}</span>
            </div>
            ${b.caregiverPhone ? `
            <div class="flex items-center justify-between">
              <span class="text-slate-500">โทรผู้ดูแล:</span>
              <a href="tel:${b.caregiverPhone}" class="text-rose-600 font-bold underline"><i class="fa-solid fa-phone text-[10px] mr-1"></i>${b.caregiverPhone}</a>
            </div>` : ''}
          </div>

          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
            <button onclick="app.openEmsCard('${b.id}')" class="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-2 rounded-xl text-[11px] flex items-center justify-center space-x-1 shadow-sm transition active:scale-95">
              <i class="fa-solid fa-notes-medical"></i>
              <span>บัตรฉุกเฉิน</span>
            </button>
            <button onclick="app.copyLineSos('${b.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-2 rounded-xl text-[11px] flex items-center justify-center space-x-1 shadow-sm transition active:scale-95">
              <i class="fa-brands fa-line text-xs"></i>
              <span>ส่ง LINE กู้ภัย</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  toggleDisasterGuide() {
    const box = document.getElementById('disaster-guide-box');
    const icon = document.getElementById('disaster-guide-icon');
    if (box) {
      const isHidden = box.classList.toggle('hidden');
      if (icon) {
        icon.className = isHidden 
          ? "fa-solid fa-chevron-down text-[10px] ml-1 transition-transform" 
          : "fa-solid fa-chevron-up text-[10px] ml-1 transition-transform";
      }
    }
  },

  resetDisasterMapCenter() {
    if (this.disasterMap) {
      this.disasterMap.setView([TMCARE_CONFIG.MAP_CENTER.lat, TMCARE_CONFIG.MAP_CENTER.lng], TMCARE_CONFIG.MAP_CENTER.zoom);
    }
  },

  filterDisasterEvac(status) {
    this.currentEvacFilter = status;
    document.querySelectorAll('.disaster-evac-pill').forEach(btn => {
      if (btn.getAttribute('data-evac-filter') === status) {
        btn.classList.add('ring-2', 'ring-rose-500', 'font-bold', 'bg-white');
      } else {
        btn.classList.remove('ring-2', 'ring-rose-500', 'font-bold', 'bg-white');
      }
    });
    this.renderDisasterChecklist();
  },

  async renderDisasterChecklist() {
    const beneficiaries = await apiService.getBeneficiaries();
    const statuses = await apiService.getDisasterStatuses();
    const tbody = document.getElementById('table-disaster-checklist');
    const mobileContainer = document.getElementById('mobile-disaster-checklist-cards');

    // จัดเรียงลำดับความสำคัญ: 🔴 สีแดง (ติดเตียง/พึ่งพิง 100%) ขึ้นก่อนอันดับ 1
    const priorityOrder = { red: 1, yellow: 2, green: 3 };
    beneficiaries.sort((a, b) => (priorityOrder[a.triageLevel] || 99) - (priorityOrder[b.triageLevel] || 99));

    // นับจำนวนสถิติสถานะอพยพ Real-time
    let countTotal = beneficiaries.length;
    let countNeedHelp = 0;
    let countSafe = 0;
    let countEvacuated = 0;

    beneficiaries.forEach(b => {
      const st = statuses.find(s => s.beneficiaryId === b.id);
      const ev = st ? st.evacStatus : 'safe_at_home';
      if (ev === 'need_help') countNeedHelp++;
      else if (ev === 'evacuated') countEvacuated++;
      else countSafe++;
    });

    const elTotal = document.getElementById('evac-count-total');
    const elNeed = document.getElementById('evac-count-needhelp');
    const elSafe = document.getElementById('evac-count-safe');
    const elEvac = document.getElementById('evac-count-evacuated');

    if (elTotal) elTotal.textContent = `${countTotal} ราย`;
    if (elNeed) elNeed.textContent = `${countNeedHelp} ราย`;
    if (elSafe) elSafe.textContent = `${countSafe} ราย`;
    if (elEvac) elEvac.textContent = `${countEvacuated} ราย`;

    // กรองตามปุ่มที่เลือก (ถ้าเลือก filter)
    let displayList = beneficiaries;
    if (this.currentEvacFilter && this.currentEvacFilter !== 'all') {
      displayList = beneficiaries.filter(b => {
        const st = statuses.find(s => s.beneficiaryId === b.id);
        const ev = st ? st.evacStatus : 'safe_at_home';
        return ev === this.currentEvacFilter;
      });
    }

    // Render Desktop Table
    if (tbody) {
      tbody.innerHTML = '';
      if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">ไม่พบรายชื่อในหมวดนี้</td></tr>`;
      } else {
        displayList.forEach(b => {
          const statusItem = statuses.find(s => s.beneficiaryId === b.id) || {
            evacStatus: 'safe_at_home',
            needsDetail: '-',
            shelterName: '-'
          };

          const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === b.communityId)?.name || b.communityId;
          const triageBadge = b.triageLevel === 'red' ? '🔴 สีแดง (ติดเตียง)' : (b.triageLevel === 'yellow' ? '🟡 สีเหลือง' : '🟢 สีเขียว');
          const triageColor = b.triageLevel === 'red' ? 'text-red-600 font-bold' : (b.triageLevel === 'yellow' ? 'text-amber-600' : 'text-emerald-600');

          let evacLabel = '';
          if (statusItem.evacStatus === 'safe_at_home') {
            evacLabel = '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">🏠 ปลอดภัยอยู่ที่บ้าน</span>';
          } else if (statusItem.evacStatus === 'need_help') {
            evacLabel = '<span class="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px] animate-pulse">⚠️ ต้องการความช่วยเหลือด่วน</span>';
          } else if (statusItem.evacStatus === 'evacuated') {
            evacLabel = '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">✅ อพยพถึงศูนย์แล้ว</span>';
          }

          const tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition";
          tr.innerHTML = `
            <td class="py-2.5 px-3">
              <div class="font-bold text-slate-800">${b.prefix}${b.firstName} ${b.lastName}</div>
              <div class="text-[11px] text-slate-500">${b.address}</div>
            </td>
            <td class="py-2.5 px-2 text-rose-800">${comName}</td>
            <td class="py-2.5 px-2 text-center ${triageColor}">${triageBadge}</td>
            <td class="py-2.5 px-2">${evacLabel}</td>
            <td class="py-2.5 px-2 text-slate-600 max-w-[200px] truncate" title="${statusItem.needsDetail}">
              ${statusItem.needsDetail || '-'}
            </td>
            <td class="py-2.5 px-2 text-center">
              <div class="flex items-center justify-center space-x-1">
                <button onclick="app.quickSetEvac('${b.id}', 'safe_at_home')" title="ปลอดภัยที่บ้าน" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded text-[10px]">
                  🏠 ปลอดภัย
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'need_help')" title="ขอความช่วยเหลือ/เรือ" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold">
                  ⚠️ ขอช่วย
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'evacuated')" title="อพยพแล้ว" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px]">
                  ✅ อพยพแล้ว
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // Render Mobile Cards (Mobile-First Card View)
    if (mobileContainer) {
      if (displayList.length === 0) {
        mobileContainer.innerHTML = `<div class="bg-slate-50 p-6 rounded-xl text-center text-slate-400 text-xs">ไม่พบรายชื่อในหมวดนี้</div>`;
      } else {
        mobileContainer.innerHTML = displayList.map(b => {
          const statusItem = statuses.find(s => s.beneficiaryId === b.id) || {
            evacStatus: 'safe_at_home',
            needsDetail: '-',
            shelterName: '-'
          };

          const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === b.communityId)?.name || b.communityId;
          const triageBadgeClass = b.triageLevel === 'red' ? 'triage-badge-red' : (b.triageLevel === 'yellow' ? 'triage-badge-yellow' : 'triage-badge-green');
          const triageBorderClass = b.triageLevel === 'red' ? 'triage-border-red' : (b.triageLevel === 'yellow' ? 'triage-border-yellow' : 'triage-border-green');
          const triageLabel = b.triageLevel === 'red' ? '🔴 ติดเตียง' : (b.triageLevel === 'yellow' ? '🟡 ติดบ้าน' : '🟢 ติดสังคม');

          let evacLabel = '';
          if (statusItem.evacStatus === 'safe_at_home') {
            evacLabel = '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">🏠 ปลอดภัยอยู่ที่บ้าน</span>';
          } else if (statusItem.evacStatus === 'need_help') {
            evacLabel = '<span class="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[11px] animate-pulse">⚠️ ต้องการความช่วยเหลือ</span>';
          } else if (statusItem.evacStatus === 'evacuated') {
            evacLabel = '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">✅ อพยพถึงศูนย์แล้ว</span>';
          }

          return `
            <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 space-y-2 ${triageBorderClass}">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h4 class="font-bold text-slate-800 text-sm">${b.prefix}${b.firstName} ${b.lastName}</h4>
                  <div class="text-[11px] text-slate-500"><i class="fa-solid fa-location-dot text-amber-500 mr-1"></i>${comName} | ${b.address}</div>
                </div>
                <span class="${triageBadgeClass}">${triageLabel}</span>
              </div>

              <div class="bg-slate-50 p-2 rounded-lg text-[11.5px] space-y-1">
                <div class="text-slate-700"><strong>ภาวะ:</strong> ${b.vulnerabilityType}</div>
                ${b.medicalDevices && b.medicalDevices !== 'ไม่มี' ? `<div class="text-red-700 font-semibold"><i class="fa-solid fa-plug text-red-600 mr-1"></i><strong>อุปกรณ์พยุงชีพ:</strong> ${b.medicalDevices}</div>` : ''}
                ${statusItem.needsDetail && statusItem.needsDetail !== '-' ? `<div class="text-rose-700 font-bold bg-rose-50 p-1.5 rounded border border-rose-200"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${statusItem.needsDetail}</div>` : ''}
                <div class="text-slate-500 flex items-center justify-between pt-0.5">
                  <span>ผู้ดูแล: ${b.caregiverName || '-'}</span>
                  ${b.caregiverPhone ? `<a href="tel:${b.caregiverPhone}" class="text-rose-600 font-bold underline"><i class="fa-solid fa-phone mr-1"></i>โทรหาผู้ดูแล</a>` : ''}
                </div>
              </div>

              <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span class="text-slate-500 text-[11px]">สถานะ:</span>
                ${evacLabel}
              </div>

              <div class="grid grid-cols-3 gap-1.5 pt-1 text-xs">
                <button onclick="app.quickSetEvac('${b.id}', 'safe_at_home')" class="touch-btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-1 rounded-lg text-center flex flex-col items-center">
                  <span class="text-xs">🏠</span>
                  <span class="text-[10px]">ปลอดภัย</span>
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'need_help')" class="touch-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-1 rounded-lg text-center flex flex-col items-center shadow-sm">
                  <span class="text-xs">⚠️</span>
                  <span class="text-[10px]">ขอช่วย/เรือ</span>
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'evacuated')" class="touch-btn bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1.5 px-1 rounded-lg text-center flex flex-col items-center shadow-sm">
                  <span class="text-xs">✅</span>
                  <span class="text-[10px]">อพยพแล้ว</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  async quickSetEvac(beneficiaryId, status) {
    let detail = '';
    if (status === 'need_help') {
      detail = prompt("ระบุสิ่งที่ต้องการช่วยเหลือเร่งด่วน (เช่น ต้องการเรือท้องแบน, ออกซิเจนสำรอง, อาหาร):", "ต้องการเรือและรถพยาบาลเคลื่อนย้ายผู้ป่วยติดเตียง");
      if (detail === null) return;
    } else if (status === 'evacuated') {
      detail = prompt("ระบุสถานที่อพยพไปพักพิง:", "ศูนย์พักพิงชั่วคราว ทต.ตันหยงมัส");
      if (detail === null) return;
    }

    try {
      await apiService.updateDisasterStatus(beneficiaryId, status, detail, status === 'evacuated' ? detail : '-');
      await this.renderDisasterChecklist();
      const stats = await apiService.getDashboardStats();
      const bannerCount = document.getElementById('banner-need-help-count');
      if (bannerCount) bannerCount.textContent = `${stats.needEvacHelp} ราย`;
    } catch (err) {
      alert("อัปเดตไม่สำเร็จ: " + err.message);
    }
  },

  // ----------------------------------------------------
  // 6. EMERGENCY MEDICAL CARD & LINE INTEGRATION
  // ----------------------------------------------------
  async openEmsCard(beneficiaryId) {
    const b = await apiService.getBeneficiaryById(beneficiaryId);
    if (!b) return;

    const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === b.communityId)?.name || b.communityId;
    const triageBadge = b.triageLevel === 'red' ? '🔴 สีแดง (วิกฤต/ติดเตียง)' : (b.triageLevel === 'yellow' ? '🟡 สีเหลือง (ติดบ้าน)' : '🟢 สีเขียว (ติดสังคม)');

    const contentDiv = document.getElementById('ems-card-content');
    contentDiv.innerHTML = `
      <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-rose-800">${comName}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${b.triageLevel === 'red' ? 'triage-badge-red' : 'triage-badge-yellow'}">${triageBadge}</span>
        </div>
        <h4 class="text-base font-bold text-slate-800">${b.prefix}${b.firstName} ${b.lastName} (อายุ ${b.age || '-'} ปี)</h4>
        <div class="text-slate-600"><strong>ที่อยู่:</strong> ${b.address}</div>
        <div class="text-slate-600"><strong>เบอร์โทรลูกบ้าน:</strong> <a href="tel:${b.phone}" class="text-rose-600 font-semibold underline">${b.phone || '-'}</a></div>
      </div>

      <div class="bg-red-50 p-3 rounded-xl border border-red-200 text-red-950 space-y-1">
        <div><strong>🚨 โรคประจำตัว:</strong> ${b.chronicDiseases || '-'}</div>
        <div><strong>⚠️ ประวัติแพ้ยา:</strong> <span class="font-bold underline text-red-700">${b.drugAllergies || 'ไม่มีข้อมูล'}</span></div>
        <div><strong>⚡ อุปกรณ์พยุงชีพ:</strong> <span class="font-bold text-red-700">${b.medicalDevices || 'ไม่มี'}</span></div>
        <div><strong>🏥 โรงพยาบาลประจำ:</strong> ${b.hospitalRef || 'รพ.ระแงะ'}</div>
      </div>

      <div class="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-950 space-y-1">
        <div><strong>ผู้ดูแลหลัก (Caregiver):</strong> ${b.caregiverName || '-'}</div>
        <div><strong>เบอร์โทรผู้ดูแล:</strong> <a href="tel:${b.caregiverPhone}" class="text-rose-700 font-bold underline">${b.caregiverPhone || '-'}</a></div>
      </div>

      <div class="text-[11px] text-slate-400">
        พิกัด GPS: ${b.lat}, ${b.lng}
      </div>
    `;

    // ปุ่มคัดลอกส่ง LINE
    const copyBtn = document.getElementById('btn-copy-ems-line');
    copyBtn.onclick = () => this.copyLineSos(beneficiaryId);

    this.openModal('modal-ems-card');
  },

  async copyLineSos(beneficiaryId) {
    const b = await apiService.getBeneficiaryById(beneficiaryId);
    if (!b) return;

    const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === b.communityId)?.name || b.communityId;
    const mapLink = `https://maps.google.com/?q=${b.lat},${b.lng}`;

    const textToCopy = `🚨 [แจ้งเหตุกู้ชีพ-กู้ภัย ทต.ตันหยงมัส]
👤 ผู้ป่วย: ${b.prefix}${b.firstName} ${b.lastName}
📍 ชุมชน: ${comName}
🏠 ที่อยู่: ${b.address}
🔴 ระดับ Triage: ${b.triageLevel === 'red' ? 'สีแดง (ติดเตียง/วิกฤต)' : 'สีเหลือง'}
⚠️ ภาวะ/โรคประจำตัว: ${b.chronicDiseases || '-'}
⚡ อุปกรณ์พยุงชีพ: ${b.medicalDevices || 'ไม่มี'}
🚫 ประวัติแพ้ยา: ${b.drugAllergies || 'ไม่มี'}
📞 เบอร์ผู้ดูแล: ${b.caregiverPhone || b.phone || '-'} (${b.caregiverName || 'ญาติ'})
🗺️ พิกัดนำทาง Google Maps:
${mapLink}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        alert("คัดลอกข้อมูลฉุกเฉินและพิกัด Google Maps เรียบร้อยแล้ว! สามารถนำไปวาง (Paste) ในกลุ่ม LINE กู้ชีพหรือศูนย์บรรเทาสาธารณภัยได้ทันที");
      });
    } else {
      prompt("คัดลอกข้อความด้านล่างนี้:", textToCopy);
    }
  },

  // ----------------------------------------------------
  // 7. SETTINGS MODAL
  // ----------------------------------------------------
  openSettingsModal() {
    const provider = apiService.getProvider();
    const gasUrl = localStorage.getItem('tmcare_gas_url') || '';
    const supaUrl = localStorage.getItem('tmcare_supabase_url') || '';
    const supaKey = localStorage.getItem('tmcare_supabase_key') || '';

    document.getElementById('settings-provider').value = provider;
    document.getElementById('settings-gas-url').value = gasUrl;
    document.getElementById('settings-supa-url').value = supaUrl;
    document.getElementById('settings-supa-key').value = supaKey;

    this.toggleSettingsFields(provider);
    this.openModal('modal-settings');
  },

  toggleSettingsFields(provider) {
    const gasBox = document.getElementById('settings-gas-box');
    const supaBox = document.getElementById('settings-supabase-box');

    if (provider === 'GAS') {
      gasBox.classList.remove('hidden');
      supaBox.classList.add('hidden');
    } else if (provider === 'SUPABASE') {
      gasBox.classList.add('hidden');
      supaBox.classList.remove('hidden');
    } else {
      gasBox.classList.add('hidden');
      supaBox.classList.add('hidden');
    }
  },

  handleSaveSettings(e) {
    e.preventDefault();
    const provider = document.getElementById('settings-provider').value;
    const gasUrl = document.getElementById('settings-gas-url').value.trim();
    const supaUrl = document.getElementById('settings-supa-url').value.trim();
    const supaKey = document.getElementById('settings-supa-key').value.trim();

    localStorage.setItem('tmcare_provider', provider);
    localStorage.setItem('tmcare_gas_url', gasUrl);
    localStorage.setItem('tmcare_supabase_url', supaUrl);
    localStorage.setItem('tmcare_supabase_key', supaKey);

    alert("บันทึกการตั้งค่าเรียบร้อยแล้ว ระบบจะทำการรีโหลดหน้าเว็บ");
    window.location.reload();
  },

  async testGasConnection() {
    const input = document.getElementById('settings-gas-url');
    const resultBox = document.getElementById('gas-test-result');
    const testBtn = document.getElementById('btn-test-gas');
    const url = (input ? input.value : '').trim();

    if (!url) {
      if (resultBox) {
        resultBox.className = "text-xs p-2.5 rounded-lg border bg-amber-50 border-amber-200 text-amber-800";
        resultBox.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1 text-amber-600"></i> กรุณากรอก Web App URL ก่อนทดสอบ';
        resultBox.classList.remove('hidden');
      }
      return;
    }

    if (testBtn) {
      testBtn.disabled = true;
      testBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังทดสอบ...';
    }
    if (resultBox) {
      resultBox.className = "text-xs p-2.5 rounded-lg border bg-slate-50 border-slate-200 text-slate-700";
      resultBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1 text-rose-600"></i> กำลังส่งคำขอทดสอบไปยัง Google Apps Script...';
      resultBox.classList.remove('hidden');
    }

    try {
      const res = await gasDriver.testConnection(url);
      if (res && res.success) {
        resultBox.className = "text-xs p-2.5 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-800";
        resultBox.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i> <strong>เชื่อมต่อสำเร็จ!</strong> ฐานข้อมูล: ${res.appName || 'TMCare GAS'} (ความเร็วตอบกลับ ${res.latencyMs || '-'} ms)`;
      } else {
        resultBox.className = "text-xs p-2.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-800";
        resultBox.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1 text-rose-600"></i> <strong>เชื่อมต่อไม่สำเร็จ:</strong> ${res ? (res.error || res.message) : 'ไม่สามารถเข้าถึง URL ได้'}<br><span class="text-[11px] text-rose-600 mt-1 block font-normal">คำแนะนำ: ตรวจสอบว่าในขั้นตอน Deploy ได้เลือก "Execute as: Me" และ "Who has access: Anyone" แล้วหรือไม่</span>`;
      }
    } catch (err) {
      resultBox.className = "text-xs p-2.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-800";
      resultBox.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1 text-rose-600"></i> <strong>เกิดข้อผิดพลาด:</strong> ${err.message || err}`;
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fa-solid fa-plug"></i> ทดสอบเชื่อมต่อ';
      }
    }
  },

  async clearCacheAndSync() {
    if (confirm("ต้องการล้างข้อมูลแคชในเบราว์เซอร์ และดึงข้อมูลใหม่ล่าสุดจาก Google Sheets หรือไม่?")) {
      try {
        await apiService.clearCacheAndSync();
        alert("ล้างแคชและเตรียมพร้อมซิงค์ข้อมูลใหม่เรียบร้อยแล้ว");
        window.location.reload();
      } catch (err) {
        alert("การซิงค์ข้อมูลขัดข้อง: " + err.message);
      }
    }
  },

  // ----------------------------------------------------
  // 8. PRINT REPORT CONTROLLER (A4 LANDSCAPE)
  // ----------------------------------------------------
  async preparePrintData() {
    const container = document.getElementById('print-report-container');
    if (!container) return;

    try {
      const user = apiService.getCurrentUser();
      const userLabel = user 
        ? `${user.fullName} (${user.role === 'committee' ? 'คณะกรรมการชุมชน' : (user.role === 'officer' ? 'เจ้าหน้าที่กองสวัสดิการสังคม' : 'ผู้บริหาร')})`
        : 'เจ้าหน้าที่ผู้รับผิดชอบ';

      const now = new Date();
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const day = now.getDate();
      const month = thaiMonths[now.getMonth()];
      const year = now.getFullYear() + 543;
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const dateStr = `วันที่ ${day} ${month} พ.ศ. ${year} เวลา ${hours}:${minutes} น.`;

      let scopeLabel = 'ทั้ง 7 ชุมชนในเขตเทศบาลตำบลตันหยงมัส';
      if (this.currentCommunityFilter) {
        const c = TMCARE_CONFIG.COMMUNITIES.find(item => item.id === this.currentCommunityFilter);
        if (c) scopeLabel = `เฉพาะ: ${c.name} (${c.id})`;
      } else if (user && user.role === 'committee') {
        scopeLabel = `เฉพาะ: ${user.communityName} (${user.communityId})`;
      }

      const stats = await apiService.getDashboardStats(this.currentCommunityFilter);
      let beneficiaries = await apiService.getBeneficiaries(this.currentCommunityFilter);

      // เรียงลำดับ: สีแดง -> สีเหลือง -> สีเขียว, จากนั้นตามชุมชนและชื่อ
      const triageOrder = { 'red': 1, 'yellow': 2, 'green': 3 };
      beneficiaries.sort((a, b) => {
        const orderA = triageOrder[a.triageLevel] || 99;
        const orderB = triageOrder[b.triageLevel] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.communityId || '').localeCompare(b.communityId || '') || (a.firstName || '').localeCompare(b.firstName || '');
      });

      const redPct = stats.total > 0 ? Math.round((stats.red / stats.total) * 100) : 0;
      const yellowPct = stats.total > 0 ? Math.round((stats.yellow / stats.total) * 100) : 0;
      const greenPct = stats.total > 0 ? Math.round((stats.green / stats.total) * 100) : 0;
      const totalGender = (stats.gender?.male || 0) + (stats.gender?.female || 0) || 1;
      const malePct = Math.round(((stats.gender?.male || 0) / totalGender) * 100);
      const femalePct = 100 - malePct;

      container.innerHTML = `
        <!-- ================= SHEET 1: สรุปภาพรวมและสถิติเชิงลึกทั้งหมด ================= -->
        <div class="print-page print-page-1" style="background:#ffffff; color:#0f172a; padding: 0 4px;">
          <!-- 1. ส่วนหัวรายงานทางการ -->
          <div style="border-bottom: 2px solid #e11d48; padding-bottom: 5px; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <!-- ด้านซ้าย: ตราและหน่วยงาน -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 36px; height: 36px; background: #e11d48; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">
                  <i class="fa-solid fa-hand-holding-heart"></i>
                </div>
                <div>
                  <div style="font-size: 12pt; font-weight: 700; color: #be123c; line-height: 1.2;">เทศบาลตำบลตันหยงมัส</div>
                  <div style="font-size: 7.5pt; color: #64748b;">อำเภอระแงะ จังหวัดนราธิวาส • กองสวัสดิการสังคม</div>
                </div>
              </div>

              <!-- ตรงกลาง: ชื่อรายงาน -->
              <div style="text-align: center;">
                <div style="font-size: 12pt; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">
                  รายงานสรุปสถานการณ์และสถิติข้อมูลผู้พิการและกลุ่มเปราะบาง (TMCare)
                </div>
                <div style="font-size: 8pt; color: #475569; margin-top: 1px;">
                  <strong>ขอบเขตข้อมูล:</strong> ${scopeLabel}
                </div>
              </div>

              <!-- ด้านขวา: ข้อมูลกำกับเอกสาร -->
              <div style="text-align: right; font-size: 7.5pt; color: #475569; line-height: 1.35;">
                <div><strong>วันที่ออกรายงาน:</strong> ${dateStr}</div>
                <div><strong>ผู้จัดพิมพ์:</strong> ${userLabel}</div>
                <div><strong>ระบบ:</strong> TMCare (${apiService.getProvider()})</div>
              </div>
            </div>
          </div>

          <!-- 2. แถวการ์ดสรุปตัวเลขหลัก 6 การ์ด -->
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin-bottom: 6px;">
            <div style="border: 1px solid #cbd5e1; border-top: 3px solid #e11d48; border-radius: 6px; padding: 5px 6px; background: #f8fafc; text-align: center;">
              <div style="font-size: 7pt; color: #64748b; font-weight: 600;">ผู้พิการ/เปราะบางทั้งหมด</div>
              <div style="font-size: 14pt; font-weight: 800; color: #e11d48; line-height: 1.2; margin: 1px 0;">${stats.total} <span style="font-size: 7.5pt; font-weight: normal; color: #64748b;">ราย</span></div>
              <div style="font-size: 6.5pt; color: #64748b;">ในฐานข้อมูลระบบ</div>
            </div>

            <div style="border: 1px solid #fecaca; border-top: 3px solid #ef4444; border-radius: 6px; padding: 5px 6px; background: #fff5f5; text-align: center;">
              <div style="font-size: 7pt; color: #991b1b; font-weight: 700;">🔴 สีแดง (ติดเตียง)</div>
              <div style="font-size: 14pt; font-weight: 800; color: #ef4444; line-height: 1.2; margin: 1px 0;">${stats.red} <span style="font-size: 7.5pt; font-weight: normal; color: #991b1b;">ราย (${redPct}%)</span></div>
              <div style="font-size: 6.5pt; color: #b91c1c;">ADL 0-4 ช่วยตนเองไม่ได้</div>
            </div>

            <div style="border: 1px solid #fde68a; border-top: 3px solid #f59e0b; border-radius: 6px; padding: 5px 6px; background: #fffbeb; text-align: center;">
              <div style="font-size: 7pt; color: #92400e; font-weight: 700;">🟡 สีเหลือง (ติดบ้าน)</div>
              <div style="font-size: 14pt; font-weight: 800; color: #f59e0b; line-height: 1.2; margin: 1px 0;">${stats.yellow} <span style="font-size: 7.5pt; font-weight: normal; color: #92400e;">ราย (${yellowPct}%)</span></div>
              <div style="font-size: 6.5pt; color: #b45309;">ADL 5-11 พึ่งพิงปานกลาง</div>
            </div>

            <div style="border: 1px solid #a7f3d0; border-top: 3px solid #10b981; border-radius: 6px; padding: 5px 6px; background: #f0fdf4; text-align: center;">
              <div style="font-size: 7pt; color: #065f46; font-weight: 700;">🟢 สีเขียว (ติดสังคม)</div>
              <div style="font-size: 14pt; font-weight: 800; color: #10b981; line-height: 1.2; margin: 1px 0;">${stats.green} <span style="font-size: 7.5pt; font-weight: normal; color: #065f46;">ราย (${greenPct}%)</span></div>
              <div style="font-size: 6.5pt; color: #047857;">ADL 12-20 ช่วยตนเองได้ดี</div>
            </div>

            <div style="border: 1px solid #fed7aa; border-top: 3px solid #f97316; border-radius: 6px; padding: 5px 6px; background: #fff7ed; text-align: center;">
              <div style="font-size: 7pt; color: #9a3412; font-weight: 700;">🚨 ต้องอพยพเร่งด่วน</div>
              <div style="font-size: 14pt; font-weight: 800; color: #ea580c; line-height: 1.2; margin: 1px 0;">${stats.needEvacHelp} <span style="font-size: 7.5pt; font-weight: normal; color: #9a3412;">ราย</span></div>
              <div style="font-size: 6.5pt; color: #c2410c;">ภาวะภัยพิบัติ/ฉุกเฉิน</div>
            </div>

            <div style="border: 1px solid #e9d5ff; border-top: 3px solid #8b5cf6; border-radius: 6px; padding: 5px 6px; background: #faf5ff; text-align: center;">
              <div style="font-size: 7pt; color: #6b21a8; font-weight: 700;">📦 คำร้องสวัสดิการค้าง</div>
              <div style="font-size: 14pt; font-weight: 800; color: #8b5cf6; line-height: 1.2; margin: 1px 0;">${stats.pendingRequests} <span style="font-size: 7.5pt; font-weight: normal; color: #6b21a8;">รายการ</span></div>
              <div style="font-size: 6.5pt; color: #7e22ce;">รอพิจารณาจัดสรร</div>
            </div>
          </div>

          <!-- 3. ส่วนข้อมูลกลาง 2 คอลัมน์ (ตารางชุมชน + สถิติประชากรและความจำเป็น) -->
          <div style="display: grid; grid-template-columns: 57% 41.5%; gap: 1.5%; flex: 1; align-items: stretch;">
            <!-- ฝั่งซ้าย: ตารางสรุป 7 ชุมชน -->
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 7px; background: #ffffff; display: flex; flex-direction: column;">
              <div style="font-size: 8pt; font-weight: 700; color: #1e293b; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-city" style="color:#e11d48; margin-right: 3px;"></i>สรุปสถานการณ์จำแนกตามชุมชน ทต.ตันหยงมัส</span>
                <span style="font-size: 6.5pt; color: #64748b; font-weight: normal;">รวมทั้งหมด ${stats.communityBreakdown.length} ชุมชน</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 7pt; flex: 1;">
                <thead>
                  <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 3px 4px; text-align: left; border: 1px solid #cbd5e1;">ชื่อชุมชน</th>
                    <th style="padding: 3px; text-align: center; border: 1px solid #cbd5e1; color: #b91c1c;">🔴 แดง (ติดเตียง)</th>
                    <th style="padding: 3px; text-align: center; border: 1px solid #cbd5e1; color: #b45309;">🟡 เหลือง</th>
                    <th style="padding: 3px; text-align: center; border: 1px solid #cbd5e1; color: #047857;">🟢 เขียว</th>
                    <th style="padding: 3px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">รวม (ราย)</th>
                    <th style="padding: 3px; text-align: center; border: 1px solid #cbd5e1;">สัดส่วน</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.communityBreakdown.map(c => {
                    const pct = stats.total > 0 ? Math.round((c.total / stats.total) * 100) : 0;
                    return `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 2.5px 4px; border: 1px solid #cbd5e1; font-weight: 500;">${c.name}</td>
                        <td style="padding: 2.5px 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b91c1c;">${c.red}</td>
                        <td style="padding: 2.5px 3px; border: 1px solid #cbd5e1; text-align: center; color: #b45309;">${c.yellow}</td>
                        <td style="padding: 2.5px 3px; border: 1px solid #cbd5e1; text-align: center; color: #047857;">${c.green}</td>
                        <td style="padding: 2.5px 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0f172a;">${c.total}</td>
                        <td style="padding: 2.5px 3px; border: 1px solid #cbd5e1; text-align: center; color: #64748b;">${pct}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: #e2e8f0; font-weight: bold; border-top: 2px solid #94a3b8;">
                    <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: right;">รวมทั้งสิ้น:</td>
                    <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: center; color: #b91c1c;">${stats.red}</td>
                    <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: center; color: #b45309;">${stats.yellow}</td>
                    <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: center; color: #047857;">${stats.green}</td>
                    <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #e11d48;">${stats.total}</td>
                    <td style="padding: 3px; border: 1px solid #cbd5e1; text-align: center;">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- ฝั่งขวา: 3 กล่องย่อย (เพศ, อายุ, อุปกรณ์จำเป็น) -->
            <div style="display: flex; flex-direction: column; gap: 5px;">
              <!-- 1. เพศ -->
              <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 7px; background: #ffffff;">
                <div style="font-size: 7.5pt; font-weight: 700; color: #1e293b; margin-bottom: 3px; display: flex; justify-content: space-between;">
                  <span><i class="fa-solid fa-venus-mars" style="color:#e11d48; margin-right: 3px;"></i>สัดส่วนเพศ</span>
                  <span style="font-size: 7pt; color: #64748b;">ชาย ${stats.gender?.male || 0} ราย (${malePct}%) | หญิง ${stats.gender?.female || 0} ราย (${femalePct}%)</span>
                </div>
                <div style="height: 8px; background: #fecdd3; border-radius: 9999px; overflow: hidden; display: flex; border: 1px solid #cbd5e1;">
                  <div style="width: ${malePct}%; background: #0284c7;"></div>
                  <div style="width: ${femalePct}%; background: #f43f5e;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 6.5pt; color: #64748b; margin-top: 2px;">
                  <span style="color:#0284c7; font-weight: 600;">■ ชาย ${stats.gender?.male || 0} ราย (${malePct}%)</span>
                  <span style="color:#f43f5e; font-weight: 600;">■ หญิง ${stats.gender?.female || 0} ราย (${femalePct}%)</span>
                </div>
              </div>

              <!-- 2. ช่วงอายุ -->
              <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 7px; background: #ffffff;">
                <div style="font-size: 7.5pt; font-weight: 700; color: #1e293b; margin-bottom: 3px;">
                  <i class="fa-solid fa-users" style="color:#e11d48; margin-right: 3px;"></i>จำแนกตามกลุ่มช่วงอายุ
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; text-align: center;">
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 2px;">
                    <div style="font-size: 6pt; color: #64748b;">เด็ก (&lt;18 ปี)</div>
                    <div style="font-size: 8.5pt; font-weight: 700; color: #e11d48;">${stats.ages?.child || 0} <span style="font-size: 6pt; font-weight: normal;">ราย</span></div>
                  </div>
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 2px;">
                    <div style="font-size: 6pt; color: #64748b;">วัยทำงาน (18-59)</div>
                    <div style="font-size: 8.5pt; font-weight: 700; color: #e11d48;">${stats.ages?.working || 0} <span style="font-size: 6pt; font-weight: normal;">ราย</span></div>
                  </div>
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 2px;">
                    <div style="font-size: 6pt; color: #64748b;">สูงอายุ (60-79)</div>
                    <div style="font-size: 8.5pt; font-weight: 700; color: #e11d48;">${stats.ages?.elderly || 0} <span style="font-size: 6pt; font-weight: normal;">ราย</span></div>
                  </div>
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 2px;">
                    <div style="font-size: 6pt; color: #64748b;">ยืนยาว (80+ ปี)</div>
                    <div style="font-size: 8.5pt; font-weight: 700; color: #e11d48;">${stats.ages?.superElderly || 0} <span style="font-size: 6pt; font-weight: normal;">ราย</span></div>
                  </div>
                </div>
              </div>

              <!-- 3. อุปกรณ์จำเป็น -->
              <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 7px; background: #ffffff;">
                <div style="font-size: 7.5pt; font-weight: 700; color: #1e293b; margin-bottom: 3px;">
                  <i class="fa-solid fa-notes-medical" style="color:#e11d48; margin-right: 3px;"></i>อุปกรณ์พยุงชีพและความจำเป็นเร่งด่วน
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px;">
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 3px 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 6.5pt; color: #166534;"><i class="fa-solid fa-lungs" style="color:#16a34a; margin-right: 2px;"></i>ถัง/ผลิตออกซิเจน</span>
                    <span style="font-size: 8pt; font-weight: 700; color: #166534;">${stats.needs?.oxygen || 0} ราย</span>
                  </div>
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 3px 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 6.5pt; color: #1e40af;"><i class="fa-solid fa-bed" style="color:#2563eb; margin-right: 2px;"></i>เตียงผู้ป่วย/ที่นอนลม</span>
                    <span style="font-size: 8pt; font-weight: 700; color: #1e40af;">${stats.needs?.bed || 0} ราย</span>
                  </div>
                  <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; padding: 3px 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 6.5pt; color: #6b21a8;"><i class="fa-solid fa-wheelchair" style="color:#9333ea; margin-right: 2px;"></i>รถเข็นวีลแชร์</span>
                    <span style="font-size: 8pt; font-weight: 700; color: #6b21a8;">${stats.needs?.wheelchair || 0} ราย</span>
                  </div>
                  <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 3px 5px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 6.5pt; color: #92400e;"><i class="fa-solid fa-box-open" style="color:#d97706; margin-right: 2px;"></i>ผ้าอ้อม/แผ่นรองซับ</span>
                    <span style="font-size: 8pt; font-weight: 700; color: #92400e;">${stats.needs?.diaper || 0} ราย</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. แถบท้ายแผ่นที่ 1 -->
          <div style="border-top: 1px solid #cbd5e1; padding-top: 3px; margin-top: 4px; display: flex; justify-content: space-between; font-size: 6.5pt; color: #64748b;">
            <div><strong>แผ่นที่ 1 (หน้าสรุปสถานการณ์และสถิติภาพรวม)</strong> | ระบบ TMCare กองสวัสดิการสังคม เทศบาลตำบลตันหยงมัส</div>
            <div>โทร. 073-671377 ต่อ 114 | แผ่นต่อไป: บัญชีรายชื่อผู้พิการและกลุ่มเปราะบาง (แผ่นที่ 2 เป็นต้นไป) &gt;&gt;</div>
          </div>
        </div>

        <!-- ================= SHEET 2+: บัญชีรายชื่อผู้พิการและกลุ่มเปราะบาง ================= -->
        <div class="print-page print-page-2" style="background:#ffffff; color:#0f172a; padding: 0 4px;">
          <!-- ส่วนหัวหน้าบัญชีรายชื่อ -->
          <div style="border-bottom: 2px solid #e11d48; padding-bottom: 4px; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <div style="font-size: 12pt; font-weight: 800; color: #0f172a;">
                  บัญชีรายชื่อผู้พิการและกลุ่มเปราะบาง (จำแนกตามระดับความเร่งด่วน Triage)
                </div>
                <div style="font-size: 8pt; color: #475569; margin-top: 1px;">
                  <strong>เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส</strong> | <strong>ขอบเขต:</strong> ${scopeLabel}
                </div>
              </div>
              <div style="text-align: right; font-size: 7.5pt; color: #475569;">
                <div>จัดเรียง: 🔴 สีแดง (วิกฤต/ติดเตียง) &gt; 🟡 สีเหลือง &gt; 🟢 สีเขียว | ทั้งหมด <strong>${beneficiaries.length}</strong> ราย</div>
                <div>ข้อมูล ณ วันที่: ${dateStr}</div>
              </div>
            </div>
          </div>

          <!-- ตารางรายละเอียดรายชื่อ (Repeat thead ข้ามหน้าอัตโนมัติ) -->
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 3%;">ที่</th>
                <th style="width: 8%;">รหัส / CID</th>
                <th style="width: 14%;">ชื่อ - สกุล</th>
                <th style="width: 5%;">อายุ/เพศ</th>
                <th style="width: 18%;">ชุมชน / ที่อยู่</th>
                <th style="width: 11%;">ระดับ Triage & ADL</th>
                <th style="width: 17%;">ภาวะเปราะบาง & โรคประจำตัว</th>
                <th style="width: 11%;">อุปกรณ์พยุงชีพจำเป็น</th>
                <th style="width: 13%;">ผู้ดูแล & เบอร์ติดต่อ</th>
              </tr>
            </thead>
            <tbody>
              ${beneficiaries.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 25px; color: #64748b; font-size: 9pt;">
                    ไม่พบข้อมูลผู้พิการหรือกลุ่มเปราะบางตามขอบเขตที่เลือก
                  </td>
                </tr>
              ` : beneficiaries.map((b, idx) => {
                const comObj = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === b.communityId);
                const comName = comObj ? comObj.name : (b.communityId || '-');
                
                let badgeHtml = '';
                if (b.triageLevel === 'red') {
                  badgeHtml = `<span class="print-badge-red">🔴 แดง (ติดเตียง)</span><div style="font-size:6.5pt; color:#991b1b; font-weight:600; margin-top:1px;">ADL ${b.adlScore !== undefined ? b.adlScore + '/20' : '-'}</div>`;
                } else if (b.triageLevel === 'yellow') {
                  badgeHtml = `<span class="print-badge-yellow">🟡 เหลือง (ติดบ้าน)</span><div style="font-size:6.5pt; color:#92400e; font-weight:600; margin-top:1px;">ADL ${b.adlScore !== undefined ? b.adlScore + '/20' : '-'}</div>`;
                } else {
                  badgeHtml = `<span class="print-badge-green">🟢 เขียว (ติดสังคม)</span><div style="font-size:6.5pt; color:#065f46; font-weight:600; margin-top:1px;">ADL ${b.adlScore !== undefined ? b.adlScore + '/20' : '-'}</div>`;
                }

                const gender = (b.prefix || '').includes('นาย') || (b.prefix || '').includes('ด.ช.') || (b.prefix || '').includes('เด็กชาย') ? 'ช' : 'ญ';

                return `
                  <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                    <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
                    <td style="font-size: 7pt; color: #475569;">
                      <div style="font-weight: 700; color: #e11d48;">${b.id}</div>
                      <div style="letter-spacing: -0.2px;">${b.cidMasked || '-'}</div>
                    </td>
                    <td style="font-weight: 700; color: #0f172a;">
                      ${b.prefix || ''}${b.firstName} ${b.lastName}
                    </td>
                    <td style="text-align: center;">
                      <div>${b.age || '-'} ปี</div>
                      <div style="font-size: 6.5pt; color: #64748b;">(${gender})</div>
                    </td>
                    <td style="font-size: 7pt; line-height: 1.25;">
                      <div style="font-weight: 600; color: #be123c;">${comName}</div>
                      <div style="color: #475569;">${b.address || '-'}</div>
                    </td>
                    <td style="text-align: center; line-height: 1.2;">
                      ${badgeHtml}
                    </td>
                    <td style="font-size: 7pt; line-height: 1.25;">
                      <div style="font-weight: 600; color: #1e293b;">${b.vulnerabilityType || '-'}</div>
                      <div style="color: #dc2626; font-size: 6.5pt;">${b.chronicDiseases ? 'โรค: ' + b.chronicDiseases : ''}</div>
                    </td>
                    <td style="font-size: 7pt; color: #0f172a; line-height: 1.25;">
                      ${b.medicalDevices && b.medicalDevices !== 'ไม่มี' ? `<strong style="color:#b91c1c;">${b.medicalDevices}</strong>` : '<span style="color:#94a3b8;">-</span>'}
                    </td>
                    <td style="font-size: 7pt; line-height: 1.25;">
                      <div style="font-weight: 600; color: #1e293b;">${b.caregiverName || '-'}</div>
                      <div style="font-weight: 700; color: #e11d48; font-size: 6.5pt;">${b.caregiverPhone || '-'}</div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- ช่องลงนามทางการ 3 ส่วน (ผู้จัดทำ, ผู้ตรวจสอบ, ผู้อนุมัติ) -->
          <div class="print-signatures" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; margin-top: 18px;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
              <div style="width: 75%; border-bottom: 1px dotted #475569; margin-bottom: 5px; height: 30px;"></div>
              <div style="font-size: 7.5pt; font-weight: 600; color: #0f172a;">( ................................................................ )</div>
              <div style="font-size: 7pt; color: #475569; margin-top: 1px;">ผู้รายงาน / ผู้จัดทำข้อมูล</div>
              <div style="font-size: 6.5pt; color: #64748b;">(กรรมการชุมชน / จนท.กองสวัสดิการสังคม)</div>
              <div style="font-size: 7pt; color: #475569; margin-top: 3px;">วันที่ ........ เดือน ........................ พ.ศ. ............</div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
              <div style="width: 75%; border-bottom: 1px dotted #475569; margin-bottom: 5px; height: 30px;"></div>
              <div style="font-size: 7.5pt; font-weight: 600; color: #0f172a;">( ................................................................ )</div>
              <div style="font-size: 7pt; color: #475569; margin-top: 1px;">ผู้ตรวจสอบข้อมูล</div>
              <div style="font-size: 6.5pt; color: #64748b;">หัวหน้าฝ่ายสังคมสงเคราะห์ / ผอ.กองสวัสดิการสังคม</div>
              <div style="font-size: 7pt; color: #475569; margin-top: 3px;">วันที่ ........ เดือน ........................ พ.ศ. ............</div>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
              <div style="width: 75%; border-bottom: 1px dotted #475569; margin-bottom: 5px; height: 30px;"></div>
              <div style="font-size: 7.5pt; font-weight: 600; color: #0f172a;">( ................................................................ )</div>
              <div style="font-size: 7pt; color: #475569; margin-top: 1px;">ผู้อนุมัติ / รับรองรายงาน</div>
              <div style="font-size: 6.5pt; color: #64748b;">ปลัดเทศบาล / นายกเทศมนตรีตำบลตันหยงมัส</div>
              <div style="font-size: 7pt; color: #475569; margin-top: 3px;">วันที่ ........ เดือน ........................ พ.ศ. ............</div>
            </div>
          </div>

          <!-- ท้ายเอกสารแผ่นที่ 2 เป็นต้นไป -->
          <div style="border-top: 1px solid #cbd5e1; padding-top: 3px; margin-top: 12px; display: flex; justify-content: space-between; font-size: 6.5pt; color: #64748b;">
            <div>ระบบ TMCare เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส</div>
            <div>พิมพ์เมื่อ: ${dateStr}</div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error("preparePrintData error:", err);
    }
  },

  async printReport() {
    await this.preparePrintData();
    setTimeout(() => {
      window.print();
    }, 150);
  },

  // ----------------------------------------------------
  // MODAL UTILITIES
  // ----------------------------------------------------
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('flex');
      document.body.classList.add('overflow-hidden');
    }
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('flex');
      // Only remove overflow-hidden if no other modals are active
      const remainingOpen = document.querySelectorAll('.fixed.z-50.flex');
      if (remainingOpen.length === 0) {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }
};

// Bind to window for Leaflet HTML popups and inline onclick events
window.app = app;

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

