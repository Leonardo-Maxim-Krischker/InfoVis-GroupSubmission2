const REGION_4 = {
    Northeast: new Set(["CT","ME","MA","NH","RI","VT","NJ","NY","PA"]),
    Midwest: new Set(["IL","IN","MI","OH","WI","IA","KS","MN","MO","NE","ND","SD"]),
    South: new Set(["DE","FL","GA","MD","NC","SC","VA","DC","WV","AL","KY","MS","TN","AR","LA","OK","TX"]),
    West: new Set(["AZ","CO","ID","MT","NV","NM","UT","WY","AK","CA","HI","OR","WA"])
  };
  
  function stateToRegion4(state){
    if (!state) return "Unknown";
    for (const [region, set] of Object.entries(REGION_4)){
      if (set.has(state)) return region;
    }
    return "Unknown";
  }
  
  function isPoorWeather(cond){
    if (!cond) return false;
    const c = String(cond).toLowerCase();
    const ok = ["fair", "clear", "mostly clear", "partly cloudy", "cloudy"];
    if (ok.includes(c)) return false;
  
    const poorHints = [
      "rain","shower","drizzle","thunder","storm","snow","sleet","ice","hail",
      "fog","mist","haze","smoke","dust","sand","squall","tornado","hurricane",
      "wintry","freezing","blowing","heavy","t-storm"
    ];
    return poorHints.some(k => c.includes(k));
  }
  
  function yearFromStartTime(v){
    if (!v) return null;
    const s = String(v);
    const y = parseInt(s.slice(0,4), 10);
    return Number.isFinite(y) ? y : null;
  }
  
  function toNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  
  class RegionalTrendsChart {
    constructor(selector, opts = {}){
      this.el = d3.select(selector);
  
      this.width = opts.width ?? 920;
      this.height = opts.height ?? 420;
  
      this.margin = { top: 16, right: 20, bottom: 60, left: 80 };
      this.innerW = this.width - this.margin.left - this.margin.right;
      this.innerH = this.height - this.margin.top - this.margin.bottom;
  
      this.metricKey = "severity_avg";
      this.groupingKey = "regions4";
  
      this.dataRaw = [];
      this.agg = [];
      this.years = [];
  
      this.color = d3.scaleOrdinal()
        .domain(["Northeast","Midwest","South","West"])
        .range(["#1f77b4","#2ca02c","#ff7f0e","#9467bd"]);
  
      this._build();
    }
  
    _build(){
      this.el.html("");
  
      const card = this.el.append("div").attr("class", "rt-card");
      card.append("div").attr("class", "rt-title")
        .text("Regional Trends: Weather & Severity Over Time");
  
   
      const controls = card.append("div").attr("class", "rt-controls");
  
      const metricWrap = controls.append("div").attr("class","rt-control");
      metricWrap.append("div").text("Metric:");
      this.metricSel = metricWrap.append("select");
  
      const metricOptions = [
        { key:"severity_avg", label:"Accident Severity (Avg)" },
        { key:"count", label:"Accident Count" },
        { key:"poor_weather_pct", label:"Poor Weather (%)" },
        { key:"temp_avg", label:"Temperature (Avg)" },
        { key:"humidity_avg", label:"Humidity (Avg)" }
      ];
  
      this.metricSel.selectAll("option")
        .data(metricOptions)
        .join("option")
        .attr("value", d => d.key)
        .text(d => d.label);
  
      this.metricSel.property("value", this.metricKey);
  
      const groupingWrap = controls.append("div").attr("class","rt-control");
      groupingWrap.append("div").text("Region Grouping:");
      this.groupSel = groupingWrap.append("select");
      this.groupSel.selectAll("option")
        .data([{ key:"regions4", label:"4 Regions" }])
        .join("option")
        .attr("value", d => d.key)
        .text(d => d.label);
      this.groupSel.property("value", this.groupingKey);
  
      const svgWrap = card.append("div").attr("class","rt-svg-wrap");
  
      this.tooltip = svgWrap.append("div").attr("class","rt-tooltip");
  
      this.svg = svgWrap.append("svg")
        .attr("width", this.width)
        .attr("height", this.height);
  
      this.g = this.svg.append("g")
        .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
  
      this.x = d3.scaleLinear();
      this.y = d3.scaleLinear().range([this.innerH, 0]);
  
      this.xAxisG = this.g.append("g")
        .attr("transform", `translate(0,${this.innerH})`);
  
      this.yAxisG = this.g.append("g");
  
      this.g.append("text")
        .attr("x", -this.innerH/2)
        .attr("y", -55)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .style("font-size", "28px")
        .style("font-weight", 800)
        .text("Metric Value\n(Normalized)");
  
    
      this.linesG = this.g.append("g");
      this.pointsG = this.g.append("g");
  
      const sliderRow = card.append("div").attr("class","rt-slider-row");
      sliderRow.append("div").text("Year Range:");
  
      this.yearMinLabel = sliderRow.append("div").text("—");
  
      const slider = sliderRow.append("div").attr("class","rt-slider");
      this.rangeMin = slider.append("input")
        .attr("class","rt-range-min")
        .attr("type","range")
        .attr("step", 1);
  
      this.rangeMax = slider.append("input")
        .attr("class","rt-range-max")
        .attr("type","range")
        .attr("step", 1);
  
      this.yearMaxLabel = sliderRow.append("div").text("—");
  
      this.legend = card.append("div").attr("class","rt-legend");
  
      this.metricSel.on("change", () => {
        this.metricKey = this.metricSel.property("value");
        this.render();
      });
  
      this.groupSel.on("change", () => {
        this.groupingKey = this.groupSel.property("value");
        this._reaggregate();
        this._resetSliderFromYears();
        this.render();
      });
  
      const onSlider = () => {
        let a = +this.rangeMin.property("value");
        let b = +this.rangeMax.property("value");
        if (a > b) [a, b] = [b, a];
        this.rangeMin.property("value", a);
        this.rangeMax.property("value", b);
        this.render();
      };
  
      this.rangeMin.on("input", onSlider);
      this.rangeMax.on("input", onSlider);
    }
  
    setData(rows){
      this.dataRaw = rows ?? [];
      console.log("RegionalTrendsChart.setData called with", this.dataRaw.length, "rows");
      this._reaggregate();
      console.log("After _reaggregate, agg has", this.agg.length, "entries, years:", this.years);
      this._resetSliderFromYears();
      this.render();
    }
  
    _reaggregate(){
      const parsed = [];
      let skippedYear = 0;
      let skippedRegion = 0;
      for (const r of this.dataRaw){
        const year = yearFromStartTime(r.Start_Time);
        if (!year) {
          skippedYear++;
          continue;
        }

        const region = (this.groupingKey === "regions4")
          ? stateToRegion4(r.State)
          : "Unknown";

        if (region === "Unknown") {
          skippedRegion++;
          continue;
        }
  
        const sev = toNum(r.Severity);
        const temp = toNum(r["Temperature(F)"] ?? r["Temperature(F) "]);
        const hum = toNum(r["Humidity(%)"] ?? r["Humidity(%) "]);
  
        parsed.push({
          year,
          region,
          severity: sev,
          temp,
          humidity: hum,
          poor: isPoorWeather(r.Weather_Condition) ? 1 : 0
        });
      }
  
      const key = d => `${d.year}__${d.region}`;
      const grouped = d3.group(parsed, d => key(d));
  
      const out = [];
      for (const [k, arr] of grouped){
        const [yearStr, region] = k.split("__");
        const year = +yearStr;
  
        const count = arr.length;
  
        const sevVals = arr.map(d => d.severity).filter(v => v != null);
        const tempVals = arr.map(d => d.temp).filter(v => v != null);
        const humVals = arr.map(d => d.humidity).filter(v => v != null);
  
        const severity_avg = sevVals.length ? d3.mean(sevVals) : null;
        const temp_avg = tempVals.length ? d3.mean(tempVals) : null;
        const humidity_avg = humVals.length ? d3.mean(humVals) : null;
  
        const poor_weather_pct = count ? (100 * d3.mean(arr, d => d.poor)) : 0;
  
        out.push({
          year,
          region,
          count,
          severity_avg,
          temp_avg,
          humidity_avg,
          poor_weather_pct
        });
      }
  
      out.sort((a,b) => d3.ascending(a.year, b.year) || d3.ascending(a.region, b.region));
      this.agg = out;

      this.years = Array.from(new Set(out.map(d => d.year))).sort(d3.ascending);
      
      if (this.dataRaw.length > 0) {
        console.log(`_reaggregate: Input=${this.dataRaw.length}, Parsed=${parsed.length}, Output=${out.length}, SkippedYear=${skippedYear}, SkippedRegion=${skippedRegion}`);
        if (parsed.length === 0) {
          console.warn("No data was parsed! Check Start_Time and State columns.");
          if (this.dataRaw.length > 0) {
            console.log("Sample row:", this.dataRaw[0]);
          }
        }
      }
    }
  
    _resetSliderFromYears(){
      const [minY, maxY] = d3.extent(this.years);
      if (minY == null || maxY == null) {
        console.warn("_resetSliderFromYears: No years available! years array:", this.years);
        return;
      }
      
      console.log("_resetSliderFromYears: Setting slider range to", minY, "-", maxY);
      this.rangeMin.attr("min", minY).attr("max", maxY).property("value", minY);
      this.rangeMax.attr("min", minY).attr("max", maxY).property("value", maxY);
  
      this.yearMinLabel.text(minY);
      this.yearMaxLabel.text(maxY);
    }
  
    render(){
      if (!this.agg.length) {
        console.warn("RegionalTrendsChart.render: No aggregated data, returning early");
        return;
      }
      console.log("RegionalTrendsChart.render: Rendering with", this.agg.length, "data points");
  
      let minY = +this.rangeMin.property("value");
      let maxY = +this.rangeMax.property("value");
      if (minY > maxY) [minY, maxY] = [maxY, minY];
  
      this.yearMinLabel.text(minY);
      this.yearMaxLabel.text(maxY);
  
      const data = this.agg.filter(d => d.year >= minY && d.year <= maxY);
  
      const series = d3.groups(data, d => d.region)
        .map(([region, rows]) => ({
          region,
          rows: rows
            .filter(r => r[this.metricKey] != null)
            .sort((a,b) => d3.ascending(a.year, b.year))
        }))
        .filter(s => s.rows.length);
  
      this.x.range([0, this.innerW]).domain([minY, maxY]);

      const metricVals = data.map(d => d[this.metricKey]).filter(v => v != null);
      let yDomain;
  
      if (this.metricKey === "severity_avg") {
        yDomain = [0, 4];
      } else if (metricVals.length) {
        const ext = d3.extent(metricVals);
        const pad = (ext[1] - ext[0]) === 0 ? 1 : 0;
        yDomain = [ext[0] - pad, ext[1] + pad];
      } else {
        yDomain = [0, 1];
      }
  
      const yValueScale = (this.metricKey === "severity_avg")
        ? d3.scaleLinear().domain(yDomain).range([this.innerH, 0])
        : d3.scaleLinear().domain(yDomain).range([0, 4]);
  
      this.y.domain([0, 4]);
  
      const xAxis = d3.axisBottom(this.x)
        .ticks(Math.min(8, (maxY - minY + 1)))
        .tickFormat(d3.format("d"));
  
      const yAxis = d3.axisLeft(this.y).ticks(4);
  
      this.xAxisG.call(xAxis)
        .selectAll("text")
        .style("font-size", "22px")
        .style("font-weight", 800);
  
      this.yAxisG.call(yAxis)
        .selectAll("text")
        .style("font-size", "22px")
        .style("font-weight", 800);
  
      this.xAxisG.selectAll("path,line").attr("stroke-width", 2);
      this.yAxisG.selectAll("path,line").attr("stroke-width", 2);
  
      const line = d3.line()
        .x(d => this.x(d.year))
        .y(d => {
          const v = d[this.metricKey];
          const norm = (this.metricKey === "severity_avg") ? v : yValueScale(v);
          return this.y(norm);
        });
  
      const paths = this.linesG.selectAll("path.rt-line")
        .data(series, d => d.region);
  
      paths.join(
        enter => enter.append("path")
          .attr("class","rt-line")
          .attr("fill","none")
          .attr("stroke-width", 5)
          .attr("stroke", d => this.color(d.region))
          .attr("d", d => line(d.rows)),
        update => update
          .attr("stroke", d => this.color(d.region))
          .attr("d", d => line(d.rows)),
        exit => exit.remove()
      );
  
      const flat = series.flatMap(s => s.rows.map(r => ({...r, __region: s.region})));
  
      const circles = this.pointsG.selectAll("circle.rt-pt")
        .data(flat, d => `${d.__region}_${d.year}`);
  
      circles.join(
        enter => enter.append("circle")
          .attr("class","rt-pt")
          .attr("r", 7)
          .attr("cx", d => this.x(d.year))
          .attr("cy", d => {
            const v = d[this.metricKey];
            const norm = (this.metricKey === "severity_avg") ? v : yValueScale(v);
            return this.y(norm);
          })
          .attr("fill", d => this.color(d.__region))
          .attr("stroke", "white")
          .attr("stroke-width", 2)
          .on("mousemove", (event, d) => this._showTooltip(event, d))
          .on("mouseleave", () => this._hideTooltip()),
        update => update
          .attr("cx", d => this.x(d.year))
          .attr("cy", d => {
            const v = d[this.metricKey];
            const norm = (this.metricKey === "severity_avg") ? v : yValueScale(v);
            return this.y(norm);
          })
          .attr("fill", d => this.color(d.__region)),
        exit => exit.remove()
      );
  
      const legendOrder = ["Northeast","Midwest","South","West"].filter(r => this.color.domain().includes(r));
      const leg = this.legend.selectAll("div.rt-legend-item")
        .data(legendOrder, d => d);
  
      leg.join(
        enter => {
          const item = enter.append("div").attr("class","rt-legend-item");
          item.append("div")
            .attr("class","rt-swatch")
            .style("background", d => this.color(d));
          item.append("div").text(d => d);
          return item;
        },
        update => update.select(".rt-swatch").style("background", d => this.color(d)),
        exit => exit.remove()
      );
    }
  
    _showTooltip(event, d){
      const severity = (d.severity_avg != null) ? d.severity_avg : null;
      const poor = (d.poor_weather_pct != null) ? d.poor_weather_pct : null;
  
      const sevStr = severity == null ? "—" : severity.toFixed(1);
      const poorStr = poor == null ? "—" : `${Math.round(poor)}%`;
  
      this.tooltip
        .style("display","block")
        .html(
          `Region: ${d.__region}<br/>
           Year: ${d.year}<br/>
           Severity: ${sevStr}<br/>
           Poor Weather: ${poorStr}`
        );
  
      const [mx, my] = d3.pointer(event, this.svg.node());
      this.tooltip
        .style("left", `${mx + 14}px`)
        .style("top", `${my + 14}px`);
    }
  
    _hideTooltip(){
      this.tooltip.style("display","none");
    }
  }
  