/**
 * Line Chart Component (Temporal)
 */
const drawLineChart = (svg, data, colorScale) => {
  const xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([MARGINS.left, WIDTH - MARGINS.right]);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

  const lineGenerator = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.value));

  // Example: Draw light grey paths for all countries initially
  const group = d3.group(data, d => d.geo);
  
  svg.append("g")
    .selectAll("path")
    .data(group)
    .join("path")
      .attr("class", ([geo, d]) => geo)
      .attr("d", ([geo, d]) => lineGenerator(d))
      .style("stroke", "lightgrey")
      .style("stroke-width", 2)
      .style("fill", "transparent")
      .style("opacity", 0.3);

  // Add Axes
  svg.append("g")
    .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(${MARGINS.left},0)`)
    .call(d3.axisLeft(yScale));
};