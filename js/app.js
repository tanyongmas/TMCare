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
  benPickerMap: null,
  benPickerMarker: null,
  triageChart: null,

  async init() {
    console.log("Initializing TMCare Application...");
    apiService.init();
    this.setupEventListeners();
    this.updateProviderStatusUI();

    // ตรวจสอบสถานะการเข้าสู่ระบบ
    const user = apiService.getCurrentUser();
    if (!user) {
      this.openModal('modal-login');
      // ซิงค์ข้อมูลผู้ใช้และตรวจสอบการเชื่อมต่อ GAS ตั้งแต่เปิดเว็บ
      if (apiService.getProvider() === 'GAS' && gasDriver.getApiUrl()) {
        apiService.syncFromGas().then(() => this.updateProviderStatusUI());
      }
    } else {
      this.closeModal('modal-login');
      this.updateUserUI(user);
      await this.loadCurrentView();
    }
  },

  setupEventListeners() {
    // SOS Quick Call
    const sosBtn = document.getElementById('btn-quick-sos');
    if (sosBtn) {
      sosBtn.addEventListener('click', async () => {
        if (await this.showConfirm("โทรออกสายด่วน 1669", "ต้องการโทรออกสายด่วนการแพทย์ฉุกเฉิน 1669 ทันทีหรือไม่?", "โทร 1669", "ยกเลิก", "warning")) {
          window.location.href = "tel:1669";
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (await this.showConfirm("ออกจากระบบ", "ต้องการออกจากระบบ / สลับบัญชีผู้ใช้งานหรือไม่?", "ออกจากระบบ", "ยกเลิก", "question")) {
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

    // อัปเดตแถบสถานะและแจ้งเตือนการเชื่อมต่อ GAS อัตโนมัติ
    window.addEventListener('tmcare:gas-status', () => {
      this.updateProviderStatusUI();
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
      this.showAlert("กรุณาเลือกชุมชน", "กรุณาเลือกชุมชนที่ท่านรับผิดชอบ", "warning");
      return;
    }

    try {
      const user = apiService.login('committee', { communityId, pin });
      this.closeModal('modal-login');
      this.updateUserUI(user);
      this.loadCurrentView();
    } catch (err) {
      this.showAlert("เข้าสู่ระบบไม่สำเร็จ", err.message, "error");
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
      this.showAlert("เข้าสู่ระบบไม่สำเร็จ", err.message, "error");
    }
  },

  updateProviderStatusUI() {
    const dbProviderName = document.getElementById('db-provider-name');
    const dbDot = document.getElementById('db-indicator-dot');
    const gasBanner = document.getElementById('gas-setup-banner');
    const gasErrorBanner = document.getElementById('gas-error-banner');
    const gasErrorMsg = document.getElementById('gas-error-message');

    const p = apiService.getProvider();
    if (dbProviderName) {
      dbProviderName.textContent = p === 'GAS' ? 'Google Sheets' : p;
    }

    if (p === 'GAS') {
      const hasUrl = !!gasDriver.getApiUrl();
      if (gasBanner) {
        gasBanner.classList.toggle('hidden', hasUrl);
      }

      const isFailed = hasUrl && apiService.isGasConnected === false;
      if (gasErrorBanner) {
        gasErrorBanner.classList.toggle('hidden', !isFailed);
        if (isFailed && gasErrorMsg) {
          gasErrorMsg.textContent = apiService.gasConnectionError || 'ไม่สามารถดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์ได้';
        }
      }

      if (dbDot) {
        if (!hasUrl) {
          dbDot.className = "w-2 h-2 rounded-full bg-amber-400 animate-ping";
        } else if (isFailed) {
          dbDot.className = "w-2 h-2 rounded-full bg-rose-400 animate-pulse";
        } else {
          dbDot.className = "w-2 h-2 rounded-full bg-emerald-400";
        }
      }
    } else {
      if (gasBanner) gasBanner.classList.add('hidden');
      if (gasErrorBanner) gasErrorBanner.classList.add('hidden');
      if (dbDot) dbDot.className = "w-2 h-2 rounded-full bg-emerald-400";
    }
  },

  async retryGasConnection() {
    const btn = document.getElementById('btn-retry-gas');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเชื่อมต่อ...';
    }

    try {
      const ok = await apiService.syncFromGas(this.currentCommunityFilter);
      this.updateProviderStatusUI();
      if (ok && apiService.getCurrentUser()) {
        await this.loadCurrentView();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> ลองเชื่อมต่อใหม่ (Retry)';
      }
    }
  },

  updateUserUI(user) {
    if (!user) return;

    // Header Badges
    const roleBadge = document.getElementById('user-badge-role');
    const comBadge = document.getElementById('user-badge-community');
    const mobileComName = document.getElementById('mobile-community-name');
    const mobileRoleLabel = document.getElementById('mobile-role-label');

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

    this.updateProviderStatusUI();

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
  showDashboardTableSkeleton() {
    const tbody = document.getElementById('table-community-breakdown');
    if (!tbody) return;
    tbody.innerHTML = Array(5).fill(0).map(() => `
      <tr class="animate-pulse">
        <td class="py-2.5 px-3"><div class="skeleton-text w-28 sm:w-36"></div></td>
        <td class="py-2.5 px-2 text-center"><div class="skeleton-text w-6 mx-auto"></div></td>
        <td class="py-2.5 px-2 text-center"><div class="skeleton-text w-6 mx-auto"></div></td>
        <td class="py-2.5 px-2 text-center"><div class="skeleton-text w-6 mx-auto"></div></td>
        <td class="py-2.5 px-2 text-center"><div class="skeleton-text w-6 mx-auto"></div></td>
        <td class="py-2.5 px-2 text-center"><div class="skeleton-badge w-12 mx-auto"></div></td>
      </tr>
    `).join('');
  },

  async renderDashboard() {
    this.showDashboardTableSkeleton();
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

    // ดึงรายชื่อกลุ่มเปราะบางตามตัวกรองชุมชนปัจจุบัน และสถานะภัยพิบัติล่าสุด
    const beneficiaries = await apiService.getBeneficiaries(this.currentCommunityFilter);
    const statuses = await apiService.getDisasterStatuses();

    beneficiaries.forEach(b => {
      if (!b.lat || !b.lng) return;

      const statusItem = statuses.find(s => s.beneficiaryId === b.id);
      const customIcon = this.createMapPinIcon(b, statusItem);

      L.marker([b.lat, b.lng], { icon: customIcon })
        .bindPopup(this.createMapPopupContent(b, statusItem), { maxWidth: 300, minWidth: 260 })
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
      this.showAlert("จำกัดสิทธิ์การเข้าถึง", "ท่านสามารถดูข้อมูลได้เฉพาะชุมชนของท่านเท่านั้น", "warning");
      return;
    }
    const comSelect = document.getElementById('select-ben-community');
    if (comSelect) comSelect.value = comId;
    this.switchTab('beneficiaries');
  },

  // ----------------------------------------------------
  // 2. BENEFICIARIES & VISITS CONTROLLER
  // ----------------------------------------------------
  showBeneficiariesSkeleton() {
    const container = document.getElementById('beneficiaries-list');
    if (!container) return;
    container.innerHTML = Array(6).fill(0).map(() => `
      <div class="skeleton-card space-y-3">
        <div class="flex items-start justify-between gap-2.5">
          <div class="flex items-center space-x-2.5 w-full min-w-0">
            <div class="skeleton-avatar w-12 h-12 shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton-text w-3/4"></div>
              <div class="skeleton-text w-1/2"></div>
            </div>
          </div>
          <div class="skeleton-badge shrink-0"></div>
        </div>
        <div class="space-y-2 pt-1">
          <div class="skeleton-text w-1/3"></div>
          <div class="skeleton-text w-5/6"></div>
          <div class="skeleton-box h-16 w-full"></div>
        </div>
        <div class="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
          <div class="skeleton-box h-9"></div>
          <div class="skeleton-box h-9"></div>
          <div class="skeleton-box h-9"></div>
        </div>
      </div>
    `).join('');
  },

  async renderBeneficiaries() {
    this.showBeneficiariesSkeleton();
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

    const user = apiService.getCurrentUser();
    const canEdit = user && user.role === 'officer';

    container.innerHTML = list.map(item => {
      const triageClass = item.triageLevel === 'red' ? 'triage-border-red' : (item.triageLevel === 'yellow' ? 'triage-border-yellow' : 'triage-border-green');
      const badgeClass = item.triageLevel === 'red' ? 'triage-badge-red' : (item.triageLevel === 'yellow' ? 'triage-badge-yellow' : 'triage-badge-green');
      const triageLabel = item.triageLevel === 'red' ? '🔴 สีแดง (ติดเตียง/วิกฤต)' : (item.triageLevel === 'yellow' ? '🟡 สีเหลือง (ติดบ้าน)' : '🟢 สีเขียว (ติดสังคม)');
      const comName = TMCARE_CONFIG.COMMUNITIES.find(c => c.id === item.communityId)?.name || item.communityId;
      const avatarHtml = this.getBeneficiaryAvatarHtml(item);
      const gridColsClass = canEdit ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3';

      return `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 card-hover ${triageClass} flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-start justify-between gap-2.5">
              <div class="flex items-center space-x-2.5 min-w-0">
                ${avatarHtml}
                <div class="min-w-0">
                  <h4 class="font-bold text-slate-800 text-sm truncate">${item.prefix}${item.firstName} ${item.lastName}</h4>
                  <div class="text-[11px] text-slate-500 truncate">อายุ ${item.age !== undefined && item.age !== null && item.age !== '' ? item.age : '-'} ปี | เลข ปชช: ${this.formatThaiId(item.cidMasked) || '-'}</div>
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
          <div class="grid ${gridColsClass} gap-2 pt-2.5 border-t border-slate-100 text-xs">
            <button onclick="app.openVisitModal('${item.id}')" class="touch-btn bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/90 font-medium py-2 px-1.5 rounded-xl text-center flex flex-col items-center transition shadow-xs">
              <i class="fa-solid fa-stethoscope mb-0.5 text-sm text-sky-600"></i>
              <span class="text-[11px] font-semibold">บันทึกเยี่ยม</span>
            </button>
            <button onclick="app.openEmsCard('${item.id}')" class="touch-btn bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 font-medium py-2 px-1.5 rounded-xl text-center flex flex-col items-center transition">
              <i class="fa-solid fa-truck-medical mb-0.5 text-sm text-rose-600"></i>
              <span class="text-[11px] font-semibold">บัตรฉุกเฉิน</span>
            </button>
            <button onclick="app.openWelfareModalFor('${item.id}')" class="touch-btn bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 font-medium py-2 px-1.5 rounded-xl text-center flex flex-col items-center transition">
              <i class="fa-solid fa-hand-holding-dollar mb-0.5 text-sm text-emerald-600"></i>
              <span class="text-[11px] font-semibold">ขอสวัสดิการ</span>
            </button>
            ${canEdit ? `
            <button onclick="app.openEditBeneficiaryModal('${item.id}')" class="touch-btn bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 font-medium py-2 px-1.5 rounded-xl text-center flex flex-col items-center transition">
              <i class="fa-solid fa-pen-to-square mb-0.5 text-sm text-amber-600"></i>
              <span class="text-[11px] font-semibold">แก้ไขข้อมูล</span>
            </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  getBeneficiaryAvatarHtml(item) {
    const prefix = (item.prefix || '').trim();
    const isMale = prefix.includes('นาย') || prefix.includes('ด.ช.') || prefix.includes('เด็กชาย');
    const ageNum = parseInt(item.age, 10);
    const isChild = Number.isFinite(ageNum) && ageNum < 15;

    const colorClass = isMale
      ? 'bg-sky-100 text-sky-600 border-sky-200'
      : 'bg-pink-100 text-pink-600 border-pink-200';

    const iconClass = isChild
      ? (isMale ? 'fa-solid fa-child' : 'fa-solid fa-child-dress')
      : (isMale ? 'fa-solid fa-person' : 'fa-solid fa-person-dress');

    return `
      <div class="w-12 h-12 rounded-xl border shadow-sm shrink-0 flex items-center justify-center text-2xl ${colorClass}" aria-label="${isMale ? 'ชาย' : 'หญิง'}">
        <i class="${iconClass}"></i>
      </div>
    `;
  },

  handleSearchBeneficiary() {
    this.renderBeneficiaries();
  },

  openAddBeneficiaryModal() {
    const user = apiService.getCurrentUser();
    document.getElementById('form-beneficiary').reset();
    document.getElementById('form-ben-id').value = '';
    document.getElementById('form-ben-subdistrict').value = 'ตันหยงมัส';
    document.getElementById('form-ben-district').value = 'ระแงะ';
    document.getElementById('form-ben-province').value = 'นราธิวาส';
    document.getElementById('modal-ben-title').textContent = "ลงทะเบียนผู้พิการ/กลุ่มเปราะบางรายใหม่";

    const comSelect = document.getElementById('form-ben-community');
    if (user.role === 'committee') {
      comSelect.value = user.communityId;
      comSelect.disabled = true;
    } else {
      comSelect.disabled = false;
    }

    this.resetVulnerabilitySelections();
    this.updateAdlPreview(8);
    this.openModal('modal-beneficiary');
    this.initBeneficiaryPickerMap();
  },

  parseAddressForForm(addressStr) {
    const raw = (addressStr || '').trim();
    const result = {
      houseNo: '',
      moo: '',
      road: '',
      subdistrict: 'ตันหยงมัส',
      district: 'ระแงะ',
      province: 'นราธิวาส'
    };
    if (!raw) return result;

    let remaining = raw;
    const provMatch = remaining.match(/(?:จ\.|จังหวัด)\s*([^\s]+)/);
    if (provMatch) {
      result.province = provMatch[1];
      remaining = remaining.replace(provMatch[0], '').trim();
    }
    const distMatch = remaining.match(/(?:อ\.|อำเภอ)\s*([^\s]+)/);
    if (distMatch) {
      result.district = distMatch[1];
      remaining = remaining.replace(distMatch[0], '').trim();
    }
    const subMatch = remaining.match(/(?:ต\.|ตำบล)\s*([^\s]+)/);
    if (subMatch) {
      result.subdistrict = subMatch[1];
      remaining = remaining.replace(subMatch[0], '').trim();
    }
    const mooMatch = remaining.match(/(?:หมู่ที่|หมู่|ม\.)\s*([^\s]+)/);
    if (mooMatch) {
      result.moo = mooMatch[1];
      remaining = remaining.replace(mooMatch[0], '').trim();
    }
    const roadMatch = remaining.match(/((?:ถ\.|ถนน|ซ\.|ซอย)\s*[^\s]+(?:\s+ซ\.\s*[^\s]+)?)/);
    if (roadMatch) {
      result.road = roadMatch[1].trim();
      remaining = remaining.replace(roadMatch[0], '').trim();
    }
    result.houseNo = remaining.trim() || raw;
    return result;
  },

  async openEditBeneficiaryModal(beneficiaryId) {
    const user = apiService.getCurrentUser();
    if (!user || user.role !== 'officer') {
      await this.showAlert("ไม่มีสิทธิ์แก้ไข", "เฉพาะเจ้าหน้าที่กองสวัสดิการสังคมเท่านั้นที่สามารถแก้ไขข้อมูลได้", "warning");
      return;
    }

    const ben = await apiService.getBeneficiaryById(beneficiaryId);
    if (!ben) {
      await this.showAlert("ไม่พบข้อมูล", "ไม่สามารถโหลดข้อมูลรายการนี้ได้", "error");
      return;
    }

    document.getElementById('form-beneficiary').reset();
    document.getElementById('form-ben-id').value = ben.id || '';
    document.getElementById('modal-ben-title').textContent = "แก้ไขข้อมูลผู้พิการ/กลุ่มเปราะบาง";

    const comSelect = document.getElementById('form-ben-community');
    if (comSelect) {
      comSelect.value = ben.communityId || '';
      comSelect.disabled = false;
    }

    document.getElementById('form-ben-prefix').value = ben.prefix || '';
    document.getElementById('form-ben-firstname').value = ben.firstName || '';
    document.getElementById('form-ben-lastname').value = ben.lastName || '';
    document.getElementById('form-ben-age').value = (ben.age !== undefined && ben.age !== null && ben.age !== '') ? ben.age : '';
    document.getElementById('form-ben-cid').value = this.formatThaiId(ben.cidMasked);
    document.getElementById('form-ben-phone').value = this.formatThaiPhone(ben.phone);

    const addr = this.parseAddressForForm(ben.address);
    document.getElementById('form-ben-house-no').value = addr.houseNo;
    document.getElementById('form-ben-moo').value = addr.moo;
    document.getElementById('form-ben-road').value = addr.road;
    document.getElementById('form-ben-subdistrict').value = addr.subdistrict;
    document.getElementById('form-ben-district').value = addr.district;
    document.getElementById('form-ben-province').value = addr.province;

    const latVal = Number.isFinite(parseFloat(ben.lat)) ? parseFloat(ben.lat) : TMCARE_CONFIG.MAP_CENTER.lat;
    const lngVal = Number.isFinite(parseFloat(ben.lng)) ? parseFloat(ben.lng) : TMCARE_CONFIG.MAP_CENTER.lng;
    document.getElementById('form-ben-lat').value = latVal.toFixed(6);
    document.getElementById('form-ben-lng').value = lngVal.toFixed(6);

    const adlScore = ben.adlScore !== undefined && ben.adlScore !== null ? ben.adlScore : 8;
    document.getElementById('form-ben-adl').value = adlScore;
    this.updateAdlPreview(adlScore);

    // แยกค่า vulnerabilityType / disabilityTypes กลับเป็น 3.1, 3.2, 3.3
    this.resetVulnerabilitySelections();
    const vulText = (ben.vulnerabilityType || '').trim();
    const parts = vulText.split('|').map(s => s.trim()).filter(Boolean);
    const matchedDisabilities = new Set();

    // ตรวจสอบจากฟิลด์ disabilityTypes เดิมก่อน (ถ้ามี)
    if (ben.disabilityTypes) {
      String(ben.disabilityTypes).split(',').map(s => s.trim()).filter(Boolean).forEach(token => {
        const numMatch = token.match(/^([1-7])\b/);
        if (numMatch) {
          matchedDisabilities.add(numMatch[1]);
        } else {
          Object.entries(this.disabilityTypeOptions).forEach(([k, label]) => {
            if (token.includes(label) || label.includes(token)) matchedDisabilities.add(k);
          });
        }
      });
    }

    parts.forEach(part => {
      const groupMatch = part.match(/กลุ่มที่\s*([1-4])/);
      if (part.includes('ผู้สูงอายุที่มีภาวะพึ่งพิง') && groupMatch) {
        const g = groupMatch[1];
        const hiddenInput = document.getElementById('form-ben-elderly-group');
        if (hiddenInput) hiddenInput.value = g;
        this.updateElderlyGroupButtons(g);
      } else if (part.includes('ผู้สูงอายุทั่วไป')) {
        const genInput = document.getElementById('form-ben-general-elderly');
        if (genInput) genInput.value = '1';
        this.updateGeneralElderlyButton(true);
      } else {
        Object.entries(this.disabilityTypeOptions).forEach(([k, label]) => {
          const shortKey = label.split('/')[0];
          if (part.includes(`${k}.`) || part.includes(label) || part.includes(shortKey)) {
            matchedDisabilities.add(k);
          }
        });
      }
    });

    if (matchedDisabilities.size > 0) {
      const disArr = Array.from(matchedDisabilities).sort();
      const disInput = document.getElementById('form-ben-disability-types');
      if (disInput) disInput.value = disArr.join(',');
      this.updateDisabilityTypeButtons(disArr);
    }

    document.getElementById('form-ben-chronic').value = ben.chronicDiseases || '';
    document.getElementById('form-ben-allergies').value = ben.drugAllergies || '';
    document.getElementById('form-ben-devices').value = ben.medicalDevices || '';
    document.getElementById('form-ben-hospital').value = ben.hospitalRef || 'รพ.ระแงะ';
    document.getElementById('form-ben-caregiver-name').value = ben.caregiverName || '';
    document.getElementById('form-ben-caregiver-phone').value = this.formatThaiPhone(ben.caregiverPhone);

    this.openModal('modal-beneficiary');
    this.initBeneficiaryPickerMap(latVal, lngVal);
  },

  elderlyGroupDescriptions: {
    '1': 'ผู้สูงอายุที่มีภาวะพึ่งพิง กลุ่มที่ 1: เคลื่อนไหวได้บ้าง และอาจมีปัญหาการกิน หรือการขับถ่าย แต่ไม่มีภาวะสับสนทางสมอง',
    '2': 'ผู้สูงอายุที่มีภาวะพึ่งพิง กลุ่มที่ 2: เคลื่อนไหวได้บ้าง และอาจมีปัญหาการกิน หรือการขับถ่าย และมีภาวะสับสนทางสมอง',
    '3': 'ผู้สูงอายุที่มีภาวะพึ่งพิง กลุ่มที่ 3: เคลื่อนไหวเองไม่ได้ และอาจมีปัญหาการกินหรือการขับถ่าย หรือมีอาการเจ็บป่วยรุนแรง',
    '4': 'ผู้สูงอายุที่มีภาวะพึ่งพิง กลุ่มที่ 4: เคลื่อนไหวเองไม่ได้ มีอาการเจ็บป่วยรุนแรง หรืออยู่ในระยะท้ายของชีวิต'
  },

  toggleElderlyGroup(groupNum) {
    const input = document.getElementById('form-ben-elderly-group');
    if (!input) return;
    const nextVal = input.value === String(groupNum) ? '' : String(groupNum);
    input.value = nextVal;
    this.updateElderlyGroupButtons(nextVal);
  },

  disabilityTypeOptions: {
    '1': 'ทางการเห็น',
    '2': 'ทางการได้ยิน/สื่อความหมาย',
    '3': 'ทางการเคลื่อนไหว/ร่างกาย',
    '4': 'ทางจิตใจ/พฤติกรรม',
    '5': 'ทางสติปัญญา',
    '6': 'ทางการเรียนรู้',
    '7': 'ทางออทิสติก'
  },

  resetVulnerabilitySelections() {
    this.resetElderlyGroupSelection();
    const disInput = document.getElementById('form-ben-disability-types');
    if (disInput) disInput.value = '';
    this.updateDisabilityTypeButtons([]);
    const genInput = document.getElementById('form-ben-general-elderly');
    if (genInput) genInput.value = '';
    this.updateGeneralElderlyButton(false);
  },

  toggleDisabilityType(typeId) {
    const input = document.getElementById('form-ben-disability-types');
    if (!input) return;
    const current = input.value ? input.value.split(',').filter(Boolean) : [];
    const idStr = String(typeId);
    const idx = current.indexOf(idStr);
    if (idx === -1) {
      current.push(idStr);
    } else {
      current.splice(idx, 1);
    }
    current.sort();
    input.value = current.join(',');
    this.updateDisabilityTypeButtons(current);
  },

  updateDisabilityTypeButtons(selectedIds = []) {
    const selectedSet = new Set(selectedIds.map(String));
    document.querySelectorAll('.disability-type-btn').forEach(btn => {
      const isSelected = selectedSet.has(btn.dataset.disabilityType);
      const badge = btn.querySelector('.disability-type-badge');
      const icon = btn.querySelector('i');
      if (isSelected) {
        btn.classList.remove('border-slate-200', 'bg-white', 'hover:border-rose-300', 'text-slate-700');
        btn.classList.add('border-rose-500', 'bg-rose-100/90', 'text-rose-950', 'ring-1', 'ring-rose-500/40', 'shadow-xs');
        if (badge) {
          badge.classList.remove('bg-slate-100', 'text-slate-600');
          badge.classList.add('bg-rose-600', 'text-white');
        }
        if (icon) {
          icon.classList.remove('text-slate-400');
          icon.classList.add('text-rose-600');
        }
      } else {
        btn.classList.add('border-slate-200', 'bg-white', 'hover:border-rose-300', 'text-slate-700');
        btn.classList.remove('border-rose-500', 'bg-rose-100/90', 'text-rose-950', 'ring-1', 'ring-rose-500/40', 'shadow-xs');
        if (badge) {
          badge.classList.add('bg-slate-100', 'text-slate-600');
          badge.classList.remove('bg-rose-600', 'text-white');
        }
        if (icon) {
          icon.classList.add('text-slate-400');
          icon.classList.remove('text-rose-600');
        }
      }
    });

    const summaryEl = document.getElementById('disability-selected-summary');
    if (summaryEl) {
      const labels = selectedIds
        .map(id => this.disabilityTypeOptions[id] ? `${id}. ${this.disabilityTypeOptions[id]}` : null)
        .filter(Boolean);
      if (labels.length > 0) {
        summaryEl.textContent = `ที่เลือก: ${labels.join(', ')}`;
        summaryEl.classList.remove('hidden');
      } else {
        summaryEl.textContent = '';
        summaryEl.classList.add('hidden');
      }
    }
  },

  toggleGeneralElderly() {
    const input = document.getElementById('form-ben-general-elderly');
    if (!input) return;
    const nextSelected = input.value !== '1';
    input.value = nextSelected ? '1' : '';
    this.updateGeneralElderlyButton(nextSelected);
  },

  updateGeneralElderlyButton(isSelected) {
    const btn = document.getElementById('btn-ben-general-elderly');
    const badge = document.getElementById('badge-ben-general-elderly');
    const icon = btn ? btn.querySelector('.fa-person-cane') : null;
    if (!btn) return;
    if (isSelected) {
      btn.classList.remove('border-slate-200', 'bg-white', 'hover:border-rose-300', 'text-slate-700');
      btn.classList.add('border-rose-500', 'bg-rose-100/90', 'text-rose-950', 'ring-1', 'ring-rose-500/40', 'shadow-xs');
      if (badge) {
        badge.classList.remove('border-slate-300', 'text-transparent');
        badge.classList.add('bg-rose-600', 'border-rose-600', 'text-white');
      }
      if (icon) {
        icon.classList.remove('text-slate-400');
        icon.classList.add('text-rose-600');
      }
    } else {
      btn.classList.add('border-slate-200', 'bg-white', 'hover:border-rose-300', 'text-slate-700');
      btn.classList.remove('border-rose-500', 'bg-rose-100/90', 'text-rose-950', 'ring-1', 'ring-rose-500/40', 'shadow-xs');
      if (badge) {
        badge.classList.add('border-slate-300', 'text-transparent');
        badge.classList.remove('bg-rose-600', 'border-rose-600', 'text-white');
      }
      if (icon) {
        icon.classList.add('text-slate-400');
        icon.classList.remove('text-rose-600');
      }
    }
  },

  resetElderlyGroupSelection() {
    const input = document.getElementById('form-ben-elderly-group');
    if (input) input.value = '';
    this.updateElderlyGroupButtons('');
  },

  updateElderlyGroupButtons(selectedGroup) {
    document.querySelectorAll('.elderly-group-btn').forEach(btn => {
      const isSelected = btn.dataset.elderlyGroup === String(selectedGroup) && selectedGroup !== '';
      const badge = btn.querySelector('.elderly-group-badge');
      if (isSelected) {
        btn.classList.remove('border-slate-200', 'bg-white', 'hover:border-rose-300', 'text-slate-700');
        btn.classList.add('border-rose-500', 'bg-rose-100/80', 'text-rose-950', 'ring-2', 'ring-rose-500/25', 'shadow-sm');
        if (badge) {
          badge.classList.remove('border-slate-300', 'text-slate-500');
          badge.classList.add('bg-rose-600', 'border-rose-600', 'text-white');
        }
      } else {
        btn.classList.add('border-slate-200', 'bg-white', 'hover:border-rose-300', 'text-slate-700');
        btn.classList.remove('border-rose-500', 'bg-rose-100/80', 'text-rose-950', 'ring-2', 'ring-rose-500/25', 'shadow-sm');
        if (badge) {
          badge.classList.add('border-slate-300', 'text-slate-500');
          badge.classList.remove('bg-rose-600', 'border-rose-600', 'text-white');
        }
      }
    });
  },

  initBeneficiaryPickerMap(lat = null, lng = null) {
    const mapEl = document.getElementById('beneficiary-picker-map');
    if (!mapEl || typeof L === 'undefined') return;

    const inputLat = parseFloat(document.getElementById('form-ben-lat')?.value);
    const inputLng = parseFloat(document.getElementById('form-ben-lng')?.value);
    const targetLat = Number.isFinite(lat) ? lat : (Number.isFinite(inputLat) ? inputLat : TMCARE_CONFIG.MAP_CENTER.lat);
    const targetLng = Number.isFinite(lng) ? lng : (Number.isFinite(inputLng) ? inputLng : TMCARE_CONFIG.MAP_CENTER.lng);
    const defaultZoom = TMCARE_CONFIG.MAP_CENTER.zoom || 15;

    if (!this.benPickerMap) {
      this.benPickerMap = L.map('beneficiary-picker-map').setView([targetLat, targetLng], defaultZoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this.benPickerMap);

      this.benPickerMarker = L.marker([targetLat, targetLng], { draggable: true }).addTo(this.benPickerMap);

      this.benPickerMarker.on('dragend', e => {
        const pos = e.target.getLatLng();
        this.setBeneficiaryCoords(pos.lat, pos.lng, false);
      });

      this.benPickerMap.on('click', e => {
        this.setBeneficiaryCoords(e.latlng.lat, e.latlng.lng, true);
      });
    } else {
      this.benPickerMarker.setLatLng([targetLat, targetLng]);
      this.benPickerMap.setView([targetLat, targetLng], Math.max(this.benPickerMap.getZoom(), defaultZoom));
    }

    // รอให้ Modal แสดงผลเต็มที่ก่อนปรับขนาดแผนที่ Leaflet
    setTimeout(() => {
      if (this.benPickerMap) {
        this.benPickerMap.invalidateSize();
      }
    }, 200);
  },

  setBeneficiaryCoords(lat, lng, moveMap = false) {
    const latInput = document.getElementById('form-ben-lat');
    const lngInput = document.getElementById('form-ben-lng');
    if (latInput) latInput.value = Number(lat).toFixed(6);
    if (lngInput) lngInput.value = Number(lng).toFixed(6);

    if (this.benPickerMarker) {
      this.benPickerMarker.setLatLng([lat, lng]);
    }
    if (moveMap && this.benPickerMap) {
      this.benPickerMap.panTo([lat, lng]);
    }
  },

  syncBeneficiaryMapFromInputs() {
    const lat = parseFloat(document.getElementById('form-ben-lat')?.value);
    const lng = parseFloat(document.getElementById('form-ben-lng')?.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (this.benPickerMarker) {
      this.benPickerMarker.setLatLng([lat, lng]);
    }
    if (this.benPickerMap) {
      this.benPickerMap.panTo([lat, lng]);
    }
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
          this.setBeneficiaryCoords(pos.coords.latitude, pos.coords.longitude, true);
          if (this.benPickerMap) {
            this.benPickerMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
          }
          this.showAlert("จับพิกัด GPS สำเร็จ", `พิกัด: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, "success");
        },
        err => {
          // หากผู้ใช้ไม่ได้เปิด GPS บนเครื่อง ให้ใช้พิกัดกลาง ทต.ตันหยงมัส
          this.setBeneficiaryCoords(TMCARE_CONFIG.MAP_CENTER.lat, TMCARE_CONFIG.MAP_CENTER.lng, true);
          this.showAlert("ไม่สามารถเข้าถึง GPS ได้", "ระบบได้ตั้งค่าพิกัดศูนย์กลาง ทต.ตันหยงมัส ให้แทน (สามารถคลิกหรือลากหมุดบนแผนที่ได้)", "warning");
        }
      );
    }
  },

  async handleSaveBeneficiary(e) {
    e.preventDefault();
    const user = apiService.getCurrentUser();

    const elderlyGroup = (document.getElementById('form-ben-elderly-group')?.value || '').trim();
    const disabilityRaw = (document.getElementById('form-ben-disability-types')?.value || '').trim();
    const disabilityIds = disabilityRaw ? disabilityRaw.split(',').filter(Boolean) : [];
    const isGeneralElderly = (document.getElementById('form-ben-general-elderly')?.value || '').trim() === '1';

    if (!elderlyGroup && disabilityIds.length === 0 && !isGeneralElderly) {
      await this.showAlert(
        "กรุณาระบุประเภทความเปราะบาง",
        "กรุณาเลือกอย่างน้อย 1 หัวข้อ (ผู้สูงอายุที่มีภาวะพึ่งพิง, ประเภทผู้พิการ หรือผู้สูงอายุทั่วไป)",
        "warning"
      );
      return;
    }

    const vulnerabilityParts = [];
    if (elderlyGroup && this.elderlyGroupDescriptions[elderlyGroup]) {
      vulnerabilityParts.push(this.elderlyGroupDescriptions[elderlyGroup]);
    }
    const disabilityLabels = disabilityIds
      .map(id => this.disabilityTypeOptions[id] ? `${id}. ${this.disabilityTypeOptions[id]}` : null)
      .filter(Boolean);
    if (disabilityLabels.length > 0) {
      vulnerabilityParts.push(`ผู้พิการ: ${disabilityLabels.join(', ')}`);
    }
    if (isGeneralElderly) {
      vulnerabilityParts.push('ผู้สูงอายุทั่วไป (ไม่เป็นกลุ่มพึ่งพิง/ผู้พิการ)');
    }
    const vulnerabilityType = vulnerabilityParts.join(' | ');
    const disabilityTypes = disabilityLabels.join(', ');

    const houseNo = (document.getElementById('form-ben-house-no')?.value || '').trim();
    const moo = (document.getElementById('form-ben-moo')?.value || '').trim();
    const road = (document.getElementById('form-ben-road')?.value || '').trim();
    const subdistrict = (document.getElementById('form-ben-subdistrict')?.value || 'ตันหยงมัส').trim();
    const district = (document.getElementById('form-ben-district')?.value || 'ระแงะ').trim();
    const province = (document.getElementById('form-ben-province')?.value || 'นราธิวาส').trim();

    const addressParts = [];
    if (houseNo) addressParts.push(houseNo);
    if (moo) addressParts.push(/^(หมู่|ม\.)/.test(moo) ? moo : `หมู่ ${moo}`);
    if (road) addressParts.push(/^(ถ\.|ถนน|ซ\.|ซอย)/.test(road) ? road : `ถ.${road}`);
    if (subdistrict) addressParts.push(/^(ต\.|ตำบล)/.test(subdistrict) ? subdistrict : `ต.${subdistrict}`);
    if (district) addressParts.push(/^(อ\.|อำเภอ)/.test(district) ? district : `อ.${district}`);
    if (province) addressParts.push(/^(จ\.|จังหวัด)/.test(province) ? province : `จ.${province}`);
    const fullAddress = addressParts.join(' ');

    const data = {
      id: document.getElementById('form-ben-id').value || null,
      communityId: user.role === 'committee' ? user.communityId : document.getElementById('form-ben-community').value,
      prefix: document.getElementById('form-ben-prefix').value,
      firstName: document.getElementById('form-ben-firstname').value,
      lastName: document.getElementById('form-ben-lastname').value,
      age: parseInt(document.getElementById('form-ben-age').value, 10) || 0,
      cidMasked: this.formatThaiId(document.getElementById('form-ben-cid').value),
      phone: this.formatThaiPhone(document.getElementById('form-ben-phone').value),
      address: fullAddress,
      lat: parseFloat(document.getElementById('form-ben-lat').value) || TMCARE_CONFIG.MAP_CENTER.lat,
      lng: parseFloat(document.getElementById('form-ben-lng').value) || TMCARE_CONFIG.MAP_CENTER.lng,
      adlScore: parseInt(document.getElementById('form-ben-adl').value, 10) || 0,
      vulnerabilityType,
      disabilityTypes,
      chronicDiseases: document.getElementById('form-ben-chronic').value,
      drugAllergies: document.getElementById('form-ben-allergies').value,
      medicalDevices: document.getElementById('form-ben-devices').value,
      hospitalRef: document.getElementById('form-ben-hospital').value,
      caregiverName: document.getElementById('form-ben-caregiver-name').value,
      caregiverPhone: this.formatThaiPhone(document.getElementById('form-ben-caregiver-phone').value)
    };

    try {
      await apiService.saveBeneficiary(data);
      await this.showAlert("บันทึกสำเร็จ", "บันทึกข้อมูลผู้พิการ/กลุ่มเปราะบางเรียบร้อยแล้ว", "success");
      this.closeModal('modal-beneficiary');
      await this.renderBeneficiaries();
    } catch (err) {
      this.showAlert("บันทึกไม่สำเร็จ", err.message, "error");
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
      await this.showAlert("บันทึกสำเร็จ", "บันทึกประวัติการเยี่ยมบ้านเรียบร้อยแล้ว", "success");
      this.closeModal('modal-visit');
    } catch (err) {
      this.showAlert("บันทึกไม่สำเร็จ", err.message, "error");
    }
  },

  // ----------------------------------------------------
  // 4. WELFARE CONTROLLER
  // ----------------------------------------------------
  showWelfareSkeleton() {
    const container = document.getElementById('welfare-list');
    if (!container) return;
    container.innerHTML = Array(4).fill(0).map(() => `
      <div class="skeleton-card space-y-3">
        <div class="flex items-start justify-between">
          <div class="space-y-2 w-2/3">
            <div class="skeleton-box w-24 h-4"></div>
            <div class="skeleton-text w-3/4"></div>
            <div class="skeleton-text w-1/2"></div>
          </div>
          <div class="skeleton-badge"></div>
        </div>
        <div class="skeleton-box h-16 w-full"></div>
      </div>
    `).join('');
  },

  async renderWelfare() {
    this.showWelfareSkeleton();
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

      // Action for officer / executive (approve/deliver) and officer-only (edit/delete)
      const isOfficer = user && user.role === 'officer';
      const actionButtons = [];
      if (user.role !== 'committee') {
        if (item.status === 'requested') {
          actionButtons.push(`
            <button onclick="app.handleUpdateWelfareStatus('${item.id}', 'approved')" class="touch-btn bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              อนุมัติคำร้อง
            </button>
          `);
        } else if (item.status === 'approved') {
          actionButtons.push(`
            <button onclick="app.handleUpdateWelfareStatus('${item.id}', 'delivered')" class="touch-btn bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition">
              บันทึกการส่งมอบแล้ว
            </button>
          `);
        }
      }
      if (isOfficer) {
        actionButtons.unshift(`
          <button onclick="app.openEditWelfareModal('${item.id}')" class="touch-btn bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1">
            <i class="fa-solid fa-pen-to-square"></i> แก้ไข
          </button>
          <button onclick="app.handleDeleteWelfare('${item.id}')" class="touch-btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1">
            <i class="fa-solid fa-trash-can"></i> ลบ
          </button>
        `);
      }
      const officerActions = actionButtons.join('');

      const typeLabelsMap = {
        diaper: 'ผ้าอ้อมผู้ใหญ่ / แผ่นรองซับ (สปสช.)',
        equipment: 'กายอุปกรณ์ (รถเข็นนั่งวีลแชร์ / ไม้เท้า / เตียงลม)',
        relief_bag: 'ถุงยังชีพ / ข้าวสารอาหารแห้งฉุกเฉิน',
        home_repair: 'ปรับปรุงสภาพแวดล้อมที่อยู่อาศัย / ทางลาด',
        allowance: 'เงินสงเคราะห์ผู้มีรายได้น้อย / กองทุนฟื้นฟูฯ'
      };
      const requestTypeLabel = typeLabelsMap[item.requestType] || item.requestType || '-';

      const formattedRequestDate = this.formatThaiDateTime(item.requestDate);
      const formattedDeliveryDate = item.deliveryDate ? this.formatThaiDateTime(item.deliveryDate) : '';

      return `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2 text-xs">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded">${comName}</span>
              <h4 class="font-bold text-slate-800 text-sm mt-1">${item.itemDetail}</h4>
              <p class="text-slate-500 text-xs">ลูกบ้าน: <strong class="text-slate-700">${benName}</strong></p>
            </div>
            ${statusBadge}
          </div>

          <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 space-y-1">
            <div><strong>ประเภทที่ขอรับ:</strong> <span class="text-emerald-700 font-medium">${requestTypeLabel}</span></div>
            <div><strong>ผู้ส่งคำร้อง:</strong> ${item.requestedBy || '-'} (วันที่ ${formattedRequestDate})</div>
            <div><strong>จำนวน/งบประมาณ:</strong> ${item.amount || '-'}</div>
            <div><strong>เหตุผลความจำเป็น:</strong> ${item.notes || '-'}</div>
            ${formattedDeliveryDate ? `<div class="text-emerald-700 font-semibold"><strong>วันที่ส่งมอบ:</strong> ${formattedDeliveryDate}</div>` : ''}
          </div>

          ${officerActions ? `<div class="pt-2 flex flex-wrap justify-end gap-2 border-t border-slate-100">${officerActions}</div>` : ''}
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

  formatThaiDateTime(dateInput) {
    if (!dateInput) return '-';
    const raw = String(dateInput).trim();
    if (!raw) return '-';

    // กรณีเป็นวันที่อย่างเดียว (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toLocaleDateString('th-TH', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    return parsed.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';
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
    const welfareIdInput = document.getElementById('welfare-id');
    if (welfareIdInput) welfareIdInput.value = '';
    const modalTitle = document.getElementById('modal-welfare-title');
    if (modalTitle) modalTitle.textContent = 'ยื่นคำร้องขอสวัสดิการ / กายอุปกรณ์';
    document.querySelectorAll('input[name="welfare-type-opt"]').forEach(chk => { chk.checked = false; });
    const otherChk = document.getElementById('welfare-type-other-chk');
    if (otherChk) otherChk.checked = false;
    this.toggleWelfareOtherInput();
    this.openModal('modal-welfare');
  },

  async openEditWelfareModal(recordId) {
    const user = apiService.getCurrentUser();
    if (!user || user.role !== 'officer') {
      await this.showAlert("ไม่มีสิทธิ์แก้ไข", "เฉพาะเจ้าหน้าที่กองสวัสดิการสังคมเท่านั้นที่สามารถแก้ไขคำร้องได้", "warning");
      return;
    }

    const records = await apiService.getWelfareRecords();
    const record = records.find(r => r.id === recordId);
    if (!record) {
      await this.showAlert("ไม่พบข้อมูล", "ไม่พบคำร้องสวัสดิการที่ต้องการแก้ไข", "error");
      return;
    }

    await this.openNewWelfareModal();

    const modalTitle = document.getElementById('modal-welfare-title');
    if (modalTitle) modalTitle.textContent = 'แก้ไขคำร้องขอสวัสดิการ / กายอุปกรณ์';
    const welfareIdInput = document.getElementById('welfare-id');
    if (welfareIdInput) welfareIdInput.value = record.id || '';

    const benSelect = document.getElementById('welfare-ben-select');
    if (benSelect) benSelect.value = record.beneficiaryId || '';

    const typeLabelsMap = {
      diaper: 'ผ้าอ้อมผู้ใหญ่ / แผ่นรองซับ (สปสช.)',
      equipment: 'กายอุปกรณ์ (รถเข็นนั่งวีลแชร์ / ไม้เท้า / เตียงลม)',
      relief_bag: 'ถุงยังชีพ / ข้าวสารอาหารแห้งฉุกเฉิน',
      home_repair: 'ปรับปรุงสภาพแวดล้อมที่อยู่อาศัย / ทางลาด',
      allowance: 'เงินสงเคราะห์ผู้มีรายได้น้อย / กองทุนฟื้นฟูฯ'
    };
    const rawTypes = (record.requestType || '').split(',').map(s => s.trim()).filter(Boolean);
    const otherTexts = [];

    document.querySelectorAll('input[name="welfare-type-opt"]').forEach(chk => {
      const matched = rawTypes.some(t => t === chk.value || typeLabelsMap[t] === chk.value);
      chk.checked = matched;
    });

    const checkboxValues = Array.from(document.querySelectorAll('input[name="welfare-type-opt"]')).map(c => c.value);
    rawTypes.forEach(t => {
      const mapped = typeLabelsMap[t] || t;
      if (t.startsWith('อื่น ๆ:')) {
        otherTexts.push(t.replace(/^อื่น ๆ:\s*/, '').trim());
      } else if (!checkboxValues.includes(mapped)) {
        otherTexts.push(mapped);
      }
    });

    const otherChk = document.getElementById('welfare-type-other-chk');
    const otherInput = document.getElementById('welfare-type-other-text');
    if (otherTexts.length > 0 && otherChk) {
      otherChk.checked = true;
      this.toggleWelfareOtherInput();
      if (otherInput) otherInput.value = otherTexts.join(', ');
    }

    document.getElementById('welfare-item-detail').value = record.itemDetail || '';
    const amountInput = document.getElementById('welfare-amount');
    if (amountInput) amountInput.value = (record.amount && record.amount !== '-') ? record.amount : '';
    document.getElementById('welfare-notes').value = record.notes || '';
  },

  async handleDeleteWelfare(recordId) {
    const user = apiService.getCurrentUser();
    if (!user || user.role !== 'officer') {
      await this.showAlert("ไม่มีสิทธิ์ลบ", "เฉพาะเจ้าหน้าที่กองสวัสดิการสังคมเท่านั้นที่สามารถลบคำร้องได้", "warning");
      return;
    }

    const confirmed = await this.showConfirm(
      "ยืนยันการลบคำร้อง",
      "ต้องการลบคำร้องขอสวัสดิการนี้ใช่หรือไม่? (ไม่สามารถกู้คืนได้)",
      "ลบคำร้อง",
      "ยกเลิก",
      "warning"
    );
    if (!confirmed) return;

    try {
      await apiService.deleteWelfareRecord(recordId);
      await this.showAlert("ลบคำร้องสำเร็จ", "ลบรายการคำร้องขอสวัสดิการเรียบร้อยแล้ว", "success");
      await this.renderWelfare();
    } catch (err) {
      this.showAlert("ลบไม่สำเร็จ", err.message, "error");
    }
  },

  toggleWelfareOtherInput() {
    const otherChk = document.getElementById('welfare-type-other-chk');
    const otherBox = document.getElementById('welfare-type-other-box');
    const otherInput = document.getElementById('welfare-type-other-text');
    if (!otherChk || !otherBox) return;
    if (otherChk.checked) {
      otherBox.classList.remove('hidden');
      if (otherInput) otherInput.focus();
    } else {
      otherBox.classList.add('hidden');
      if (otherInput) otherInput.value = '';
    }
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

    const selectedTypes = Array.from(document.querySelectorAll('input[name="welfare-type-opt"]:checked'))
      .map(el => el.value);

    const otherChk = document.getElementById('welfare-type-other-chk');
    if (otherChk && otherChk.checked) {
      const otherText = (document.getElementById('welfare-type-other-text')?.value || '').trim();
      if (!otherText) {
        await this.showAlert("กรุณาระบุข้อมูลเพิ่มเติม", "กรุณากรอกรายละเอียดประเภทสวัสดิการในช่อง 'อื่น ๆ'", "warning");
        document.getElementById('welfare-type-other-text')?.focus();
        return;
      }
      selectedTypes.push(`อื่น ๆ: ${otherText}`);
    }

    if (selectedTypes.length === 0) {
      await this.showAlert("กรุณาเลือกประเภทสวัสดิการ", "กรุณาเลือกประเภทสวัสดิการที่ขอรับอย่างน้อย 1 รายการ", "warning");
      return;
    }

    const editId = (document.getElementById('welfare-id')?.value || '').trim();
    const currentUser = apiService.getCurrentUser();
    const recordData = {
      ...(editId ? { id: editId } : {}),
      beneficiaryId: benId,
      communityId: ben.communityId,
      requestType: selectedTypes.join(', '),
      itemDetail: document.getElementById('welfare-item-detail').value,
      amount: (document.getElementById('welfare-amount')?.value || '').trim() || '-',
      notes: document.getElementById('welfare-notes').value,
      ...(editId ? {} : {
        requestedBy: currentUser ? (currentUser.fullName || currentUser.role) : '-',
        status: "requested"
      })
    };

    try {
      await apiService.saveWelfareRecord(recordData);
      await this.showAlert(
        editId ? "แก้ไขคำร้องสำเร็จ" : "ยื่นคำร้องสำเร็จ",
        editId ? "บันทึกการแก้ไขคำร้องขอสวัสดิการเรียบร้อยแล้ว" : "ยื่นคำร้องขอสวัสดิการเรียบร้อยแล้ว กองสวัสดิการสังคมจะดำเนินการตรวจสอบต่อไป",
        "success"
      );
      this.closeModal('modal-welfare');
      await this.renderWelfare();
    } catch (err) {
      this.showAlert(editId ? "แก้ไขไม่สำเร็จ" : "ยื่นคำร้องไม่สำเร็จ", err.message, "error");
    }
  },

  async handleUpdateWelfareStatus(recordId, status) {
    try {
      const deliveryDate = status === 'delivered' ? new Date().toISOString().split('T')[0] : null;
      await apiService.updateWelfareStatus(recordId, status, deliveryDate);
      await this.showAlert("อัปเดตสำเร็จ", "ปรับปรุงสถานะคำร้องเรียบร้อยแล้ว", "success");
      await this.renderWelfare();
    } catch (err) {
      this.showAlert("ดำเนินการไม่สำเร็จ", err.message, "error");
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

    // ดึงรายชื่อกลุ่มเปราะบางและสถานะภัยพิบัติล่าสุด
    const beneficiaries = await apiService.getBeneficiaries();
    const statuses = await apiService.getDisasterStatuses();

    beneficiaries.forEach(b => {
      if (!b.lat || !b.lng) return;

      const statusItem = statuses.find(s => s.beneficiaryId === b.id);
      const customIcon = this.createMapPinIcon(b, statusItem);

      L.marker([b.lat, b.lng], { icon: customIcon })
        .bindPopup(this.createMapPopupContent(b, statusItem), { maxWidth: 300, minWidth: 260 })
        .addTo(this.disasterMarkersLayer);
    });

    // Fit Bounds หากมีหมุด
    setTimeout(() => {
      if (this.disasterMap) this.disasterMap.invalidateSize();
    }, 200);
  },

  // สร้างไอคอนหมุดแผนที่พร้อมสัญลักษณ์สถานะ EMS/ภัยพิบัติ (ใช้ร่วมกันทั้ง Dashboard และ Disaster Map)
  createMapPinIcon(b, statusItem = null) {
    const evacStatus = statusItem ? statusItem.evacStatus : 'safe_at_home';

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

    let statusBadgeHtml = '<span class="pin-status-badge pin-badge-safe" title="ปลอดภัยอยู่ที่บ้าน"><i class="fa-solid fa-house"></i></span>';
    if (evacStatus === 'need_evacuation') {
      statusBadgeHtml = '<span class="pin-status-badge pin-badge-evac" title="ต้องการอพยพ"><i class="fa-solid fa-person-running"></i></span>';
    } else if (evacStatus === 'need_help') {
      statusBadgeHtml = '<span class="pin-status-badge pin-badge-help" title="ขอความช่วยเหลือ"><i class="fa-solid fa-triangle-exclamation"></i></span>';
    } else if (evacStatus === 'evacuated') {
      statusBadgeHtml = '<span class="pin-status-badge pin-badge-evacuated" title="อพยพแล้ว"><i class="fa-solid fa-check"></i></span>';
    }

    const iconHtml = `
      <div class="map-pin-marker">
        <div class="map-pin-body ${pinClass}">
          <i class="${iconClass}"></i>
        </div>
        ${statusBadgeHtml}
        ${pulseHtml}
      </div>
    `;

    return L.divIcon({
      className: 'custom-leaflet-div-icon',
      html: iconHtml,
      iconSize: [34, 42],
      iconAnchor: [17, 42],
      popupAnchor: [0, -40]
    });
  },

  // สร้าง Card Popup บนแผนที่ สวยงาม สีเดียวชัดเจน และเป็นระเบียบ
  createMapPopupContent(b, statusItem = null) {
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
              <a href="tel:${this.getCleanPhoneForTel(b.caregiverPhone)}" class="text-rose-600 font-bold underline"><i class="fa-solid fa-phone text-[10px] mr-1"></i>${this.formatThaiPhone(b.caregiverPhone)}</a>
            </div>` : ''}
            ${(() => {
              const ev = statusItem ? statusItem.evacStatus : 'safe_at_home';
              const detail = statusItem && statusItem.needsDetail && statusItem.needsDetail !== '-' ? `: ${statusItem.needsDetail}` : '';
              const statusMap = {
                safe_at_home: { cls: 'bg-slate-100 text-slate-700 border-slate-200', label: '🏠 ปลอดภัยอยู่ที่บ้าน' },
                need_help: { cls: 'bg-red-50 text-red-800 border-red-200', label: '⚠️ ขอความช่วยเหลือ' },
                need_evacuation: { cls: 'bg-orange-50 text-orange-800 border-orange-200', label: '🚨 ต้องการอพยพ' },
                evacuated: { cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: '✅ อพยพถึงศูนย์แล้ว' }
              };
              const cfg = statusMap[ev] || statusMap.safe_at_home;
              return `
                <div class="pt-1 border-t border-slate-200/70">
                  <div class="${cfg.cls} border rounded-lg px-2 py-1 font-semibold">
                    ${cfg.label}${detail}
                  </div>
                </div>
              `;
            })()}
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
    let countNeedEvac = 0;
    let countSafe = 0;
    let countEvacuated = 0;

    beneficiaries.forEach(b => {
      const st = statuses.find(s => s.beneficiaryId === b.id);
      const ev = st ? st.evacStatus : 'safe_at_home';
      if (ev === 'need_help') countNeedHelp++;
      else if (ev === 'need_evacuation') countNeedEvac++;
      else if (ev === 'evacuated') countEvacuated++;
      else countSafe++;
    });

    const elTotal = document.getElementById('evac-count-total');
    const elNeed = document.getElementById('evac-count-needhelp');
    const elNeedEvac = document.getElementById('evac-count-needevac');
    const elSafe = document.getElementById('evac-count-safe');
    const elEvac = document.getElementById('evac-count-evacuated');

    if (elTotal) elTotal.textContent = `${countTotal} ราย`;
    if (elNeed) elNeed.textContent = `${countNeedHelp} ราย`;
    if (elNeedEvac) elNeedEvac.textContent = `${countNeedEvac} ราย`;
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
          const triageBadge = b.triageLevel === 'red' ? '🔴 ติดเตียง' : (b.triageLevel === 'yellow' ? '🟡 ติดบ้าน' : '🟢 ติดสังคม');
          const triageColor = b.triageLevel === 'red' ? 'text-red-600 font-bold' : (b.triageLevel === 'yellow' ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium');

          let evacLabel = '';
          if (statusItem.evacStatus === 'safe_at_home') {
            evacLabel = '<span class="inline-flex items-center whitespace-nowrap bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px]">🏠 ปลอดภัย</span>';
          } else if (statusItem.evacStatus === 'need_help') {
            evacLabel = '<span class="inline-flex items-center whitespace-nowrap bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-md text-[10px] animate-pulse">⚠️ ขอช่วยเหลือ</span>';
          } else if (statusItem.evacStatus === 'need_evacuation') {
            evacLabel = '<span class="inline-flex items-center whitespace-nowrap bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-md text-[10px] animate-pulse">🚨 ต้องการอพยพ</span>';
          } else if (statusItem.evacStatus === 'evacuated') {
            evacLabel = '<span class="inline-flex items-center whitespace-nowrap bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md text-[10px]">✅ อพยพแล้ว</span>';
          }

          const fullNameText = `${b.prefix || ''}${b.firstName || ''} ${b.lastName || ''}`.trim();
          const tr = document.createElement('tr');
          tr.className = "hover:bg-slate-50 transition";
          tr.innerHTML = `
            <td class="py-2.5 px-2.5 align-middle">
              <div class="font-bold text-slate-800 truncate" title="${fullNameText}">${fullNameText}</div>
              <div class="text-[11px] text-slate-500 truncate" title="${b.address || '-'}">${b.address || '-'}</div>
            </td>
            <td class="py-2.5 px-2 text-rose-800 align-middle">
              <div class="truncate whitespace-nowrap" title="${comName}">${comName}</div>
            </td>
            <td class="py-2.5 px-1.5 text-center align-middle whitespace-nowrap text-[11px] ${triageColor}">${triageBadge}</td>
            <td class="py-2.5 px-2 align-middle whitespace-nowrap">${evacLabel}</td>
            <td class="py-2.5 px-2 text-slate-600 align-middle truncate" title="${statusItem.needsDetail || '-'}">
              ${statusItem.needsDetail || '-'}
            </td>
            <td class="py-2.5 px-1.5 text-center align-middle">
              <div class="flex items-center justify-center gap-1 whitespace-nowrap">
                <button onclick="app.quickSetEvac('${b.id}', 'safe_at_home')" title="ปลอดภัยที่บ้าน" class="whitespace-nowrap shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-1 rounded-md text-[10px] transition">
                  🏠 ปลอดภัย
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'need_help')" title="ขอความช่วยเหลือ/เรือ" class="whitespace-nowrap shrink-0 bg-red-500 hover:bg-red-600 text-white px-1.5 py-1 rounded-md text-[10px] font-bold transition">
                  ⚠️ ขอช่วย
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'need_evacuation')" title="ต้องการอพยพ" class="whitespace-nowrap shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-1.5 py-1 rounded-md text-[10px] font-bold transition">
                  🚨 ต้องการอพยพ
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'evacuated')" title="อพยพแล้ว" class="whitespace-nowrap shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-1.5 py-1 rounded-md text-[10px] transition">
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
          } else if (statusItem.evacStatus === 'need_evacuation') {
            evacLabel = '<span class="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[11px] animate-pulse">🚨 ต้องการอพยพ</span>';
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
                  ${b.caregiverPhone ? `<a href="tel:${this.getCleanPhoneForTel(b.caregiverPhone)}" class="text-rose-600 font-bold underline"><i class="fa-solid fa-phone mr-1"></i>โทรหาผู้ดูแล</a>` : ''}
                </div>
              </div>

              <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span class="text-slate-500 text-[11px]">สถานะ:</span>
                ${evacLabel}
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-xs">
                <button onclick="app.quickSetEvac('${b.id}', 'safe_at_home')" class="touch-btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-1 rounded-lg text-center flex flex-col items-center">
                  <span class="text-xs">🏠</span>
                  <span class="text-[10px]">ปลอดภัย</span>
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'need_help')" class="touch-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-1 rounded-lg text-center flex flex-col items-center shadow-sm">
                  <span class="text-xs">⚠️</span>
                  <span class="text-[10px]">ขอช่วย/เรือ</span>
                </button>
                <button onclick="app.quickSetEvac('${b.id}', 'need_evacuation')" class="touch-btn bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 px-1 rounded-lg text-center flex flex-col items-center shadow-sm">
                  <span class="text-xs">🚨</span>
                  <span class="text-[10px]">ต้องการอพยพ</span>
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
      detail = await this.showPrompt("ระบุสิ่งที่ต้องการช่วยเหลือเร่งด่วน", "ต้องการเรือและรถพยาบาลเคลื่อนย้ายผู้ป่วยติดเตียง", "เช่น ต้องการเรือท้องแบน, ออกซิเจนสำรอง, อาหาร");
      if (detail === null) return;
    } else if (status === 'need_evacuation') {
      detail = await this.showPrompt("ระบุรายละเอียดการอพยพ / จุดรับตัว", "ต้องการรถ/เรือช่วยอพยพด่วน", "เช่น มีผู้ป่วยติดเตียง ต้องใช้เปลเคลื่อนย้าย");
      if (detail === null) return;
    } else if (status === 'evacuated') {
      detail = await this.showPrompt("ระบุสถานที่อพยพไปพักพิง", "ศูนย์พักพิงชั่วคราว ทต.ตันหยงมัส", "ระบุชื่อศูนย์พักพิงหรือบ้านญาติ");
      if (detail === null) return;
    }

    try {
      await apiService.updateDisasterStatus(beneficiaryId, status, detail, status === 'evacuated' ? detail : '-');
      await this.initLeafletMap();
      if (this.dashboardMap) {
        await this.renderDashboardMap();
      }
      await this.renderDisasterChecklist();
      const stats = await apiService.getDashboardStats();
      const bannerCount = document.getElementById('banner-need-help-count');
      if (bannerCount) bannerCount.textContent = `${stats.needEvacHelp} ราย`;
    } catch (err) {
      this.showAlert("อัปเดตไม่สำเร็จ", err.message, "error");
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
        <div class="text-slate-600"><strong>เลขประจำตัวประชาชน:</strong> <span class="font-semibold text-slate-800">${this.formatThaiId(b.cidMasked) || '-'}</span></div>
        <div class="text-slate-600"><strong>ที่อยู่:</strong> ${b.address}</div>
        <div class="text-slate-600"><strong>เบอร์โทรลูกบ้าน:</strong> ${b.phone ? `<a href="tel:${this.getCleanPhoneForTel(b.phone)}" class="text-rose-600 font-semibold underline">${this.formatThaiPhone(b.phone)}</a>` : '-'}</div>
      </div>

      <div class="bg-red-50 p-3 rounded-xl border border-red-200 text-red-950 space-y-1">
        <div><strong>🚨 โรคประจำตัว:</strong> ${b.chronicDiseases || '-'}</div>
        <div><strong>⚠️ ประวัติแพ้ยา:</strong> <span class="font-bold underline text-red-700">${b.drugAllergies || 'ไม่มีข้อมูล'}</span></div>
        <div><strong>⚡ อุปกรณ์พยุงชีพ:</strong> <span class="font-bold text-red-700">${b.medicalDevices || 'ไม่มี'}</span></div>
        <div><strong>🏥 โรงพยาบาลประจำ:</strong> ${b.hospitalRef || 'รพ.ระแงะ'}</div>
      </div>

      <div class="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-950 space-y-1">
        <div><strong>ผู้ดูแลหลัก (Caregiver):</strong> ${b.caregiverName || '-'}</div>
        <div><strong>เบอร์โทรผู้ดูแล:</strong> ${b.caregiverPhone ? `<a href="tel:${this.getCleanPhoneForTel(b.caregiverPhone)}" class="text-rose-700 font-bold underline">${this.formatThaiPhone(b.caregiverPhone)}</a>` : '-'}</div>
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
🪪 เลข ปชช.: ${this.maskThaiIdForShare(b.cidMasked) || '-'}
📍 ชุมชน: ${comName}
🏠 ที่อยู่: ${b.address}
🔴 ระดับ Triage: ${b.triageLevel === 'red' ? 'สีแดง (ติดเตียง/วิกฤต)' : 'สีเหลือง'}
⚠️ ภาวะ/โรคประจำตัว: ${b.chronicDiseases || '-'}
⚡ อุปกรณ์พยุงชีพ: ${b.medicalDevices || 'ไม่มี'}
🚫 ประวัติแพ้ยา: ${b.drugAllergies || 'ไม่มี'}
📞 เบอร์ผู้ดูแล: ${this.formatThaiPhone(b.caregiverPhone) || this.formatThaiPhone(b.phone) || '-'} (${b.caregiverName || 'ญาติ'})
🗺️ พิกัดนำทาง Google Maps:
${mapLink}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        this.showAlert("คัดลอกข้อมูลฉุกเฉินสำเร็จ", "คัดลอกข้อมูลและพิกัด Google Maps เรียบร้อยแล้ว สามารถนำไปวาง (Paste) ในกลุ่ม LINE กู้ชีพหรือศูนย์บรรเทาสาธารณภัยได้ทันที", "success");
      });
    } else {
      this.showPrompt("คัดลอกข้อความด้านล่างนี้", textToCopy);
    }
  },

  // ----------------------------------------------------
  // 7. SETTINGS MODAL
  // ----------------------------------------------------
  openSettingsModal() {
    const provider = apiService.getProvider();
    const gasUrl = gasDriver.getApiUrl() || '';
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

  async handleSaveSettings(e) {
    e.preventDefault();
    const provider = document.getElementById('settings-provider').value;
    const gasUrl = document.getElementById('settings-gas-url').value.trim();
    const supaUrl = document.getElementById('settings-supa-url').value.trim();
    const supaKey = document.getElementById('settings-supa-key').value.trim();

    localStorage.setItem('tmcare_provider', provider);
    localStorage.setItem('tmcare_gas_url', gasUrl);
    localStorage.setItem('tmcare_supabase_url', supaUrl);
    localStorage.setItem('tmcare_supabase_key', supaKey);

    await this.showAlert("บันทึกการตั้งค่าเรียบร้อยแล้ว", "ระบบจะทำการรีโหลดหน้าเว็บเพื่อใช้การตั้งค่าใหม่", "success");
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
      const startTime = Date.now();
      const res = await gasDriver.testConnection(url);
      const latencyMs = Date.now() - startTime;
      if (res && res.success) {
        resultBox.className = "text-xs p-2.5 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-800";
        resultBox.innerHTML = `<i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i> <strong>เชื่อมต่อสำเร็จ!</strong> ฐานข้อมูล: ${res.databaseName || res.appName || 'TMCare GAS'} (ความเร็วตอบกลับ ${res.latencyMs || latencyMs} ms)`;
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
    if (await this.showConfirm("ล้างข้อมูลแคชและซิงค์ใหม่", "ต้องการล้างข้อมูลแคชในเบราว์เซอร์ และดึงข้อมูลใหม่ล่าสุดจาก Google Sheets หรือไม่?", "ล้างแคชและซิงค์", "ยกเลิก", "warning")) {
      try {
        await apiService.clearCacheAndSync();
        await this.showAlert("ซิงค์ข้อมูลสำเร็จ", "ล้างแคชและเตรียมพร้อมซิงค์ข้อมูลใหม่เรียบร้อยแล้ว", "success");
        window.location.reload();
      } catch (err) {
        this.showAlert("การซิงค์ข้อมูลขัดข้อง", err.message, "error");
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
                <img src="assets/logo.png" alt="ตราเทศบาลตำบลตันหยงมัส" style="width: 36px; height: 36px; object-fit: contain;">
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
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="assets/logo.png" alt="ตราเทศบาลตำบลตันหยงมัส" style="width: 32px; height: 32px; object-fit: contain;">
                <div>
                  <div style="font-size: 11pt; font-weight: 800; color: #0f172a;">
                    บัญชีรายชื่อผู้พิการและกลุ่มเปราะบาง (จำแนกตามระดับความเร่งด่วน Triage)
                  </div>
                  <div style="font-size: 8pt; color: #475569; margin-top: 1px;">
                    <strong>เทศบาลตำบลตันหยงมัส อ.ระแงะ จ.นราธิวาส</strong> | <strong>ขอบเขต:</strong> ${scopeLabel}
                  </div>
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
                      <div style="letter-spacing: -0.2px;">${this.formatThaiId(b.cidMasked) || '-'}</div>
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
                      <div style="font-weight: 700; color: #e11d48; font-size: 6.5pt;">${this.formatThaiPhone(b.caregiverPhone) || '-'}</div>
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
  // FORMATTERS: THAI ID & PHONE NUMBERS
  // ----------------------------------------------------
  formatThaiId(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    const str = String(raw).trim();
    if (!str) return '';
    if (/[xX]/.test(str)) return str;

    const digits = str.replace(/\D/g, '').slice(0, 13);
    if (!digits) return str;
    if (digits.length === 13) {
      return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
    }
    return str;
  },

  maskThaiIdForShare(raw) {
    const formatted = this.formatThaiId(raw);
    if (!formatted) return '';
    if (/[xX]/.test(formatted)) return formatted;
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 13) {
      return `${digits[0]}-${digits.slice(1, 5)}-xxxxx-${digits.slice(10, 12)}-${digits[12]}`;
    }
    return formatted;
  },

  getCleanPhoneForTel(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    // กู้คืนเลข 0 นำหน้ากรณี Google Sheets แปลงเป็นตัวเลขแล้วตัด 0 ออก
    if (digits.length === 9 && /^[689]/.test(digits)) {
      digits = '0' + digits;
    } else if (digits.length === 8 && /^[2-7]/.test(digits)) {
      digits = '0' + digits;
    }
    return digits;
  },

  formatThaiPhone(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    const digits = this.getCleanPhoneForTel(raw);
    if (!digits) return String(raw).trim();
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    if (digits.length === 9) {
      if (digits.startsWith('02')) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5, 9)}`;
      }
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
    }
    return digits;
  },

  handleCidInput(input) {
    if (!input) return;
    if (/[xX]/.test(input.value)) return;
    const digits = input.value.replace(/\D/g, '').slice(0, 13);
    let formatted = digits;
    if (digits.length > 12) {
      formatted = `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
    } else if (digits.length > 10) {
      formatted = `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10)}`;
    } else if (digits.length > 5) {
      formatted = `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5)}`;
    } else if (digits.length > 1) {
      formatted = `${digits[0]}-${digits.slice(1)}`;
    }
    input.value = formatted;
  },

  handlePhoneInput(input) {
    if (!input) return;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    input.value = formatted;
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
  },

  // ----------------------------------------------------
  // SWEETALERT2 NOTIFICATION HELPERS
  // ----------------------------------------------------
  showAlert(title, text = '', icon = 'info') {
    if (typeof Swal !== 'undefined') {
      return Swal.fire({
        title,
        text,
        icon,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#e11d48',
        customClass: { popup: 'rounded-2xl' }
      });
    }
    alert(text ? `${title}\n${text}` : title);
    return Promise.resolve();
  },

  async showConfirm(title, text = '', confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', icon = 'question') {
    if (typeof Swal !== 'undefined') {
      const result = await Swal.fire({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        customClass: { popup: 'rounded-2xl' }
      });
      return !!result.isConfirmed;
    }
    return confirm(text ? `${title}\n${text}` : title);
  },

  async showPrompt(title, inputValue = '', inputPlaceholder = '') {
    if (typeof Swal !== 'undefined') {
      const result = await Swal.fire({
        title,
        input: 'text',
        inputValue,
        inputPlaceholder,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        customClass: { popup: 'rounded-2xl' }
      });
      return result.isConfirmed ? (result.value ?? '') : null;
    }
    return prompt(title, inputValue);
  }
};

// Bind to window for Leaflet HTML popups and inline onclick events
window.app = app;

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

