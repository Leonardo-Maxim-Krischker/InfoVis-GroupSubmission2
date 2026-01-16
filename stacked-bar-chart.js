/**
 * Stacked Bar Chart Component (Causal)
 * Visualizes the breakdown of accident severity across different weather conditions.
 */
const drawStackedBarChart = (svg, data, colorScale) => {
  // --- FIX: Define dimensions locally ---
  const WIDTH = 600;
  const HEIGHT = 350;
  const MARGINS = { top: 20, right: 20, bottom: 100, left: 60 }; // Bottom margin for rotated labels

  // Clear previous contents
  svg.selectAll("*").remove();

  // 1. Setup Stack Generator
  const keys = [1, 2, 3, 4]; // Severity levels
  const stack = d3.stack()
    .keys(keys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const stackedData = stack(data);

  // 2. Define Scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.category))
    .range([MARGINS.left, WIDTH - MARGINS.right])
    .padding(0.3);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.total)]) // 'total' was calculated in manager
    .nice()
    .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

  // 3. Render Layers
  const layers = svg.selectAll(".layer")
    .data(stackedData)
    .join("g")
      .attr("class", "layer")
      .attr("fill", d => colorScale(d.key));

  // 4. Render Rects
  layers.selectAll("rect")
    .data(d => d)
    .join("rect")
      .attr("x", d => xScale(d.data.category))
      .attr("y", d => yScale(d[1]))
      .attr("height", d => yScale(d[0]) - yScale(d[1]))
      .attr("width", xScale.bandwidth());

  // 5. Axes
  // X-Axis (Rotated Labels)
  svg.append("g")
    .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

  // Y-Axis
  svg.append("g")
    .attr("transform", `translate(${MARGINS.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5));
    
  // 6. Simple Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${WIDTH - 100}, ${MARGINS.top})`);
    
  // Just show label for Severity 4 (Purple) as example
  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("font-size", "10px")
    .attr("fill", "#666")
    .text("Darker = More Severe");
};