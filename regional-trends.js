/**
 * Regional Trends Chart
 * Visualizes metrics over time (Daily).
 * Features: Zoom/Pan, Grid, Interactive Tooltip (No Dots).
 */

const METRIC_META = {
    "severity_avg": { label: "Average Severity (1-4)", format: d3.format(".1f") },
    "count":        { label: "Total Accidents",        format: d3.format(",") }, 
    "poor_weather_pct": { label: "Poor Weather %",     format: d => d + "%" },
    "temp_avg":     { label: "Avg Temp (°F)",          format: d3.format(".0f") },
    "humidity_avg": { label: "Avg Humidity (%)",       format: d3.format(".0f") }
};

function isPoorWeather(cond){
    if (!cond) return false;
    const c = String(cond).toLowerCase();
    const ok = ["fair", "clear", "mostly clear", "partly cloudy", "cloudy"];
    if (ok.includes(c)) return false;
    const poorHints = ["rain","shower","drizzle","thunder","storm","snow","sleet","ice","hail","fog","mist","haze","smoke","dust","sand","squall","tornado","hurricane","wintry","freezing","blowing","heavy","t-storm"];
    return poorHints.some(k => c.includes(k));
}

function getDayDate(v){
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d)) return null;
    d.setHours(0,0,0,0);
    return d;
}

function toNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
  
class RegionalTrendsChart {
    constructor(selector){
      this.el = d3.select(selector);
      this.margin = { top: 10, right: 20, bottom: 40, left: 60 };
      
      this.metricKey = "severity_avg";
      this.groupBy = (d) => "All Data"; 
      this.filterSet = null; 
      this.dataRaw = [];
      this.agg = []; // Flat array of all points
      this.series = []; // Grouped structure for drawing lines
      this.color = d3.scaleOrdinal(d3.schemeCategory10);

      this._build();
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(this.el.node());
    }
  
    _build(){
      const container = this.el.append("div")
        .style("display", "flex").style("flex-direction", "column")
        .style("flex", "1").style("min-height", "0").style("width", "100%");
      
      const svgWrap = container.append("div")
        .style("flex", "1").style("position", "relative").style("overflow", "hidden");
      
      this.svg = svgWrap.append("svg").style("width", "100%").style("height", "100%").style("overflow", "visible");
      
      // 1. Defs for Clipping (Prevents lines from drawing over axes during zoom)
      this.defs = this.svg.append("defs");
      this.defs.append("clipPath")
          .attr("id", "chart-clip")
          .append("rect")
          .attr("x", 0).attr("y", 0)
          .attr("width", 0).attr("height", 0); // Updated in render

      // 2. Groups Order: Grid -> Lines (Clipped) -> Axes -> Overlay
      this.g = this.svg.append("g");
      
      this.gridG = this.g.append("g").attr("class", "grid-group");
      this.xGridG = this.gridG.append("g").attr("class", "x-grid").style("opacity", 0.1);
      this.yGridG = this.gridG.append("g").attr("class", "y-grid").style("opacity", 0.1);

      this.linesWrap = this.g.append("g").attr("clip-path", "url(#chart-clip)");
      this.linesG = this.linesWrap.append("g");

      this.xAxisG = this.g.append("g");
      this.yAxisG = this.g.append("g");
      this.yAxisLabel = this.g.append("text").attr("transform", "rotate(-90)").attr("text-anchor", "middle").style("font-size", "11px").style("fill", "#6b7280").text("Metric Value");
      
      // Transparent Overlay for Mouse Events (Zoom + Tooltip)
      this.overlay = this.g.append("rect")
          .attr("fill", "transparent")
          .style("cursor", "crosshair");

      this.legend = container.append("div").attr("class","rt-legend");

      // Initialize Zoom Behavior
      this.zoom = d3.zoom()
          .scaleExtent([1, 50]) // Max zoom 50x
          .on("zoom", (event) => this._onZoom(event));
    }
  
    setData(rows, config = {}){
      this.dataRaw = rows ?? [];
      if(config.metric) this.metricKey = config.metric;
      if(config.groupBy) this.groupBy = config.groupBy; 
      this.filterSet = config.filterSet || null;

      this._reaggregate();
      this.render();
    }
  
    _reaggregate(){
      const parsed = [];
      for (const r of this.dataRaw){
        const dateObj = getDayDate(r.Start_Time);
        if (!dateObj) continue;
        
        const groupName = this.groupBy(r);
        if (!groupName) continue;
        if (this.filterSet && this.filterSet.size > 0 && !this.filterSet.has(groupName)) continue;

        const sev = toNum(r.Severity);
        const temp = toNum(r["Temperature(F)"] ?? r["Temperature(F) "]); 
        const hum = toNum(r["Humidity(%)"] ?? r["Humidity(%) "]);
        const cond = r.Weather_Condition ?? r["Weather_Condition"];
  
        parsed.push({
          date: dateObj, group: groupName, 
          severity: sev, temp, humidity: hum,
          poor: isPoorWeather(cond) ? 1 : 0
        });
      }
  
      const grouped = d3.group(parsed, d => `${d.date.getTime()}__${d.group}`);
      const out = [];
      
      for (const [k, arr] of grouped){
        const [timeStr, groupName] = k.split("__");
        const date = new Date(+timeStr);
        const count = arr.length;
        const sevVals = arr.map(d => d.severity).filter(v => v != null);
        const tempVals = arr.map(d => d.temp).filter(v => v != null);
        const humVals = arr.map(d => d.humidity).filter(v => v != null);
  
        out.push({
          date: date,
          group: groupName,
          count,
          severity_avg: sevVals.length ? d3.mean(sevVals) : null,
          temp_avg: tempVals.length ? d3.mean(tempVals) : null,
          humidity_avg: humVals.length ? d3.mean(humVals) : null,
          poor_weather_pct: count ? (100 * d3.mean(arr, d => d.poor)) : 0
        });
      }
      
      const uniqueGroups = new Set(out.map(d => d.group));
      if (uniqueGroups.size > 8 && !this.filterSet) {
         const totals = d3.rollups(out, v => d3.sum(v, d=>d.count), d=>d.group)
                          .sort((a,b) => b[1] - a[1]).slice(0, 8).map(d=>d[0]);
         const topSet = new Set(totals);
         this.agg = out.filter(d => topSet.has(d.group)).sort((a,b) => a.date - b.date);
      } else {
         this.agg = out.sort((a,b) => a.date - b.date);
      }

      // Pre-calculate series for rendering
      this.series = d3.groups(this.agg, d => d.group).map(([g, rows]) => ({ group:g, rows: rows.sort((a,b) => a.date - b.date) }));
    }
  
    render(){
      if (!this.agg.length) {
          this.linesG.selectAll("*").remove();
          this.legend.html("");
          return;
      }
      
      // 1. Dimensions
      const bounds = this.svg.node().getBoundingClientRect();
      const width = bounds.width || 500; 
      const height = bounds.height || 300;
      this.innerW = width - this.margin.left - this.margin.right;
      this.innerH = height - this.margin.top - this.margin.bottom;
  
      this.g.attr("transform", `translate(${this.margin.left},${this.margin.top})`);
      
      // Update Clip Path
      this.defs.select("#chart-clip rect").attr("width", this.innerW).attr("height", this.innerH);

      // 2. Scales
      const dateExtent = d3.extent(this.agg, d => d.date);
      this.xScaleOriginal = d3.scaleTime().domain(dateExtent).range([0, this.innerW]);
      this.currentXScale = this.xScaleOriginal; // Initially same

      const vals = this.agg.map(d => d[this.metricKey]).filter(v => v != null);
      let yDom;
      if (this.metricKey === "severity_avg") yDom = [0, 4];
      else if (this.metricKey === "poor_weather_pct") yDom = [0, 100];
      else if (this.metricKey === "count") {
          const max = d3.max(vals) || 10;
          yDom = [0, max * 1.1]; 
      }
      else if (vals.length) {
         const ext = d3.extent(vals);
         yDom = [Math.max(0, ext[0] * 0.9), ext[1] * 1.1];
      } else yDom = [0, 1];
      
      this.yScale = d3.scaleLinear().domain(yDom).range([this.innerH, 0]);

      // 3. Axes & Grid
      this.updateAxesAndGrid();

      // 4. Draw Lines (Initial)
      this.lineGenerator = d3.line()
        .x(d => this.currentXScale(d.date))
        .y(d => this.yScale(d[this.metricKey]));

      this.linesG.selectAll("path.rt-line")
        .data(this.series, d => d.group)
        .join(
           enter => enter.append("path").attr("class","rt-line").attr("fill","none").attr("stroke-width",2),
           update => update,
           exit => exit.remove()
        )
        .attr("stroke", d => this.color(d.group))
        .attr("d", d => this.lineGenerator(d.rows));

      // 5. Overlay & Interaction
      this.overlay
          .attr("width", this.innerW).attr("height", this.innerH)
          .call(this.zoom)
          // Ensure we start at standard zoom
          .call(this.zoom.transform, d3.zoomIdentity) 
          .on("mousemove", (event) => this._onMouseMove(event))
          .on("mouseleave", () => this._hideTooltip());

      // 6. Legend
      const legendItems = this.series.map(s => s.group);
      this.legend.selectAll("div.rt-legend-item").data(legendItems, d => d)
        .join(enter => {
            const d = enter.append("div").attr("class","rt-legend-item");
            d.append("div").attr("class","rt-swatch").style("background", k=>this.color(k));
            d.append("div").text(k=>k);
            return d;
        }, update => update.select(".rt-swatch").style("background", k=>this.color(k)));
    }

    // Helper to draw Axes and Grids
    updateAxesAndGrid() {
        const xAxis = d3.axisBottom(this.currentXScale).ticks(5);
        const yAxis = d3.axisLeft(this.yScale).ticks(5);
        const xGrid = d3.axisBottom(this.currentXScale).tickSize(-this.innerH).tickFormat("");
        const yGrid = d3.axisLeft(this.yScale).tickSize(-this.innerW).tickFormat("");

        this.xAxisG.attr("transform", `translate(0,${this.innerH})`).call(xAxis);
        this.yAxisG.call(yAxis);
        this.xGridG.attr("transform", `translate(0,${this.innerH})`).call(xGrid);
        this.yGridG.call(yGrid);

        const meta = METRIC_META[this.metricKey] || { label: "Value" };
        this.yAxisLabel.attr("x", -this.innerH/2).attr("y", -45).text(meta.label);
    }

    _onZoom(event) {
        // Rescale X
        const newX = event.transform.rescaleX(this.xScaleOriginal);
        this.currentXScale = newX;

        // Redraw Axes, Grid, Lines
        this.updateAxesAndGrid();
        
        this.lineGenerator.x(d => this.currentXScale(d.date));
        this.linesG.selectAll("path.rt-line").attr("d", d => this.lineGenerator(d.rows));
    }

    _onMouseMove(event) {
        // 1. Find Date from Mouse X
        const [mx, my] = d3.pointer(event);
        const date = this.currentXScale.invert(mx);
        
        // 2. Find Nearest Data Point across all series
        // We look for the point closest in X (Time) first, then closest in Y (Value)
        let bestDist = Infinity;
        let bestPoint = null;

        const bisect = d3.bisector(d => d.date).center;

        for (const s of this.series) {
            const idx = bisect(s.rows, date);
            const d = s.rows[idx];
            if (!d) continue;

            // Check if X is reasonably close (e.g. within 2 days pixels)
            // Actually, for lines we just snap to the closest x-index
            const px = this.currentXScale(d.date);
            const py = this.yScale(d[this.metricKey]);
            
            // Distance to mouse
            const dx = Math.abs(px - mx);
            const dy = Math.abs(py - my);
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < bestDist) {
                bestDist = dist;
                bestPoint = d;
            }
        }

        if (bestPoint && bestDist < 100) { // Threshold to hide if too far
            this._showTooltip(event, bestPoint);
        } else {
            this._hideTooltip();
        }
    }
  
    _showTooltip(event, d){
      const v = d[this.metricKey];
      const meta = METRIC_META[this.metricKey] || { format: d3.format(".2f") };
      const s = (v!=null) ? meta.format(v) : "—";
      const dateStr = d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      
      const tooltip = d3.select("#tooltip");
      tooltip.style("display","block")
             .style("opacity", 1)
             .html(`<strong>${d.group}</strong><br>${dateStr}<br>${meta.label}: ${s}`);
             
      tooltip.style("left", (event.pageX + 15) + "px")
             .style("top", (event.pageY - 20) + "px");
    }
  
    _hideTooltip(){ 
        d3.select("#tooltip").style("opacity", 0).style("display", "none");
    }
}