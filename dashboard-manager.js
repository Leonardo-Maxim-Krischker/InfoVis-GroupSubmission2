/**
 * Dashboard Manager
 * Orchestrates Data Loading, Filtering (Date Range + Multi-Weather + Multi-State), and Component Updates.
 */

// --- GLOBAL STATE ---
let globalData = [];
// Default range: Full Year 2021
let currentDateRange = {
    start: new Date(2021, 0, 1), // Jan 1, 2021
    end: new Date(2021, 11, 31)  // Dec 31, 2021
};
let selectedWeather = new Set(); 
let selectedStates = new Set();
let currentRegionMode = "Manual";

// --- REGION DEFINITIONS ---
const REGIONS = {
    "Region 1": ["CT", "ME", "MA", "NH", "RI", "VT"],
    "Region 2": ["NY", "NJ"],
    "Region 3": ["DE", "MD", "PA", "VA", "WV"],
    "Region 4": ["AL", "FL", "GA", "KY", "MS", "NC", "SC", "TN"],
    "Region 5": ["IL", "IN", "MI", "MN", "OH", "WI"],
    "Region 6": ["AR", "LA", "NM", "OK", "TX"],
    "Region 7": ["IA", "KS", "MO", "NE"],
    "Region 8": ["CO", "MT", "ND", "SD", "UT", "WY"],
    "Region 9": ["AZ", "CA", "HI", "NV"],
    "Region 10": ["AK", "ID", "OR", "WA"],
    "NASTO": ["CT", "DE", "DC", "ME", "MD", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
    "SASHTO": ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "SC", "TN", "VA", "WV"],
    "MAASTO": ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "OH", "WI"],
    "WASHTO": ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NE", "NV", "NM", "ND", "OK", "OR", "SD", "TX", "UT", "WA", "WY"]
};

// --- 1. DATA LOADING ---
d3.csv("./US_Accidents_March23_sampled_500k.csv", d => {
    
    // Parse Date
    const dt = new Date(d.Start_Time);
    
    // Safety check
    if (isNaN(dt)) return null;

    return {
        id: d.ID,
        severity: +d.Severity,
        date: dt,               // Store full date object for filtering
        year: dt.getFullYear(),
        month: dt.getMonth(), 
        hour: dt.getHours(),
        isNight: (dt.getHours() >= 20 || dt.getHours() < 6),
        state: d.State, 
        weather: d.Weather_Condition ? d.Weather_Condition.trim() : "Unknown"
    };
}).then(async data => {
    globalData = data.filter(d => d !== null);
    console.log("Data Loaded Successfully:", globalData.length, "records");

    // --- SETUP: WEATHER DROPDOWN ---
    const weatherCounts = d3.rollups(globalData, v => v.length, d => d.weather)
        .sort((a, b) => b[1] - a[1]); 

    const weatherSelect = document.getElementById("weatherSelect");
    weatherSelect.innerHTML = '<option value="" disabled selected>+ Add Condition...</option>';

    weatherCounts.slice(0, 25).forEach(([condition, count]) => {
        const option = document.createElement("option");
        option.value = condition;
        option.text = `${condition} (${d3.format(",")(count)})`;
        weatherSelect.appendChild(option);
    });

    weatherSelect.addEventListener("change", function() {
        const val = this.value;
        if (val) {
            selectedWeather.add(val);
            renderWeatherTags(); 
            updateDashboard();   
            this.value = "";     
        }
    });

    // --- SETUP: REGION DROPDOWN ---
    const regionSelect = document.getElementById("regionSelect");
    if(regionSelect) {
        regionSelect.addEventListener("change", function() {
            currentRegionMode = this.value;
            if (currentRegionMode === "Manual") {
                // Do nothing, keep existing manual selection
            } else if (REGIONS[currentRegionMode]) {
                selectedStates = new Set(REGIONS[currentRegionMode]);
            }
            updateDashboard();
        });
    }

    // --- SETUP: DATE RANGE INPUTS (Dynamic Limits) ---
    const dateStartInput = document.getElementById("dateStart");
    const dateEndInput = document.getElementById("dateEnd");

    // 1. Determine Min/Max dates from the loaded data
    const dateExtent = d3.extent(globalData, d => d.date); // Returns [minDate, maxDate]
    
    // Helper to format Date object to "YYYY-MM-DD" for HTML input
    const formatDateInput = (date) => {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const minDateStr = formatDateInput(dateExtent[0]);
    const maxDateStr = formatDateInput(dateExtent[1]);

    // 2. Apply limits to the input elements
    dateStartInput.min = minDateStr;
    dateStartInput.max = maxDateStr;
    dateEndInput.min = minDateStr;
    dateEndInput.max = maxDateStr;

    // 3. Set Default Values (2021)
    dateStartInput.value = "2021-01-01";
    dateEndInput.value = "2021-12-31";
    
    // Update internal state
    currentDateRange.start = new Date("2021-01-01T00:00:00");
    currentDateRange.end = new Date("2021-12-31T23:59:59");

    // 4. Input Event Listener
    function handleDateChange() {
        let s = new Date(dateStartInput.value);
        let e = new Date(dateEndInput.value);
        
        // Validate against dataset bounds
        if (s < dateExtent[0]) s = dateExtent[0];
        if (e > dateExtent[1]) e = dateExtent[1];
        if (s > e) { const temp = s; s = e; e = temp; dateStartInput.value = formatDateInput(s); dateEndInput.value = formatDateInput(e); }

        if(!isNaN(s) && !isNaN(e)) {
            currentDateRange.start = s;
            e.setHours(23, 59, 59);
            currentDateRange.end = e;
            updateDashboard();
        }
    }

    dateStartInput.addEventListener("change", handleDateChange);
    dateEndInput.addEventListener("change", handleDateChange);

    // --- INITIALIZE MAP ---
    await initMap("#chart", handleStateClick);

    // Listen for Map Metric Change
    d3.select("body").on("mapMetricChanged", updateDashboard);

    // Initial Render
    updateDashboard();
});

// --- 2. UI HELPERS ---
function renderWeatherTags() {
    const container = document.getElementById("weatherTags");
    if (!container) return;
    container.innerHTML = ""; 

    selectedWeather.forEach(weather => {
        const tag = document.createElement("div");
        tag.className = "weather-tag";
        tag.innerHTML = `${weather} <span>×</span>`;
        tag.title = "Click to remove";
        tag.addEventListener("click", () => {
            selectedWeather.delete(weather);
            renderWeatherTags();
            updateDashboard();
        });
        container.appendChild(tag);
    });
}

// --- 3. INTERACTION HANDLER ---
function handleStateClick(abbr) {
    if (currentRegionMode !== "Manual") {
        document.getElementById("regionSelect").value = "Manual";
        currentRegionMode = "Manual";
        selectedStates.clear();
        selectedStates.add(abbr);
    } else {
        if (selectedStates.has(abbr)) {
            selectedStates.delete(abbr);
        } else {
            selectedStates.add(abbr);
        }
    }
    updateDashboard();
}

// --- 4. MAIN PIPELINE ---
function updateDashboard() {
    // A. Apply Global Filters
    const globalFilteredData = globalData.filter(d => {
        const dateMatch = (d.date >= currentDateRange.start && d.date <= currentDateRange.end);
        const weatherMatch = (selectedWeather.size === 0) || selectedWeather.has(d.weather);
        return dateMatch && weatherMatch;
    });

    // B. Aggregate Data for Map
    const stateStats = new Map();
    const grouped = d3.group(globalFilteredData, d => d.state);
    
    grouped.forEach((rows, state) => {
        stateStats.set(state, {
            accidents: rows.length,
            nightAcc: rows.filter(r => r.isNight).length,
            dayAcc: rows.filter(r => !r.isNight).length
        });
    });

    updateMapVisuals(stateStats, selectedStates);
    updateSelectionLabel(stateStats);

    // C. Filter for Detail Charts
    let chartData = globalFilteredData;
    if (selectedStates.size > 0) {
        chartData = globalFilteredData.filter(d => selectedStates.has(d.state));
    }

    updateDetailCharts(chartData);
}

// --- 5. CHART UPDATES ---
function updateSelectionLabel(stateStats) {
    const box = document.getElementById("selectedBox");
    if (!box) return; 

    // [UPDATED] Calculate National Totals regardless of selection
    let nationalAccidents = 0;
    stateStats.forEach(s => nationalAccidents += s.accidents);
    const totalStatesWithData = stateStats.size;

    // Case 1: No specific state selected -> Show National Stats
    if (selectedStates.size === 0) {
        box.innerHTML = `
            <div><strong>National View (All States)</strong></div>
            <div class="muted" style="margin-bottom: 8px;">Data across ${totalStatesWithData} states</div>
            <div style="border-top:1px solid #eee; padding-top:5px;">
                <strong>${d3.format(",")(nationalAccidents)}</strong> Accidents <br>
                <span class="muted">(in selected date/weather scope)</span>
            </div>
            <div class="muted" style="margin-top:8px; font-style:italic; font-size:0.7rem;">
                Click a state on the map to filter specific details.
            </div>
        `;
        return;
    }

    // Case 2: Specific states selected
    const count = selectedStates.size;
    let selectedAccidents = 0;
    selectedStates.forEach(abbr => {
        const s = stateStats.get(abbr);
        if(s) selectedAccidents += s.accidents;
    });

    const names = Array.from(selectedStates).join(", ");
    const displayNames = names.length > 60 ? names.substring(0, 60) + "..." : names;

    box.innerHTML = `
        <div><strong>${currentRegionMode !== "Manual" ? currentRegionMode : "Custom Selection"}</strong></div>
        <div class="muted">${count} State${count > 1 ? 's' : ''} Selected</div>
        <div style="font-size: 0.7rem; margin-top:5px; margin-bottom:10px; line-height: 1.4; color: #333;">${displayNames}</div>
        <div style="border-top:1px solid #eee; padding-top:5px;">
            <strong>${d3.format(",")(selectedAccidents)}</strong> Accidents <br>
            <span class="muted">(in selected filter scope)</span>
        </div>
    `;
}

function updateDetailCharts(data) {
    // 1. Stacked Bar Chart
    const weatherRollup = d3.rollups(data, v => {
        return {
            1: v.filter(d => d.severity === 1).length,
            2: v.filter(d => d.severity === 2).length,
            3: v.filter(d => d.severity === 3).length,
            4: v.filter(d => d.severity === 4).length,
            total: v.length
        };
    }, d => d.weather);

    const barData = weatherRollup
        .map(([k, v]) => ({ category: k, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10); 

    const sevColor = d3.scaleOrdinal()
        .domain([1, 2, 3, 4])
        .range(["#ffda79", "#ff9f43", "#ee5253", "#5f27cd"]);

    const barSvg = d3.select("#bar-chart").selectAll("svg").data([null]).join("svg")
        .attr("viewBox", [0, 0, 600, 350])
        .style("width", "100%").style("height", "100%");
        
    if(typeof drawStackedBarChart === "function") {
        drawStackedBarChart(barSvg, barData, sevColor);
    }

    // 2. Line Chart
    // Group by Month-Year Time Object
    const monthlyRollup = d3.rollups(data, v => v.length, d => d3.timeMonth(d.date))
        .sort((a, b) => a[0] - b[0]);

    const lineData = monthlyRollup.map(([dateObj, count]) => ({
        date: dateObj,
        value: count
    }));

    const lineSvg = d3.select("#line-chart").selectAll("svg").data([null]).join("svg")
        .attr("viewBox", [0, 0, 600, 350])
        .style("width", "100%").style("height", "100%");

    if(typeof drawLineChart === "function") {
        drawLineChart(lineSvg, lineData);
    }
}