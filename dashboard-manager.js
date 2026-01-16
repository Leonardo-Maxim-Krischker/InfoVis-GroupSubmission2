/**
 * Dashboard Manager
 * Orchestrates: Data Loading -> Year Filter -> Map Update -> State Filter -> Chart Updates
 */

let globalData = [];
let currentYear = 2021;
let selectedStateAbbr = null; // e.g., "TX"

// 1. Data Loading
d3.csv("./US_Accidents_March23_sampled_500k.csv").then(async (data) => {
    
    // Preprocess: Date Parsing and Night/Day Logic
    data.forEach(d => {
        const dt = new Date(d.Start_Time);
        d.year = dt.getFullYear();
        d.month = dt.getMonth(); // 0-11
        d.hour = dt.getHours();
        d.isNight = (d.hour >= 20 || d.hour < 6); // Simple logic matching your script
        d.severity = +d.Severity;
        d.state = d.State; // Ensure column name matches
        d.weather = d.Weather_Condition;
    });

    globalData = data;

    // 2. Initialize Map
    // Pass the container ID and the callback function for clicks
    await initMap("#chart", handleStateClick);
    
    // 3. Setup Controls
    const slider = document.getElementById("yearSlider");
    const display = document.getElementById("yearDisplay");
    
    slider.addEventListener("input", (e) => {
        currentYear = +e.target.value;
        display.textContent = currentYear;
        updateDashboard();
    });

    // Listen for map metric changes (visual only) to redraw map
    d3.select("#chart").on("metricChange", () => updateDashboard());

    // Initial Render
    updateDashboard();
});

// --- Callback: When User Clicks a State on Map ---
function handleStateClick(abbr) {
    if (selectedStateAbbr === abbr) {
        selectedStateAbbr = null; // Deselect
    } else {
        selectedStateAbbr = abbr;
    }
    updateDashboard();
}

// --- Main Pipeline ---
function updateDashboard() {
    // STEP 1: Global Filter (Year)
    // The Map always shows all states for the selected year
    const yearData = globalData.filter(d => d.year === currentYear);

    // STEP 2: Aggregate Data for Map
    // We need a Map: Abbr -> {accidents, nightAcc, dayAcc}
    const stateStats = new Map();
    const grouped = d3.group(yearData, d => d.state);
    
    grouped.forEach((rows, state) => {
        stateStats.set(state, {
            accidents: rows.length,
            nightAcc: rows.filter(r => r.isNight).length,
            dayAcc: rows.filter(r => !r.isNight).length
        });
    });

    // Update Map Visuals
    updateMapVisuals(stateStats, selectedStateAbbr);

    // STEP 3: Filter for Detail Charts (State Selection)
    // If a state is selected, filter yearData further. If not, use all yearData.
    let chartData = yearData;
    if (selectedStateAbbr) {
        chartData = yearData.filter(d => d.state === selectedStateAbbr);
    }

    // STEP 4: Update Bar & Line Charts
    updateDetailCharts(chartData);
}

function updateDetailCharts(data) {
    // --- Line Chart (Accidents by Month) ---
    const monthlyData = d3.rollups(data, v => v.length, d => d.month)
        .map(([month, count]) => ({
            date: new Date(currentYear, month, 1),
            value: count
        }))
        .sort((a, b) => a.date - b.date);
        
    const lineSvg = d3.select("#line-chart").selectAll("svg").data([null]).join("svg")
        .attr("viewBox", [0, 0, 900, 400]);
    
    // Note: Ensure drawLineChart handles the SVG creation or selection correctly
    if(typeof drawLineChart === 'function') drawLineChart(lineSvg, monthlyData);

    // --- Stacked Bar Chart (Severity by Weather) ---
    // Simple top 5 weather conditions
    const weatherCounts = d3.rollups(data, 
        v => ({
            1: v.filter(d => d.severity === 1).length,
            2: v.filter(d => d.severity === 2).length,
            3: v.filter(d => d.severity === 3).length,
            4: v.filter(d => d.severity === 4).length,
            total: v.length
        }), 
        d => d.weather
    )
    .map(([key, obj]) => ({ category: key, ...obj }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // Top 10

    const barSvg = d3.select("#bar-chart").selectAll("svg").data([null]).join("svg")
        .attr("viewBox", [0, 0, 900, 400]);
        
    // Define shared color scale
    const sevColor = d3.scaleOrdinal().domain([1,2,3,4]).range(["#ffda79", "#ff9f43", "#ee5253", "#5f27cd"]);
    
    if(typeof drawStackedBarChart === 'function') drawStackedBarChart(barSvg, weatherCounts, sevColor);
}