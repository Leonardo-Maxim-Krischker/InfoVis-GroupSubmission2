/**
 * Stacked Bar Chart Component
 * Visualizes the breakdown of accident severity across different weather conditions.
 */
const drawStackedBarChart = (svg, data, colorScale) => {
  const WIDTH = 600;
  const HEIGHT = 350;
  // [UPDATED] Tighter margins to use more space
  const MARGINS = { top: 20, right: 10, bottom: 70, left: 45 }; 

  svg.selectAll("*").remove();

  // 1. Setup Stack Generator
  const keys = [1, 2, 3, 4];
  const stack = d3.stack()
    .keys(keys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const stackedData = stack(data);

  // 2. Define Scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.category))
    .range([MARGINS.left, WIDTH - MARGINS.right])
    .padding(0.2); // Reduced padding slightly for wider bars

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.total)]) 
    .nice()
    .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

  // 3. Render Layers
  const layers = svg.selectAll(".layer")
    .data(stackedData)
    .join("g")
      .attr("class", "layer")
      .attr("fill", d => colorScale(d.key));

  // 4. Render Rects with Tooltips
  layers.selectAll("rect")
    .data(d => d)
    .join("rect")
      .attr("x", d => xScale(d.data.category))
      .attr("y", d => yScale(d[1]))
      .attr("height", d => yScale(d[0]) - yScale(d[1]))
      .attr("width", xScale.bandwidth())
      .on("mousemove", (event, d) => {
          const severityLevel = d3.select(event.target.parentNode).datum().key;
          const count = d[1] - d[0];
          const total = d.data.total;
          const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
          
          const tooltip = d3.select("#tooltip");
          
          tooltip.style("opacity", 1)
              .style("left", (event.pageX + 15) + "px")
              .style("top", (event.pageY - 20) + "px")
              .html(`
                  <div><strong>${d.data.category}</strong></div>
                  <div style="font-size:11px; margin-bottom:4px;">Total: ${d3.format(",")(total)}</div>
                  <hr style="margin:4px 0; border:0; border-top:1px solid #eee;">
                  <div>Severity <strong>${severityLevel}</strong></div>
                  <div><strong>${d3.format(",")(count)}</strong> Accidents</div>
                  <div class="muted">(${pct}% of ${d.data.category})</div>
              `);
      })
      .on("mouseout", () => {
          d3.select("#tooltip").style("opacity", 0);
      });

  // 5. Axes
  // X-Axis
  svg.append("g")
    .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-35)"); // Reduced rotation angle to save vertical space

  // Y-Axis
  svg.append("g")
    .attr("transform", `translate(${MARGINS.left},0)`)
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format("~s"))); // Compact number format (e.g., 10k)
    
  // 6. Legend
  // Positioned inside the chart area (top right) to save margin space
  const legend = svg.append("g")
    .attr("transform", `translate(${WIDTH - 120}, ${MARGINS.top})`);
    
  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text("Darker = More Severe");
};