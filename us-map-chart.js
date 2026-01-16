/**
 * US Map Component (Reusable)
 */

// Internal State
let svg, g, projection, path;
let statesGeo = [];
let mapMetric = "accidents"; 
let onStateClickCallback = null; // Callback function

// Configuration
const METRICS = [
  { key: "accidents", label: "Total Accidents", format: d3.format(",") , palette: d3.interpolateReds },
  { key: "nightAcc",  label: "Night Accidents", format: d3.format(","), palette: d3.interpolatePuRd },
  { key: "dayAcc",    label: "Day Accidents",   format: d3.format(","), palette: d3.interpolateBlues }
];

// Helper Maps
const fipsToAbbr = { "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY" };
const abbrToName = { "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming" };

const regionOf = (abbr) => {
  const northeast = new Set(["CT","ME","MA","NH","RI","VT","NJ","NY","PA"]);
  const midwest   = new Set(["IL","IN","MI","OH","WI","IA","KS","MN","MO","NE","ND","SD"]);
  const south     = new Set(["DE","FL","GA","MD","NC","SC","VA","DC","WV","AL","KY","MS","TN","AR","LA","OK","TX"]);
  const west      = new Set(["AZ","CO","ID","MT","NV","NM","UT","WY","AK","CA","HI","OR","WA"]);
  if (northeast.has(abbr)) return "Northeast";
  if (midwest.has(abbr)) return "Midwest";
  if (south.has(abbr)) return "South";
  if (west.has(abbr)) return "West";
  return "Other";
};

// 1. Initialize Map Structure
async function initMap(containerId, clickCallback) {
    onStateClickCallback = clickCallback;
    
    // Load TopoJSON
    const us = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json");
    statesGeo = topojson.feature(us, us.objects.states).features;

    const container = d3.select(containerId);
    const width = 900;
    const height = 550;

    svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("width", "100%")
      .style("height", "100%");

    g = svg.append("g");

    projection = d3.geoAlbersUsa().translate([width / 2, height / 2]).scale(1100);
    path = d3.geoPath().projection(projection);

    svg.call(d3.zoom().scaleExtent([1, 8]).on("zoom", (event) => g.attr("transform", event.transform)));

    // Setup Dropdown
    const sel = document.getElementById("metricSelect");
    sel.innerHTML = METRICS.map(m => `<option value="${m.key}">${m.label}</option>`).join("");
    sel.addEventListener("change", () => {
        mapMetric = sel.value;
        // Trigger generic update event so Manager knows to refresh map visuals
        d3.select("body").dispatch("mapMetricChanged"); 
    });
}

// 2. Update Map Visuals (Called by Manager)
function updateMapVisuals(stateStats, selectedStateAbbr) {
    const metricDef = METRICS.find(m => m.key === mapMetric);
    
    // Calculate Color Scale
    const cleanVals = Array.from(stateStats.values()).map(s => s[mapMetric]).filter(v => v != null);
    const extent = d3.extent(cleanVals);
    const color = d3.scaleSequential(metricDef.palette).domain(extent[0] === undefined ? [0,1] : extent);

    // Update Legend
    renderLegend(color, metricDef.label, color.domain()[0], color.domain()[1], metricDef.format);
    
    // Update Side Box
    updateSelectedBox(selectedStateAbbr, stateStats.get(selectedStateAbbr));

    // Draw/Update States
    g.selectAll("path.state")
        .data(statesGeo, d => d.id)
        .join("path")
        .attr("class", "state")
        .attr("d", path)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            const abbr = fipsToAbbr[d.id];
            if(abbr && onStateClickCallback) onStateClickCallback(abbr);
        })
        .on("mousemove", (event, d) => {
            const abbr = fipsToAbbr[d.id];
            const s = stateStats.get(abbr);
            const tooltip = d3.select("#tooltip");
            
            tooltip.style("opacity", 1)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 20) + "px")
                .html(`
                    <div><strong>${abbrToName[abbr] || "Unknown"} (${abbr})</strong></div>
                    <div class="muted">${regionOf(abbr)}</div>
                    <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                    <div>${metricDef.label}: <strong>${s ? metricDef.format(s[mapMetric]) : "N/A"}</strong></div>
                    ${abbr === selectedStateAbbr ? '<div style="color:blue; font-size:10px; margin-top:5px;">(Selected)</div>' : '<div class="muted" style="font-size:10px; margin-top:5px;">Click to toggle filter</div>'}
                `);
        })
        .on("mouseout", () => d3.select("#tooltip").style("opacity", 0))
        .transition().duration(500)
        .attr("fill", d => {
            const abbr = fipsToAbbr[d.id];
            const s = stateStats.get(abbr);
            
            // Visual Logic:
            // 1. If no data -> Grey
            // 2. If a state IS selected and this isn't it -> Fade out (light grey)
            // 3. Otherwise -> Use Color Scale
            if (!s) return "#e5e7eb";
            if (selectedStateAbbr && abbr !== selectedStateAbbr) return "#eee"; 
            
            return color(s[mapMetric]);
        })
        .attr("stroke", d => fipsToAbbr[d.id] === selectedStateAbbr ? "#333" : "#fff")
        .attr("stroke-width", d => fipsToAbbr[d.id] === selectedStateAbbr ? 2 : 0.5);
}

// Internal Helpers
function renderLegend(colorScale, label, min, max, fmt) {
    const div = document.getElementById("legend");
    div.innerHTML = "";
    
    // Gradient Bar
    const steps = 20;
    const colors = [];
    for(let i=0; i<steps; i++) colors.push(colorScale(min + (i/(steps-1))*(max-min)));
    
    const bar = document.createElement("div");
    bar.className = "legendBar";
    bar.style.background = `linear-gradient(90deg, ${colors.join(",")})`;
    div.appendChild(bar);
    
    // Labels
    const row = document.createElement("div");
    row.className = "legendRow";
    row.innerHTML = `<span>${fmt(min)}</span><span>${label}</span><span>${fmt(max)}</span>`;
    div.appendChild(row);
}

function updateSelectedBox(abbr, stats) {
    const box = document.getElementById("selectedBox");
    if(!abbr || !stats) {
        box.innerHTML = `<div class="muted">Click a state on the map to pin it here.</div>`;
        return;
    }
    box.innerHTML = `
        <h3 style="margin:0;">${abbrToName[abbr]} (${abbr})</h3>
        <div class="muted" style="margin-bottom:10px;">${regionOf(abbr)}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div><strong>Total:</strong><br>${d3.format(",")(stats.accidents)}</div>
            <div><strong>Night:</strong><br>${d3.format(",")(stats.nightAcc)}</div>
            <div><strong>Day:</strong><br>${d3.format(",")(stats.dayAcc)}</div>
        </div>
    `;
}