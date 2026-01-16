/**
 * Dashboard Manager
 */

let globalData = [];
let regionalTrendChart = null; 
let currentDateRange = { start: new Date(2021, 0, 1), end: new Date(2021, 11, 31) };
let selectedWeather = new Set(); 
let selectedStates = new Set();
let currentRegionMode = "Manual";
let trendMode = "state_severity"; 

const US_CENSUS_REGIONS = {
    "Northeast": new Set(["CT","ME","MA","NH","RI","VT","NJ","NY","PA"]),
    "Midwest": new Set(["IL","IN","MI","OH","WI","IA","KS","MN","MO","NE","ND","SD"]),
    "South": new Set(["DE","FL","GA","MD","NC","SC","VA","DC","WV","AL","KY","MS","TN","AR","LA","OK","TX"]),
    "West": new Set(["AZ","CO","ID","MT","NV","NM","UT","WY","AK","CA","HI","OR","WA"])
};

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

function getCensusRegion(state) {
    if (!state) return "Unknown";
    for (const [region, set] of Object.entries(US_CENSUS_REGIONS)){ if (set.has(state)) return region; }
    return "Unknown";
}

d3.csv("./US_Accidents_March23_sampled_500k.csv", d => {
    const dt = new Date(d.Start_Time);
    if (isNaN(dt)) return null;
    return {
        id: d.ID, severity: +d.Severity, date: dt, year: dt.getFullYear(), month: dt.getMonth(), hour: dt.getHours(),
        isNight: (dt.getHours() >= 20 || dt.getHours() < 6), state: d.State, 
        weather: d.Weather_Condition ? d.Weather_Condition.trim() : "Unknown",
        Start_Time: d.Start_Time, State: d.State, Severity: d.Severity, "Temperature(F)": d["Temperature(F)"], 
        "Humidity(%)": d["Humidity(%)"], Weather_Condition: d.Weather_Condition
    };
}).then(async data => {
    globalData = data.filter(d => d !== null);
    regionalTrendChart = new RegionalTrendsChart("#line-chart");
    setupControls();
    await initMap("#chart", handleStateClick);
    d3.select("body").on("mapMetricChanged", updateDashboard);
    updateDashboard();
});

function setupControls() {
    const trendModeSelect = document.getElementById("trendModeSelect");
    if(trendModeSelect){
        trendModeSelect.value = trendMode;
        trendModeSelect.addEventListener("change", function() { trendMode = this.value; updateDashboard(); });
    }
    const weatherSelect = document.getElementById("weatherSelect");
    weatherSelect.addEventListener("change", function() {
        if (this.value) { selectedWeather.add(this.value); renderWeatherTags(); updateDashboard(); this.value = ""; }
    });
    const regionSelect = document.getElementById("regionSelect");
    if(regionSelect) regionSelect.addEventListener("change", function() {
        currentRegionMode = this.value;
        if (currentRegionMode !== "Manual" && REGIONS[currentRegionMode]) selectedStates = new Set(REGIONS[currentRegionMode]);
        updateDashboard();
    });
    const dateStartInput = document.getElementById("dateStart");
    const dateEndInput = document.getElementById("dateEnd");
    const dateExtent = d3.extent(globalData, d => d.date);
    const formatDateInput = (date) => date ? date.toISOString().split('T')[0] : "";
    if (dateExtent[0]) {
        dateStartInput.min = formatDateInput(dateExtent[0]); dateStartInput.max = formatDateInput(dateExtent[1]);
        dateEndInput.min = formatDateInput(dateExtent[0]); dateEndInput.max = formatDateInput(dateExtent[1]);
    }
    dateStartInput.value = "2021-01-01"; dateEndInput.value = "2021-12-31";
    function handleDateChange() {
        let s = new Date(dateStartInput.value); let e = new Date(dateEndInput.value);
        if(!isNaN(s) && !isNaN(e)) { e.setHours(23, 59, 59); currentDateRange.start = s; currentDateRange.end = e; updateDashboard(); }
    }
    dateStartInput.addEventListener("change", handleDateChange); dateEndInput.addEventListener("change", handleDateChange);
}

function renderWeatherTags() {
    const container = document.getElementById("weatherTags");
    if (!container) return;
    container.innerHTML = ""; 
    selectedWeather.forEach(weather => {
        const tag = document.createElement("div"); tag.className = "weather-tag";
        tag.innerHTML = `${weather} <span>×</span>`;
        tag.addEventListener("click", () => { selectedWeather.delete(weather); renderWeatherTags(); updateDashboard(); });
        container.appendChild(tag);
    });
}

function refreshWeatherDropdown(dataContext) {
    const weatherSelect = document.getElementById("weatherSelect");
    if (!weatherSelect) return;
    const weatherCounts = d3.rollups(dataContext, v => v.length, d => d.weather).sort((a, b) => b[1] - a[1]); 
    weatherSelect.innerHTML = '<option value="" disabled selected>+ Add Condition...</option>';
    weatherCounts.slice(0, 30).forEach(([condition, count]) => {
        const option = document.createElement("option"); option.value = condition;
        option.text = `${condition} (${d3.format(",")(count)})`; weatherSelect.appendChild(option);
    });
}

function handleStateClick(abbr) {
    if (currentRegionMode !== "Manual") {
        document.getElementById("regionSelect").value = "Manual"; currentRegionMode = "Manual"; selectedStates.clear();
    }
    if (selectedStates.has(abbr)) selectedStates.delete(abbr); else selectedStates.add(abbr);
    updateDashboard();
}

function updateDashboard() {
    const dateFilteredData = globalData.filter(d => d.date >= currentDateRange.start && d.date <= currentDateRange.end);
    const globalTotal = dateFilteredData.length;
    
    const mapData = dateFilteredData.filter(d => selectedWeather.size === 0 || selectedWeather.has(d.weather));
    const mapTotalAccidents = mapData.length;

    const stateFilteredData = mapData.filter(d => selectedStates.size === 0 || selectedStates.has(d.state));
    const dropdownContext = dateFilteredData.filter(d => selectedStates.size === 0 || selectedStates.has(d.state));
    refreshWeatherDropdown(dropdownContext);

    const stateStats = new Map();
    d3.group(mapData, d => d.state).forEach((rows, state) => {
        stateStats.set(state, { accidents: rows.length, nightAcc: rows.filter(r => r.isNight).length, dayAcc: rows.filter(r => !r.isNight).length });
    });
    updateMapVisuals(stateStats, selectedStates, mapTotalAccidents);
    updateSelectionLabel(stateStats, mapTotalAccidents); 
    updateWeatherLabel(stateFilteredData, dropdownContext.length);
    updateBarChart(stateFilteredData, trendMode.split('_')[0], trendMode.split('_')[1]);

    let trendData = [];
    let groupByFunc = null;
    let filterSet = null;
    const [groupType, metricType] = trendMode.split('_');
    const metricKey = (metricType === "count") ? "count" : "severity_avg";

    if (groupType === "state") {
        trendData = dateFilteredData.filter(d => (selectedWeather.size === 0) || selectedWeather.has(d.weather));
        if (selectedStates.size === 0) { groupByFunc = (d) => "National (All States)"; filterSet = null; } 
        else { groupByFunc = (d) => d.State; filterSet = selectedStates; }
    } 
    else if (groupType === "weather") {
        trendData = dateFilteredData.filter(d => (selectedStates.size === 0) || selectedStates.has(d.state));
        groupByFunc = (d) => d.Weather_Condition ? d.Weather_Condition.trim() : "Unknown";
        filterSet = (selectedWeather.size > 0) ? selectedWeather : null;
    }

    if (regionalTrendChart) {
        regionalTrendChart.setData(trendData, { metric: metricKey, groupBy: groupByFunc, filterSet: filterSet });
    }
}

function updateSelectionLabel(stateStats, globalTotal) {
    const box = document.getElementById("selectedBox");
    if (!box) return; 
    let currentTotal = 0;
    if (selectedStates.size > 0) selectedStates.forEach(abbr => { const s = stateStats.get(abbr); if(s) currentTotal += s.accidents; });
    else stateStats.forEach(s => currentTotal += s.accidents);
    
    const globalShare = globalTotal > 0 ? (currentTotal / globalTotal) * 100 : 0;

    if (selectedStates.size === 0) {
        box.innerHTML = `<div><strong>National View</strong></div><div class="muted">All States Included</div>
        <div style="border-top:1px solid #eee; padding-top:5px; margin-top:5px;"><strong>${d3.format(",")(currentTotal)}</strong> Accidents <span class="muted">(${globalShare.toFixed(1)}%)</span></div>`;
        return;
    }
    const breakdown = [];
    selectedStates.forEach(abbr => { const s = stateStats.get(abbr); if (s && s.accidents > 0) breakdown.push({ name: abbr, pct: (s.accidents / currentTotal) * 100 }); });
    breakdown.sort((a, b) => b.pct - a.pct);
    const listStr = breakdown.slice(0, 10).map(d => `${d.name} (${d.pct.toFixed(0)}%)`).join(", ") + (breakdown.length > 10 ? ", ..." : "");
    box.innerHTML = `<div><strong>${currentRegionMode !== "Manual" ? currentRegionMode : "Custom Selection"}</strong></div>
    <div class="muted" style="margin-bottom:4px;">${selectedStates.size} State${selectedStates.size > 1 ? 's' : ''} Selected</div>
    <div style="font-size:0.7rem; line-height:1.3; color:#555; margin-bottom: 8px;">${listStr}</div>
    <div style="border-top:1px solid #eee; padding-top:5px;"><strong>${d3.format(",")(currentTotal)}</strong> Accidents <span class="muted">(${globalShare.toFixed(1)}% of Country)</span></div>`;
}

function updateWeatherLabel(finalData, totalContextCount) {
    const box = document.getElementById("selectedWeatherBox");
    if (!box) return;
    const currentTotal = finalData.length;
    const globalShare = totalContextCount > 0 ? (currentTotal / totalContextCount) * 100 : 0;
    if (selectedWeather.size === 0) {
        box.innerHTML = `<div><strong>All Weather Conditions</strong></div><div class="muted">No specific weather filtered</div>
        <div style="border-top:1px solid #eee; padding-top:5px; margin-top:5px;"><strong>${d3.format(",")(currentTotal)}</strong> Accidents <span class="muted">(${globalShare.toFixed(1)}%)</span></div>`;
        return;
    }
    const counts = d3.rollups(finalData, v => v.length, d => d.weather);
    const breakdown = counts.map(([name, count]) => ({ name: name, pct: (count / currentTotal) * 100 })).sort((a, b) => b.pct - a.pct);
    const listStr = breakdown.slice(0, 10).map(d => `${d.name} (${d.pct.toFixed(0)}%)`).join(", ") + (breakdown.length > 10 ? ", ..." : "");
    box.innerHTML = `<div><strong>Custom Selection</strong></div><div class="muted" style="margin-bottom:4px;">${selectedWeather.size} Condition${selectedWeather.size > 1 ? 's' : ''} Selected</div>
    <div style="font-size:0.7rem; line-height:1.3; color:#555; margin-bottom: 8px;">${listStr}</div>
    <div style="border-top:1px solid #eee; padding-top:5px;"><strong>${d3.format(",")(currentTotal)}</strong> Accidents <span class="muted">(${globalShare.toFixed(1)}% of Selection)</span></div>`;
}

function updateBarChart(data, groupType, metricType) {
    const container = document.getElementById("bar-chart");
    const h2 = container ? container.querySelector("h2") : null;
    let groupFunc; let label;
    if (groupType === "state") { groupFunc = d => d.state; label = "Top States"; } else { groupFunc = d => d.weather; label = "Top Weather Conditions"; }
    const rollup = d3.rollups(data, v => {
        const count1 = v.filter(d => d.severity === 1).length; const count2 = v.filter(d => d.severity === 2).length;
        const count3 = v.filter(d => d.severity === 3).length; const count4 = v.filter(d => d.severity === 4).length;
        const total = v.length; const avgSev = total > 0 ? (1*count1 + 2*count2 + 3*count3 + 4*count4) / total : 0;
        return { 1: count1, 2: count2, 3: count3, 4: count4, total, avgSev };
    }, groupFunc);
    let barData = rollup.map(([k, v]) => ({ category: k, ...v }));
    if (metricType === "count") { barData.sort((a, b) => b.total - a.total); if (h2) h2.textContent = `${label} by Accident Count`; } 
    else { barData.sort((a, b) => b.avgSev - a.avgSev); if (h2) h2.textContent = `${label} by Average Severity`; }
    barData = barData.slice(0, 12);
    const color = d3.scaleOrdinal().domain([1,2,3,4]).range(["#ffda79", "#ff9f43", "#ee5253", "#5f27cd"]);
    const svg = d3.select("#bar-chart").selectAll("svg").data([null]).join("svg").attr("viewBox", [0, 0, 600, 350]).style("width","100%").style("height","100%");
    if(typeof drawStackedBarChart === "function") drawStackedBarChart(svg, barData, color);
}