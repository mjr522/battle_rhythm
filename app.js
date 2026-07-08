// ==========================================
// STATE VARIABLES & CONFIG
// ==========================================
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PERIODS = ["Early", "Mid", "Late"];

let columns = ['Ops', 'Curriculum', 'Lab', 'XO'];
let visibleColumns = ['Ops', 'Curriculum', 'Lab', 'XO'];
let tasks = [];

// Horizon configuration
let horizonMonths = 3; // 3, 6, or 12
let activeRangeStart = new Date(2026, 5, 1);  // Default starting June 2026
let activeRangeEnd = new Date(2026, 8, 1);    // Default ending September 2026

let searchQuery = '';
let isRendering = false;

// Briefing Mode: 'full' (POC/Team view showing all tasks) vs 'staff' (Briefing mode showing only isStaffView === true tasks)
let briefingMode = 'full'; 

// Sync Mode
let isSharedJSONMode = false;

// ==========================================
// INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // Bind Search input safely
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderGrid();
    });
  }

  // Close dropdowns on outer click safely
  window.addEventListener('click', (e) => {
    const dropdownMenu = document.getElementById('actions-dropdown-menu');
    if (dropdownMenu && !e.target.closest('#actions-dropdown-container')) {
      dropdownMenu.classList.add('hidden');
    }
  });

  // Bind scroll for infinite timeline loading safely
  const scrollContainer = document.getElementById('board-scroll-container');
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', handleBoardScroll);
  }

  // Initialize UI & load data
  loadInitialData();
});

// ==========================================
// DATA INGESTION: OPTION 1 SHARED JSON + LOCAL STORAGE FALLBACK
// ==========================================
function loadInitialData() {
  const hasLocalData = localStorage.getItem('battle_rhythm_tasks_v3') !== null;

  if (hasLocalData) {
    console.log("Loading existing local database...");
    loadFromLocalStorage();
  } else {
    console.log("No local database found. Loading seed data...");
    loadSeedData(false);
  }

  isSharedJSONMode = false;
  updateSyncBadge("LOCAL STORAGE", "bg-slate-100 text-slate-700 border-slate-300");
  renderColumnFilters();
  setHorizonRange(3);
}

async function fetchMasterData() {
  try {
    const response = await fetch('./battle_rhythm_data.json');
    if (!response.ok) throw new Error("File not found");
    
    const data = await response.json();
    if (!data.columns || !data.tasks) throw new Error("Invalid schema");

    columns = data.columns;
    tasks = data.tasks;
    visibleColumns = data.visibleColumns || [...columns];
    isSharedJSONMode = true;

    saveToLocalStorage(); // Seed local storage with master file
    updateSyncBadge("SHARED JSON", "bg-emerald-100 text-emerald-800 border-emerald-300");
  } catch (err) {
    // Graceful fallback to LocalStorage if CORS block or file missing
    console.log("Shared JSON load failed: " + err.message + ". Falling back to local storage.");
    loadFromLocalStorage();
    
    if (tasks.length === 0) {
      loadSeedData(false);
    }
    
    isSharedJSONMode = false;
    updateSyncBadge("LOCAL STORAGE", "bg-slate-100 text-slate-700 border-slate-300");
  }

  renderColumnFilters();
  setHorizonRange(3); // Start with 3 Months fully fitted
}

async function pullLatestSharedJSON() {
  if (confirm("Reset current board data and pull the latest master JSON file from the server? This will clear any unsaved local edits.")) {
    localStorage.removeItem('battle_rhythm_tasks_v3');
    localStorage.removeItem('battle_rhythm_columns_v3');
    localStorage.removeItem('battle_rhythm_visible_v3');
    await fetchMasterData();
    alert("Board successfully synchronized with master JSON database!");
  }
}

function updateSyncBadge(label, classes) {
  const badge = document.getElementById('sync-mode-badge');
  if (badge) {
    badge.innerText = label;
    badge.className = `text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase shrink-0 ${classes}`;
  }
}

function saveToLocalStorage() {
  localStorage.setItem('battle_rhythm_tasks_v3', JSON.stringify(tasks));
  localStorage.setItem('battle_rhythm_columns_v3', JSON.stringify(columns));
  localStorage.setItem('battle_rhythm_visible_v3', JSON.stringify(visibleColumns));
  
  if (isSharedJSONMode) {
    updateSyncBadge("SHARED JSON (Local Edits)", "bg-amber-100 text-amber-800 border-amber-300");
  }
}

function loadFromLocalStorage() {
  const storedTasks = localStorage.getItem('battle_rhythm_tasks_v3');
  const storedCols = localStorage.getItem('battle_rhythm_columns_v3');
  const storedVis = localStorage.getItem('battle_rhythm_visible_v3');

  if (storedTasks) tasks = JSON.parse(storedTasks);
  if (storedCols) columns = JSON.parse(storedCols);
  if (storedVis) visibleColumns = JSON.parse(storedVis);
  else visibleColumns = [...columns];
}

function loadSeedData(showAlert = true) {
  columns = ['Ops', 'Curriculum', 'Lab', 'XO'];
  visibleColumns = ['Ops', 'Curriculum', 'Lab', 'XO'];

  tasks = [
    {
      id: 'seed-task-1',
      title: "Submit Master Schedule",
      owner: "Curriculum",
      poc: "Deputy for Curriculum",
      recurrenceType: "annual",
      period: "Early",
      months: ["October"],
      specificYear: null,
      trigger: "First week of October",
      notes: "Ensure lab equipment availability is verified before submission.",
      isStaffView: true
    },
    {
      id: 'seed-task-2',
      title: "Request New Billets",
      owner: "XO",
      poc: "Personnelist",
      recurrenceType: "annual",
      period: "Early",
      months: ["July"],
      specificYear: null,
      trigger: "First week of July",
      notes: "Include justifications for any new billets.",
      isStaffView: true
    },
    {
      id: 'seed-task-3',
      title: "Faculty Evaluations",
      owner: "Ops",
      poc: "Director of Operations",
      recurrenceType: "annual",
      period: "Mid",
      months: ["May"],
      specificYear: null,
      trigger: "By mid-May",
      notes: "Route through group commander.",
      isStaffView: false // less important, POC view only
    }
  ];

  saveToLocalStorage();
  renderColumnFilters();
  renderGrid();
  
  if (showAlert) {
    alert("Seed data loaded!");
  }
}

function clearAllData() {
  if (confirm("Clear all tasks and AOR columns?")) {
    tasks = [];
    columns = [];
    visibleColumns = [];
    saveToLocalStorage();
    renderColumnFilters();
    renderGrid();
  }
}

// ==========================================
// BRIEFING MODE CONTROLLER
// ==========================================
function setBriefingMode(mode) {
  briefingMode = mode;
  
  const btnStaff = document.getElementById('btn-briefing-staff');
  const btnFull = document.getElementById('btn-briefing-full');

  if (mode === 'staff') {
    btnStaff.className = "bg-white text-u-blue-600 px-2.5 py-1 text-[11px] font-extrabold rounded shadow-sm";
    btnFull.className = "text-u-blue-100 hover:text-white hover:bg-u-blue-500/30 px-2.5 py-1 text-[11px] font-semibold rounded";
  } else {
    btnStaff.className = "text-u-blue-100 hover:text-white hover:bg-u-blue-500/30 px-2.5 py-1 text-[11px] font-semibold rounded";
    btnFull.className = "bg-white text-u-blue-600 px-2.5 py-1 text-[11px] font-extrabold rounded shadow-sm";
  }

  renderGrid(true); // Keep scroll position when toggling views
}

// ==========================================
// INFINITE SCROLL SYSTEM
// ==========================================
function handleBoardScroll() {
  const main = document.getElementById('board-scroll-container');
  if (!main) return;
  if (main.scrollHeight <= main.clientHeight) return;
  
  // Load previous month on top scrolling
  if (main.scrollTop < 80) {
    main.removeEventListener('scroll', handleBoardScroll); // Temporary unbind to prevent layout race loops
    loadMorePreviousMonth();
  } 
  // Load next month on bottom scrolling
  else if (main.scrollHeight - main.scrollTop - main.clientHeight < 120) {
    main.removeEventListener('scroll', handleBoardScroll); // Temporary unbind to prevent layout race loops
    loadMoreNextMonth();
  }
}

function loadMorePreviousMonth() {
  activeRangeStart.setMonth(activeRangeStart.getMonth() - 1);
  
  const main = document.getElementById('board-scroll-container');
  const oldScrollHeight = main.scrollHeight;
  const oldScrollTop = main.scrollTop;

  renderGrid(true);

  // Position viewport scroll correctly after prepending months
  const newScrollHeight = main.scrollHeight;
  main.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
}

function loadMoreNextMonth() {
  activeRangeEnd.setMonth(activeRangeEnd.getMonth() + 1);
  renderGrid(true);
}

// ==========================================
// HORIZON SELECTORS (Range Setting & Zoom Height Fitting)
// ==========================================
function setHorizonRange(months) {
  horizonMonths = months;
  
  const baseYear = 2026;
  const baseMonthIdx = 6; // July

  if (months === 3) {
    activeRangeStart = new Date(baseYear, baseMonthIdx - 2, 1);
    activeRangeEnd = new Date(baseYear, baseMonthIdx + 4, 1);
  } else if (months === 6) {
    activeRangeStart = new Date(baseYear, baseMonthIdx - 3, 1);
    activeRangeEnd = new Date(baseYear, baseMonthIdx + 8, 1);
  } else if (months === 12) {
    activeRangeStart = new Date(baseYear, baseMonthIdx - 4, 1);
    activeRangeEnd = new Date(baseYear, baseMonthIdx + 19, 1);
  }

  [3, 6, 12].forEach(b => {
    const btn = document.getElementById(`btn-horizon-${b}`);
    if (b === months) {
      btn.className = "bg-white text-u-blue-600 px-2.5 py-1 text-[11px] font-extrabold rounded shadow-sm";
    } else {
      btn.className = "text-u-blue-100 hover:text-white hover:bg-u-blue-500/30 px-2.5 py-1 text-[11px] font-semibold rounded";
    }
  });

  renderGrid(false); // reset scroll to center today
  
  setTimeout(() => {
    if (months === 12) {
      focusOnMonthRow('July', 2026);
    } else {
      focusOnPeriodRow('July', 2026, 'Mid');
    }
  }, 100);
}

function shiftTimeframe(offset) {
  activeRangeStart.setMonth(activeRangeStart.getMonth() + offset);
  activeRangeEnd.setMonth(activeRangeEnd.getMonth() + offset);
  renderGrid(true);
}

function goToToday() {
  setHorizonRange(3);
}

function focusOnPeriodRow(monthName, year, period) {
  const rowId = `row-${monthName}-${year}-${period}`;
  const el = document.getElementById(rowId);
  if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function focusOnMonthRow(monthName, year) {
  const rowId = `row-${monthName}-${year}-Month`;
  const el = document.getElementById(rowId);
  if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function getTimelineRows() {
  const rows = [];
  let current = new Date(activeRangeStart.getFullYear(), activeRangeStart.getMonth(), 1);
  const end = new Date(activeRangeEnd.getFullYear(), activeRangeEnd.getMonth(), 1);

  const isCollapsed = (horizonMonths === 12);

  while (current <= end) {
    const monthName = MONTH_NAMES[current.getMonth()];
    const year = current.getFullYear();
    
    if (isCollapsed) {
      rows.push({ monthName, year, isCollapsed: true });
    } else {
      PERIODS.forEach(p => {
        rows.push({ monthName, year, period: p, isCollapsed: false });
      });
    }
    current.setMonth(current.getMonth() + 1);
  }
  return rows;
}

// ==========================================
// GRID RENDERING ENGINE
// ==========================================
function renderGrid(keepScroll = true) {
  isRendering = true;

  const main = document.getElementById('board-scroll-container');
  if (main) main.removeEventListener('scroll', handleBoardScroll); // Unbind scroll listener to prevent loop race events

  const savedScrollTop = main ? main.scrollTop : 0;

  const grid = document.getElementById('battle-rhythm-grid');
  const timelineRows = getTimelineRows();
  const numCols = visibleColumns.length;

  grid.style.gridTemplateColumns = `160px repeat(${numCols}, minmax(220px, 1fr))`;
  grid.innerHTML = '';

  let rowCellHeight = 65;
  if (horizonMonths === 3) rowCellHeight = 95;
  else if (horizonMonths === 6) rowCellHeight = 65;
  else if (horizonMonths === 12) rowCellHeight = 50;

  // 1. COLUMN HEADERS
  const cornerHeader = document.createElement('div');
  cornerHeader.className = "sticky top-0 left-0 z-30 bg-slate-100 border-b-2 border-r border-slate-300 p-2.5 text-[10px] font-black tracking-widest text-slate-500 uppercase text-center shadow-sm h-9 flex items-center justify-center select-none";
  cornerHeader.innerText = "Timeline";
  grid.appendChild(cornerHeader);

  visibleColumns.forEach(col => {
    const colHeader = document.createElement('div');
    colHeader.className = "sticky top-0 z-20 bg-white border-b-2 border-slate-300 p-2.5 text-[10px] font-black tracking-widest text-u-blue-600 uppercase flex items-center justify-between gap-2 shadow-sm h-9 select-none";
    
    const count = tasks.filter(t => t.owner === col && (briefingMode === 'full' || t.isStaffView)).length;
    colHeader.innerHTML = `
      <span>${col}</span>
      ${count > 0 ? `<span class="bg-u-blue-50 text-u-blue-600 text-[9px] px-2 py-0.5 rounded-full border border-u-blue-500/10 font-bold">${count}</span>` : ''}
    `;
    grid.appendChild(colHeader);
  });

  // 2. ROWS
  timelineRows.forEach(tr => {
    const isCollapsed = tr.isCollapsed;
    const rowId = isCollapsed 
      ? `row-${tr.monthName}-${tr.year}-Month` 
      : `row-${tr.monthName}-${tr.year}-${tr.period}`;

    const isCurrentRow = isCollapsed
      ? (tr.monthName === 'July' && tr.year === 2026)
      : (tr.monthName === 'July' && tr.year === 2026 && tr.period === 'Early');

    // Timeline Left Cell
    const timelineCell = document.createElement('div');
    timelineCell.id = rowId;
    timelineCell.style.minHeight = `${rowCellHeight}px`;
    timelineCell.className = `sticky left-0 z-10 flex flex-col justify-center px-3 border-r border-b text-xs transition duration-150 select-none ${
      isCurrentRow 
        ? 'bg-amber-100/90 border-l-4 border-l-amber-500 border-b-slate-350' 
        : 'bg-slate-100 border-slate-200'
    }`;

    if (isCollapsed) {
      timelineCell.innerHTML = `
        <div class="flex items-center justify-between w-full">
          <span class="font-extrabold text-slate-800 text-[11px] uppercase">${tr.monthName} '${String(tr.year).slice(2)}</span>
          ${isCurrentRow ? `<span class="text-[7.5px] font-black text-amber-700 bg-amber-200 border border-amber-300 px-1 rounded uppercase tracking-wider">NOW</span>` : ''}
        </div>
      `;
    } else {
      if (tr.period === 'Early') {
        timelineCell.innerHTML = `
          <div class="flex items-center justify-between w-full">
            <span class="font-black text-u-blue-600 text-[11px] uppercase">${tr.monthName} '${String(tr.year).slice(2)}</span>
            ${isCurrentRow ? `<span class="text-[7px] font-black text-amber-700 bg-amber-200 px-0.5 rounded uppercase tracking-wider">NOW</span>` : ''}
          </div>
          <span class="text-[9px] text-slate-400 font-bold -mt-0.5">Early (1 - 10)</span>
        `;
      } else {
        const dateLabel = tr.period === 'Mid' ? 'Mid (11 - 20)' : 'Late (21 - End)';
        timelineCell.innerHTML = `
          <span class="text-[9px] text-slate-400 font-bold pl-2">${dateLabel}</span>
        `;
      }
    }
    grid.appendChild(timelineCell);

    // Column Data Cells
    visibleColumns.forEach(col => {
      const cell = document.createElement('div');
      cell.style.minHeight = `${rowCellHeight}px`;
      cell.className = `p-1 border-r border-b border-slate-200 relative group/cell flex flex-col justify-center gap-1 ${
        isCurrentRow ? 'bg-amber-50/10' : 'bg-white hover:bg-slate-50/20'
      }`;

      // Filter tasks by column, date, and Briefing Mode
      const cellTasks = isCollapsed 
        ? getCollapsedTasksForCell(col, tr.monthName, tr.year)
        : getTasksForCell(col, tr.monthName, tr.year, tr.period);

      const cardContainer = document.createElement('div');
      cardContainer.className = "space-y-1 w-full flex flex-col shrink-0";

      cellTasks.forEach(task => {
        const card = createTaskCardElement(task, isCollapsed);
        cardContainer.appendChild(card);
      });

      const hoverAddBtn = document.createElement('button');
      hoverAddBtn.className = "absolute bottom-1 right-1 opacity-0 group-hover/cell:opacity-100 bg-[#1B365D] hover:bg-[#1B365D]/80 text-white rounded p-0.5 transition shadow z-10 flex items-center justify-center no-print";
      hoverAddBtn.innerHTML = `
        <svg class="w-2.5 h-2.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      `;
      hoverAddBtn.onclick = (e) => {
        e.stopPropagation();
        openAddTaskModal(col, tr.monthName, tr.year, isCollapsed ? 'Early' : tr.period);
      };

      cell.appendChild(cardContainer);
      cell.appendChild(hoverAddBtn);

      cell.onclick = (e) => {
        if (e.target === cell || e.target === cardContainer) {
          openAddTaskModal(col, tr.monthName, tr.year, isCollapsed ? 'Early' : tr.period);
        }
      };

      grid.appendChild(cell);
    });
  });

  if (keepScroll && main) {
    main.scrollTop = savedScrollTop;
  }

  // Re-bind scroll listener after layout settles and scroll events clear
  setTimeout(() => {
    if (main) main.addEventListener('scroll', handleBoardScroll);
    isRendering = false;
  }, 100);
}

function getTasksForCell(column, monthName, year, period) {
  return tasks.filter(task => {
    if (task.owner !== column) return false;
    if (task.period !== period) return false;
    
    // Briefing Mode Filter
    if (briefingMode === 'staff' && !task.isStaffView) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return task.title.toLowerCase().includes(q) ||
             (task.poc && task.poc.toLowerCase().includes(q)) ||
             (task.trigger && task.trigger.toLowerCase().includes(q)) ||
             (task.notes && task.notes.toLowerCase().includes(q));
    }

    if (task.recurrenceType === 'annual') {
      return task.months.includes(monthName);
    } else {
      return task.months.includes(monthName) && task.specificYear === year;
    }
  });
}

function getCollapsedTasksForCell(column, monthName, year) {
  return tasks.filter(task => {
    if (task.owner !== column) return false;
    
    // Briefing Mode Filter
    if (briefingMode === 'staff' && !task.isStaffView) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matches = task.title.toLowerCase().includes(q) ||
                      (task.poc && task.poc.toLowerCase().includes(q)) ||
                      (task.trigger && task.trigger.toLowerCase().includes(q)) ||
                      (task.notes && task.notes.toLowerCase().includes(q));
      if (!matches) return false;
    }

    if (task.recurrenceType === 'annual') {
      return task.months.includes(monthName);
    } else {
      return task.months.includes(monthName) && task.specificYear === year;
    }
  });
}

// Compact Task Card Builder
function createTaskCardElement(task, showPeriodBadge = false) {
  const card = document.createElement('div');
  card.className = "group bg-white border border-slate-200 shadow-sm hover:shadow hover:border-slate-400 rounded px-1.5 py-0.5 text-left transition duration-150 flex items-center justify-between gap-1.5 select-none border-l-2 border-l-u-blue-600 min-w-0";
  
  const periodLabel = showPeriodBadge 
    ? `<span class="bg-u-blue-50 text-u-blue-600 font-extrabold text-[8px] px-1 py-0.2 rounded border border-u-blue-500/10 uppercase mr-1 shrink-0">${task.period.slice(0, 3)}</span>`
    : '';

  const pocText = task.poc ? ` - ${task.poc}` : '';
  const triggerText = (task.trigger && briefingMode !== 'staff') ? ` (${task.trigger})` : '';

  // Visual cues for staff view importance: dimmed style if not checked inside Full View mode
  const staffIndicator = (!task.isStaffView && briefingMode === 'full') 
    ? `<span class="text-[8px] bg-slate-100 text-slate-450 border border-slate-200 px-1 py-0.2 rounded font-bold uppercase mr-1 shrink-0" title="Full view only, hidden in Staff Briefings">POC</span>`
    : '';

  card.innerHTML = `
    <div class="flex items-center min-w-0 grow">
      ${periodLabel}
      ${staffIndicator}
      <span class="text-[9.5px] font-bold text-slate-800 leading-none truncate w-full" title="${task.title}${pocText}${triggerText}">
        ${task.title}${pocText}${triggerText}
      </span>
    </div>
    <!-- Recurrence marker -->
    ${task.recurrenceType === 'annual'
      ? `<span title="Annual Recurring" class="text-emerald-650 shrink-0">
           <svg class="w-2.5 h-2.5 font-bold" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3" />
           </svg>
         </span>`
      : `<span title="One-off Task" class="text-sky-500 shrink-0">
           <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
           </svg>
         </span>`
    }
  `;

  card.onclick = (e) => {
    openEditTaskModal(task.id);
  };

  return card;
}

// ==========================================
// ACTION MENU DROPDOWN
// ==========================================
function toggleActionsDropdown() {
  document.getElementById('actions-dropdown-menu').classList.toggle('hidden');
}

// ==========================================
// TASK MODAL CONTROLS
// ==========================================
function setRecurrenceUI(type) {
  recurrenceType = type;
  const btnAnnual = document.getElementById('btn-recurrence-annual');
  const btnOneOff = document.getElementById('btn-recurrence-one-off');
  const annualContainer = document.getElementById('annual-month-container');
  const oneOffContainer = document.getElementById('one-off-container');

  if (type === 'annual') {
    btnAnnual.className = "grow py-1 text-xs font-bold rounded-md bg-[#1B365D] text-white shadow-sm";
    btnOneOff.className = "grow py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-200";
    annualContainer.classList.remove('hidden');
    oneOffContainer.classList.add('hidden');
  } else {
    btnAnnual.className = "grow py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-200";
    btnOneOff.className = "grow py-1 text-xs font-bold rounded-md bg-[#1B365D] text-white shadow-sm";
    annualContainer.classList.add('hidden');
    oneOffContainer.classList.remove('hidden');
  }
}

function populateModalOwners() {
  const select = document.getElementById('task-owner-select');
  select.innerHTML = '';
  columns.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col;
    opt.innerText = col;
    select.appendChild(opt);
  });
}

function openAddTaskModal(prefilledColumn = null, prefilledMonth = null, prefilledYear = null, prefilledPeriod = null) {
  document.getElementById('task-id').value = '';
  document.getElementById('task-title-input').value = '';
  document.getElementById('task-poc-input').value = '';
  document.getElementById('task-trigger-input').value = '';
  document.getElementById('task-notes-input').value = '';
  document.getElementById('task-staff-input').checked = true; // default on staff briefing view

  populateModalOwners();

  const checkboxes = document.querySelectorAll('input[name="recurrence-months"]');
  checkboxes.forEach(cb => cb.checked = false);

  if (prefilledColumn) document.getElementById('task-owner-select').value = prefilledColumn;
  
  if (prefilledMonth) {
    checkboxes.forEach(cb => {
      if (cb.value === prefilledMonth) cb.checked = true;
    });
    document.getElementById('task-month-select').value = prefilledMonth;
  }

  if (prefilledPeriod) {
    document.getElementById('task-period-select').value = prefilledPeriod;
  } else {
    document.getElementById('task-period-select').value = 'Early';
  }

  if (prefilledYear) {
    document.getElementById('task-year-input').value = prefilledYear;
    setRecurrenceUI('one-off');
  } else {
    document.getElementById('task-year-input').value = 2026;
    setRecurrenceUI('annual');
  }

  document.getElementById('btn-delete-task').classList.add('hidden');
  document.getElementById('btn-duplicate-task').classList.add('hidden');

  document.getElementById('modal-title').innerText = "Add New Task";
  showModal('task-modal', 'task-modal-card');
}

function openEditTaskModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('task-id').value = task.id;
  document.getElementById('task-title-input').value = task.title;
  
  populateModalOwners();
  document.getElementById('task-owner-select').value = task.owner;
  
  document.getElementById('task-poc-input').value = task.poc || '';
  document.getElementById('task-trigger-input').value = task.trigger || '';
  document.getElementById('task-notes-input').value = task.notes || '';
  document.getElementById('task-period-select').value = task.period || 'Early';
  document.getElementById('task-staff-input').checked = (task.isStaffView !== false);

  setRecurrenceUI(task.recurrenceType);
  
  const checkboxes = document.querySelectorAll('input[name="recurrence-months"]');
  checkboxes.forEach(cb => {
    cb.checked = task.months.includes(cb.value);
  });

  if (task.recurrenceType === 'one-off') {
    document.getElementById('task-month-select').value = task.months[0] || 'July';
    document.getElementById('task-year-input').value = task.specificYear || 2026;
  } else {
    document.getElementById('task-year-input').value = 2026;
  }

  document.getElementById('btn-delete-task').classList.remove('hidden');
  document.getElementById('btn-duplicate-task').classList.remove('hidden');

  document.getElementById('modal-title').innerText = "Edit Task Details";
  showModal('task-modal', 'task-modal-card');
}

function closeTaskModal() {
  hideModal('task-modal', 'task-modal-card');
}

function showModal(modalId, cardId) {
  const modal = document.getElementById(modalId);
  const card = document.getElementById(cardId);
  modal.classList.remove('hidden');
  setTimeout(() => {
    card.classList.remove('scale-95', 'opacity-0');
    card.classList.add('scale-100', 'opacity-100');
  }, 20);
}

function hideModal(modalId, cardId) {
  const modal = document.getElementById(modalId);
  const card = document.getElementById(cardId);
  card.classList.remove('scale-100', 'opacity-100');
  card.classList.add('scale-95', 'opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 150);
}

// ==========================================
// TASK DATABASE ACTIONS
// ==========================================
function saveActiveTask() {
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title-input').value.trim();
  const owner = document.getElementById('task-owner-select').value;
  const poc = document.getElementById('task-poc-input').value.trim();
  const trigger = document.getElementById('task-trigger-input').value.trim();
  const notes = document.getElementById('task-notes-input').value.trim();
  const period = document.getElementById('task-period-select').value;
  const isStaffView = document.getElementById('task-staff-input').checked;

  if (!title) {
    alert("Please enter a Task Title.");
    return;
  }

  let activeMonths = [];
  if (recurrenceType === 'annual') {
    const checkboxes = document.querySelectorAll('input[name="recurrence-months"]:checked');
    checkboxes.forEach(cb => activeMonths.push(cb.value));
    if (activeMonths.length === 0) {
      alert("Select at least one month.");
      return;
    }
  } else {
    activeMonths.push(document.getElementById('task-month-select').value);
  }

  const specificYear = recurrenceType === 'one-off' ? parseInt(document.getElementById('task-year-input').value) : null;

  if (id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { id, title, owner, poc, recurrenceType, period, months: activeMonths, specificYear, trigger, notes, isStaffView };
    }
  } else {
    tasks.push({ id: 'task-' + Date.now(), title, owner, poc, recurrenceType, period, months: activeMonths, specificYear, trigger, notes, isStaffView });
  }

  saveToLocalStorage();
  renderGrid(true);
  closeTaskModal();
}

function deleteActiveTask() {
  if (confirm("Delete this task?")) {
    tasks = tasks.filter(t => t.id !== document.getElementById('task-id').value);
    saveToLocalStorage();
    renderGrid(true);
    closeTaskModal();
  }
}

function duplicateActiveTask() {
  const baseTask = tasks.find(t => t.id === document.getElementById('task-id').value);
  if (!baseTask) return;

  const cloned = { ...baseTask, id: 'task-' + Date.now(), title: baseTask.title + " (Copy)" };
  tasks.push(cloned);
  saveToLocalStorage();
  renderGrid(true);
  closeTaskModal();
  openEditTaskModal(cloned.id);
}

// ==========================================
// AOR COLUMN FILTERS & VISIBILITY
// ==========================================
function renderColumnFilters() {
  const container = document.getElementById('column-filters-container');
  if (!container) return;
  container.innerHTML = '';

  if (columns.length === 0) {
    container.innerHTML = `<span class="text-[10px] text-slate-400 italic">No columns active. Click Actions -> AOR Columns to add some.</span>`;
    return;
  }

  columns.forEach(col => {
    const isChecked = visibleColumns.includes(col);
    const label = document.createElement('label');
    label.className = `flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold cursor-pointer select-none transition duration-150 ${
      isChecked 
        ? 'bg-u-blue-100 text-u-blue-600 border-u-blue-500/20 hover:bg-u-blue-50' 
        : 'bg-white text-slate-450 border-slate-200 hover:bg-slate-50 hover:text-slate-600'
    }`;
    
    label.innerHTML = `
      <input type="checkbox" value="${col}" ${isChecked ? 'checked' : ''} 
             onchange="toggleColumnVisibility('${col}')" 
             class="rounded accent-u-blue-600 bg-white border-slate-300 w-3 h-3 cursor-pointer">
      <span>${col}</span>
    `;
    container.appendChild(label);
  });
}

function toggleColumnVisibility(col) {
  if (visibleColumns.includes(col)) {
    visibleColumns = visibleColumns.filter(c => c !== col);
  } else {
    visibleColumns.push(col);
  }
  saveToLocalStorage();
  renderColumnFilters();
  renderGrid(true);
}

// ==========================================
// COLUMN SETTINGS ACTIONS
// ==========================================
function renderActiveColumnsList() {
  const container = document.getElementById('columns-list-container');
  container.innerHTML = '';

  if (columns.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">No columns active.</p>`;
    return;
  }

  columns.forEach(col => {
    const item = document.createElement('div');
    item.className = "bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-3";
    item.innerHTML = `
      <input type="text" value="${col}" onchange="renameColumn('${col}', this.value)" 
             class="bg-transparent border-0 font-bold text-xs tracking-wider uppercase text-slate-700 grow focus:bg-white focus:px-2 focus:py-1 focus:rounded transition">
      <button onclick="deleteColumn('${col}')" class="text-red-650 hover:text-red-700 p-1.5 rounded transition">
        🗑️
      </button>
    `;
    container.appendChild(item);
  });
}

function addNewColumn() {
  const input = document.getElementById('new-column-input');
  const val = input.value.trim();
  if (!val) return;
  if (columns.map(c => c.toLowerCase()).includes(val.toLowerCase())) return;

  columns.push(val);
  visibleColumns.push(val);
  saveToLocalStorage();
  input.value = '';
  renderActiveColumnsList();
  renderColumnFilters();
  renderGrid(true);
}

function renameColumn(oldName, newName) {
  newName = newName.trim();
  if (!newName || oldName === newName) return;

  columns = columns.map(c => c === oldName ? newName : c);
  visibleColumns = visibleColumns.map(c => c === oldName ? newName : c);
  tasks.forEach(t => { if (t.owner === oldName) t.owner = newName; });

  saveToLocalStorage();
  renderActiveColumnsList();
  renderColumnFilters();
  renderGrid(true);
}

function deleteColumn(colName) {
  if (confirm(`Delete AOR column "${colName}" and all of its tasks?`)) {
    columns = columns.filter(c => c !== colName);
    visibleColumns = visibleColumns.filter(c => c !== colName);
    tasks = tasks.filter(t => t.owner !== colName);
    saveToLocalStorage();
    renderActiveColumnsList();
    renderColumnFilters();
    renderGrid(true);
  }
}

// ==========================================
// CSV INSTRUCTIONS MODAL
// ==========================================
function openCSVInstructionsModal() {
  toggleActionsDropdown();
  showModal('csv-instructions-modal', 'csv-instructions-card');
}

function closeCSVInstructionsModal() {
  hideModal('csv-instructions-modal', 'csv-instructions-card');
}

function downloadCSVTemplate() {
  const headers = ["Title", "Column", "POC", "Recurrence", "Period", "Months", "Year", "Trigger", "Notes", "StaffView"];
  const exampleRow = [
    "Faculty Evaluations",
    "Ops",
    "Director of Operations",
    "annual",
    "Mid",
    "May",
    "",
    "By mid-May",
    "Route file through commander.",
    "FALSE" // POC view only
  ];
  
  const csvContent = [headers.join(","), exampleRow.map(escapeCSV).join(",")].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = "Battle_Rhythm_Template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function triggerCSVImport() {
  closeCSVInstructionsModal();
  document.getElementById('csv-file-input').click();
}

// ==========================================
// CSV ENGINE
// ==========================================
function escapeCSV(text) {
  if (text === null || text === undefined) return "";
  let str = String(text);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    let next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push("");
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') { i++; }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== "") lines.push(row);
  return lines;
}

function exportCSV() {
  toggleActionsDropdown();
  const headers = ["Title", "Column", "POC", "Recurrence", "Period", "Months", "Year", "Trigger", "Notes", "StaffView"];
  const csvRows = [headers.join(",")];

  tasks.forEach(t => {
    csvRows.push([
      escapeCSV(t.title),
      escapeCSV(t.owner),
      escapeCSV(t.poc || ""),
      escapeCSV(t.recurrenceType),
      escapeCSV(t.period || "Early"),
      escapeCSV(t.months.join(";")),
      escapeCSV(t.specificYear || ""),
      escapeCSV(t.trigger || ""),
      escapeCSV(t.notes || ""),
      escapeCSV(t.isStaffView !== false ? "TRUE" : "FALSE")
    ].join(","));
  });

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Battle_Rhythm_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const rawText = e.target.result;
      const rows = parseCSV(rawText);

      if (rows.length < 2) throw new Error("Empty file.");

      const fileHeaders = rows[0].map(h => h.trim().toLowerCase());
      const idxMap = {};
      ["title", "column", "poc", "recurrence", "period", "months", "year", "trigger", "notes", "staffview"].forEach(field => {
        idxMap[field] = fileHeaders.findIndex(fh => fh.includes(field));
      });

      const getVal = (row, field, defaultIdx) => {
        const fileIdx = idxMap[field];
        const activeIdx = fileIdx !== -1 ? fileIdx : defaultIdx;
        return row[activeIdx] ? row[activeIdx].trim() : '';
      };

      const importedTasks = [];
      const importedColumns = new Set(columns);

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 2 || (r.length === 1 && r[0] === '')) continue;

        const title = getVal(r, 'title', 0);
        const owner = getVal(r, 'column', 1);
        const poc = getVal(r, 'poc', 2);
        const recType = getVal(r, 'recurrence', 3).toLowerCase();
        const period = getVal(r, 'period', 4);
        const rawMonths = getVal(r, 'months', 5);
        const rawYear = getVal(r, 'year', 6);
        const trigger = getVal(r, 'trigger', 7);
        const notes = getVal(r, 'notes', 8);
        const rawStaff = getVal(r, 'staffview', 9).toUpperCase();

        if (!title || !owner) continue;

        const recurrenceType = (recType === 'one-off' || recType === 'oneoff' || recType === 'single') ? 'one-off' : 'annual';
        const cleanPeriod = (period === 'Mid' || period === 'Late') ? period : 'Early';

        let monthsList = [];
        if (rawMonths) {
          const delim = rawMonths.includes(';') ? ';' : ',';
          monthsList = rawMonths.split(delim).map(m => m.trim()).filter(m => MONTH_NAMES.includes(m));
        }
        if (monthsList.length === 0) monthsList = ["July"];

        let specificYear = null;
        if (recurrenceType === 'one-off') {
          specificYear = parseInt(rawYear);
          if (isNaN(specificYear)) specificYear = 2026;
        }

        const isStaffView = (rawStaff !== 'FALSE' && rawStaff !== '0' && rawStaff !== 'NO');

        importedColumns.add(owner);

        importedTasks.push({
          id: 'task-csv-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          title, owner, poc, recurrenceType,
          period: cleanPeriod,
          months: monthsList,
          specificYear, trigger, notes, isStaffView
        });
      }

      columns = Array.from(importedColumns);
      visibleColumns = [...columns];
      tasks = [...tasks, ...importedTasks];

      saveToLocalStorage();
      renderColumnFilters();
      renderGrid(false); // Reset view to center today after bulk load
      alert(`Successfully imported ${importedTasks.length} tasks!`);
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
