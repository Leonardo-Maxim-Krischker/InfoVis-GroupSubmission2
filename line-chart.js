/**
 * Line Chart Component (Temporal)
 */
const drawLineChart = (svg, data) => {
  // --- FIX: Define dimensions locally ---
  const WIDTH = 600;
  const HEIGHT = 350;
  const MARGINS = { top: 20, right: 30, bottom: 50, left: 60 };

  // Clear previous contents
  svg.selectAll("*").remove();

  // Create Scales
  const xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([MARGINS.left, WIDTH - MARGINS.right]);
  
  // Use a nice max value (add 10% headroom)
  const yMax = d3.max(data, d => d.value) || 0;
  const yScale = d3.scaleLinear()
    .domain([0, yMax * 1.1]) 
    .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

  // Line Generator
  const lineGenerator = d3.line()
    .curve(d3.curveMonotoneX) // Smooth curves
    .x(d => xScale(d.date))
    .y(d => yScale(d.value));

  // 1. Add Axes
  // X-Axis
  svg.append("g")
    .attr("transform", `translate(0,${HEIGHT - MARGINS.bottom})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat("%b"))); // Abbreviated Month

  // Y-Axis
  svg.append("g")
    .attr("transform", `translate(${MARGINS.left},0)`)
    .call(d3.axisLeft(yScale).ticks(5));

  // 2. Draw Line
  svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#5f27cd") // Purple color
      .attr("stroke-width", 3)
      .attr("d", lineGenerator);

  // 3. Add Dots
  svg.selectAll(".dot")
    .data(data)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", d => xScale(d.date))
    .attr("cy", d => yScale(d.value))
    .attr("r", 4)
    .attr("fill", "#5f27cd")
    .append("title") // Simple native tooltip
    .text(d => `${d3.timeFormat("%B")(d.date)}: ${d.value} accidents`);
};