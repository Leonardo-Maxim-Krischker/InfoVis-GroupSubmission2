/**
 * Dashboard Manager
 * Orchestrates Data Loading, Filtering (Year + Weather + Region), and Component Updates.
 */

// Global State
let globalData = [];
let currentYear = 2021;
let currentWeather = "All"; 
let selectedStates = new Set(); // Stores multiple selected states (e.g., {"CA", "NV", "AZ"})
let currentRegionMode = "Manual";

// --- REGION DEFINITIONS ---
// Derived from Report Document Page 5
const REGIONS = {
    // Standard Federal Regions (10 Regions)
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
    
    // AASHTO Regions
    "NASTO": ["CT", "DE", "DC", "ME", "MD", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
    "SASHTO": ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "SC", "TN", "VA", "WV"],
    "MAASTO": ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "OH", "WI"],
    "WASHTO": ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NE", "NV", "NM", "ND", "OK", "OR", "SD", "TX", "UT", "WA", "WY"]
};

// --- 1. DATA LOADING ---
d3.csv("./US_Accidents_March23_sampled_500k.csv", d => {
    // Parse Date
    const dt = d3.timeParse("%Y-%m-%d %H:%M:%S")(d.Start_Time);
    if (!dt) return null; // Skip invalid dates

    return {
        id: d.ID,
        severity: +d.Severity,
        year: dt.getFullYear(),
        month: dt.getMonth(), // 0-11
        hour: dt.getHours(),
        isNight: (dt.getHours() >= 20 || dt.getHours() < 6),
        state: d.State, // "CA", "TX", etc.
        weather: d.Weather_Condition || "Unknown"
    };
}).then(async data => {
    globalData = data.filter(d => d !== null);
    console.log("Data Loaded:", globalData.length, "records");

    // --- SETUP: WEATHER DROPDOWN ---
    const weatherCounts = d3.rollups(globalData, v => v.length, d => d.weather)
        .sort((a, b) => b[1] - a[1]); 

    const weatherSelect = document.getElementById("weatherSelect");
    // Populate top 20 conditions
    weatherCounts.slice(0, 20).forEach(([condition, count]) => {
        const option = document.createElement("option");
        option.value = condition;
        option.text = `${condition} (${d3.format(",")(count)})`;
        weatherSelect.appendChild(option);
    });

    weatherSelect.addEventListener("change", function() {
        currentWeather = this.value;
        updateDashboard();
    });

    // --- SETUP: REGION DROPDOWN ---
    const regionSelect = document.getElementById("regionSelect");
    regionSelect.addEventListener("change", function() {
        currentRegionMode = this.value;
        
        if (currentRegionMode === "Manual") {
            // If switching to manual, keep the current selection as is (or clear it if preferred)
            // doing nothing keeps the user's context.
        } else if (REGIONS[currentRegionMode]) {
            // Overwrite selection with the predefined region list
            selectedStates = new Set(REGIONS[currentRegionMode]);
        }
        updateDashboard();
    });

    // --- SETUP: YEAR SLIDER ---
    const slider = document.getElementById("yearSlider");
    const display = document.getElementById("yearDisplay");
    
    slider.addEventListener("input", function() {
        currentYear = +this.value;
        display.textContent = currentYear;
        updateDashboard();
    });

    // --- INITIALIZE MAP ---
    // Pass the container ID and the click handler
    await initMap("#chart", handleStateClick);

    // Listen for Map Metric Change (triggered inside us-map-chart.js)
    d3.select("body").on("mapMetricChanged", updateDashboard);

    // Initial Render
    updateDashboard();
});

// --- 2. INTERACTION HANDLER ---
function handleStateClick(abbr) {
    // Logic: 
    // If a preset region is active (e.g., "Region 1"), clicking a state 
    // breaks the preset and switches to "Manual" custom mode.
    if (currentRegionMode !== "Manual") {
        document.getElementById("regionSelect").value = "Manual";
        currentRegionMode = "Manual";
        
        // Reset selection to ONLY the clicked state
        selectedStates.clear();
        selectedStates.add(abbr);
    } else {
        // Standard Manual Toggle
        if (selectedStates.has(abbr)) {
            selectedStates.delete(abbr);
        } else {
            selectedStates.add(abbr);
        }
    }
    updateDashboard();
}

// --- 3. MAIN PIPELINE ---
function updateDashboard() {
    // A. Apply Global Filters (Year AND Weather) -> For Map Colors
    const globalFilteredData = globalData.filter(d => {
        const yearMatch = (d.year === currentYear);
        const weatherMatch = (currentWeather === "All" || d.weather === currentWeather);
        return yearMatch && weatherMatch;
    });

    // B. Aggregate Data for Map
    // We calculate stats for ALL states matching the Year/Weather filter
    const stateStats = new Map();
    const grouped = d3.group(globalFilteredData, d => d.state);
    
    grouped.forEach((rows, state) => {
        stateStats.set(state, {
            accidents: rows.length,
            nightAcc: rows.filter(r => r.isNight).length,
            dayAcc: rows.filter(r => !r.isNight).length
        });
    });

    // Update Map Visuals (Pass the Set of selected states)
    updateMapVisuals(stateStats, selectedStates);

    // Update Sidebar Text
    updateSelectionLabel(stateStats);

    // C. Filter for Detail Charts
    // If NO states selected -> Show National Data (all globalFilteredData)
    // If states selected -> Filter globalFilteredData to those states
    let chartData = globalFilteredData;
    if (selectedStates.size > 0) {
        chartData = globalFilteredData.filter(d => selectedStates.has(d.state));
    }

    // D. Update Detail Charts
    updateDetailCharts(chartData);
}

// --- 4. HELPERS ---
function updateSelectionLabel(stateStats) {
    const box = document.getElementById("selectedBox");
    
    if (selectedStates.size === 0) {
        box.innerHTML = `
            <div><strong>National View (All States)</strong></div>
            <div class="muted" style="margin-top:5px;">Click states on the map or use the Region dropdown to filter the charts below.</div>
        `;
        return;
    }

    const count = selectedStates.size;
    // Calculate total accidents for the selection
    let totalAccidents = 0;
    selectedStates.forEach(abbr => {
        const s = stateStats.get(abbr);
        if(s) totalAccidents += s.accidents;
    });

    // Create a readable list of names
    const names = Array.from(selectedStates).join(", ");
    const displayNames = names.length > 60 ? names.substring(0, 60) + "..." : names;

    box.innerHTML = `
        <div><strong>${currentRegionMode !== "Manual" ? currentRegionMode : "Custom Selection"}</strong></div>
        <div class="muted">${count} State${count > 1 ? 's' : ''} Selected</div>
        <div style="font-size: 11px; margin-top:5px; margin-bottom:10px; line-height: 1.4; color: #333;">${displayNames}</div>
        <div style="border-top:1px solid #eee; padding-top:5px;">
            <strong>${d3.format(",")(totalAccidents)}</strong> Accidents <br>
            <span class="muted">(in selected filter scope)</span>
        </div>
    `;
}

function updateDetailCharts(data) {
    // 1. Stacked Bar Chart (Severity vs Weather)
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

    // 2. Line Chart (Monthly Trend)
    const monthlyRollup = d3.rollups(data, v => v.length, d => d.month)
        .sort((a, b) => a[0] - b[0]);

    const lineData = monthlyRollup.map(([m, count]) => ({
        date: new Date(currentYear, m, 1),
        value: count
    }));

    const lineSvg = d3.select("#line-chart").selectAll("svg").data([null]).join("svg")
        .attr("viewBox", [0, 0, 600, 350])
        .style("width", "100%").style("height", "100%");

    if(typeof drawLineChart === "function") {
        drawLineChart(lineSvg, lineData);
    }
}