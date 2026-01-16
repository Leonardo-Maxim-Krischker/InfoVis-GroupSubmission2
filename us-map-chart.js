/**
 * US Map Component (Reusable)
 * Handles TopoJSON rendering, multi-state highlighting, and dynamic scaling.
 */

// Internal State
let svg, g, projection, path;
let statesGeo = [];
let mapMetric = "accidents"; 
let onStateClickCallback = null; 

// Configuration
const METRICS = [
  { key: "accidents", label: "Total Accidents", format: d3.format(",") , palette: d3.interpolateReds },
  { key: "nightAcc",  label: "Night Accidents", format: d3.format(","), palette: d3.interpolatePuRd },
  { key: "dayAcc",    label: "Day Accidents",   format: d3.format(","), palette: d3.interpolateBlues }
];

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

async function initMap(containerId, clickCallback) {
    onStateClickCallback = clickCallback;
    
    const us = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json");
    statesGeo = topojson.feature(us, us.objects.states).features;

    const container = d3.select(containerId);
    container.selectAll("svg").remove();

    svg = container.append("svg").attr("viewBox", `0 0 980 560`).style("width", "100%").style("height", "100%");
    g = svg.append("g");

    projection = d3.geoAlbersUsa().translate([980 / 2, 560 / 2]).scale(1100);
    path = d3.geoPath().projection(projection);

    svg.call(d3.zoom().scaleExtent([1, 8]).on("zoom", (event) => g.attr("transform", event.transform)));

    const sel = document.getElementById("metricSelect");
    if (sel) {
        sel.innerHTML = METRICS.map(m => `<option value="${m.key}">${m.label}</option>`).join("");
        sel.addEventListener("change", () => { mapMetric = sel.value; d3.select("body").dispatch("mapMetricChanged"); });
    }
}

function updateMapVisuals(stateStats, selectedStatesSet, totalAccidents) {
    const metricDef = METRICS.find(m => m.key === mapMetric);
    
    // [UPDATED] Scale Logic:
    // 1. If NO states selected -> Max is the absolute max of all states.
    // 2. If states selected -> Max is the max of only the SELECTED states.
    // 3. Min is always 0.
    
    let domainValues;
    
    if (selectedStatesSet.size === 0) {
        // No selection: Consider all states
        domainValues = Array.from(stateStats.values()).map(s => s[mapMetric]);
    } else {
        // Selection active: Consider only selected states
        domainValues = [];
        selectedStatesSet.forEach(abbr => {
            const s = stateStats.get(abbr);
            if(s) domainValues.push(s[mapMetric]);
        });
    }
    
    // Fallback if array empty (shouldn't happen with valid data)
    const maxVal = d3.max(domainValues) || 1; 
    const color = d3.scaleSequential(metricDef.palette).domain([0, maxVal]);

    renderLegend(color, metricDef.label, 0, maxVal, metricDef.format);
    
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
            const isSelected = selectedStatesSet.has(abbr);
            const val = s ? s[mapMetric] : 0;
            const pct = totalAccidents > 0 ? (val / totalAccidents * 100).toFixed(1) : "0.0";

            const tooltip = d3.select("#tooltip");
            tooltip.style("opacity", 1)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 20) + "px")
                .html(`
                    <div><strong>${abbrToName[abbr] || "Unknown"} (${abbr})</strong></div>
                    <div class="muted">${regionOf(abbr)}</div>
                    <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                    <div>${metricDef.label}: <strong>${s ? metricDef.format(val) : "0"}</strong></div>
                    <div class="muted" style="font-size:11px;">(${pct}% of Country)</div>
                    ${isSelected ? '<div style="color:#2563eb; font-weight:bold; font-size:10px; margin-top:5px;">● Selected</div>' : '<div class="muted" style="font-size:10px; margin-top:5px;">Click to select</div>'}
                `);
        })
        .on("mouseout", () => d3.select("#tooltip").style("opacity", 0))
        .transition().duration(500)
        .attr("fill", d => {
            const abbr = fipsToAbbr[d.id];
            const s = stateStats.get(abbr);
            if (!s) return "#e5e7eb";
            
            // Fading logic for unselected
            if (selectedStatesSet.size > 0 && !selectedStatesSet.has(abbr)) return "#f3f4f6"; 
            
            return color(s[mapMetric]);
        })
        .attr("stroke", d => {
            const abbr = fipsToAbbr[d.id];
            return selectedStatesSet.has(abbr) ? "#1f2937" : "#fff";
        })
        .attr("stroke-width", d => {
            const abbr = fipsToAbbr[d.id];
            return selectedStatesSet.has(abbr) ? 2 : 0.5;
        });
}

function renderLegend(colorScale, label, min, max, fmt) {
    const div = document.getElementById("legend");
    if (!div) return;
    
    div.innerHTML = "";
    
    const steps = 20;
    const colors = [];
    for(let i=0; i<steps; i++) colors.push(colorScale(min + (i/(steps-1))*(max-min)));
    
    const bar = document.createElement("div");
    bar.className = "legendBar";
    bar.style.background = `linear-gradient(90deg, ${colors.join(",")})`;
    div.appendChild(bar);
    
    const row = document.createElement("div");
    row.className = "legendRow";
    // Force min to 0 as requested
    row.innerHTML = `<span>0</span><span>${label}</span><span>${fmt(max)}</span>`;
    div.appendChild(row);
}